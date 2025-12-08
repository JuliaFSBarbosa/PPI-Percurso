# logistics/views.py
from datetime import datetime
import io

from django.core.exceptions import ValidationError
from django.db.models import Max, Sum, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import FamiliaFilter, PedidoFilter, ProdutoFilter
from .ia.genetic_algorithm import calcular_distancia, otimizar_rota_pedidos
from .constants import DEFAULT_DEPOSITO
from .models import Familia, Pedido, PedidoRestricaoGrupo, Produto, RestricaoFamilia, Rota, RotaPedido
from .serializers import (
    FamiliaSerializer,
    PedidoCreateSerializer,
    PedidoSerializer,
    ProdutoSerializer,
    RestricaoFamiliaSerializer,
    RotaCreateSerializer,
    RotaSerializer,
)
from .services.restricoes import (
    analisar_restricoes_para_itens_payload,
    coletar_familias_da_rota,
    dividir_pedido_validado,
    normalizar_payload_pedidos,
    validar_novos_vinculos_em_rota,
)


# IA (Somente Algoritmo Genetico)

# ====================================================
# ViewSets para Familia
# ====================================================
class FamiliaViewSet(viewsets.ModelViewSet):
    queryset = Familia.objects.filter(ativo=True).order_by("nome")
    serializer_class = FamiliaSerializer
    permission_classes = [AllowAny]
    filterset_class = FamiliaFilter
    ordering_fields = ["nome", "created_at"]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]


class RestricaoFamiliaViewSet(viewsets.ModelViewSet):
    queryset = RestricaoFamilia.objects.select_related("familia_origem", "familia_restrita").order_by("familia_origem__nome")
    serializer_class = RestricaoFamiliaSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["ativo", "familia_origem", "familia_restrita"]
    http_method_names = ["get", "post", "delete", "patch", "head", "options"]


# ====================================================
# ViewSets para Produto
# ====================================================
class ProdutoViewSet(viewsets.ModelViewSet):
    queryset = Produto.objects.filter(ativo=True).select_related("familia").order_by("nome")
    serializer_class = ProdutoSerializer
    permission_classes = [AllowAny]
    filterset_class = ProdutoFilter
    ordering_fields = ["nome", "peso", "created_at"]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]


# ====================================================
# ViewSet para Pedidos
# ====================================================
class PedidoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = PedidoFilter


# ====================================================
# ViewSet para Rotas
# ====================================================
class RotaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Rota.objects.all()
    serializer_class = RotaSerializer


# ====================================================
# CRUD de Pedidos e Rotas
# ====================================================
class PedidoCreateViewSet(viewsets.ModelViewSet):
    queryset = Pedido.objects.all()
    serializer_class = PedidoCreateSerializer

    @action(detail=False, methods=["post"], url_path="dividir")
    def dividir(self, request, *args, **kwargs):
        context = {**self.get_serializer_context(), "allow_family_conflicts": True}
        serializer = self.get_serializer(data=request.data, context=context)
        serializer.is_valid(raise_exception=True)
        analise = serializer.analise_restricoes or analisar_restricoes_para_itens_payload(serializer.validated_data.get("itens") or [])
        if not analise.get("possui_conflito"):
            return Response(
                {"detail": "Não há restrições de famílias para dividir este pedido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pedidos_criados = dividir_pedido_validado(serializer.validated_data, analise=analise)
        data = PedidoSerializer(pedidos_criados, many=True, context=self.get_serializer_context()).data
        return Response(
            {
                "success": True,
                "dividido": True,
                "mensagem": analise.get("mensagem") or "Pedido dividido em grupos independentes.",
                "total_grupos": len(pedidos_criados),
                "nf": serializer.validated_data.get("nf"),
                "pedidos": data,
            },
            status=status.HTTP_201_CREATED,
        )


class RotaCreateViewSet(viewsets.ModelViewSet):
    queryset = Rota.objects.all()
    serializer_class = RotaCreateSerializer

    def perform_update(self, serializer):
        rota_anterior = serializer.instance
        status_anterior = rota_anterior.status if rota_anterior else None
        rota = serializer.save()
        if status_anterior == rota.status:
            return

        if rota.status == "CONCLUIDA":
            rota.pedidos.update(entregue=True, data_entrega=timezone.now())
        elif status_anterior == "CONCLUIDA":
            rota.pedidos.update(entregue=False, data_entrega=None)


class AtribuirPedidosRotaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        rota_id = request.data.get("rota_id")
        pedidos_payload = request.data.get("pedidos_ids", [])

        if not rota_id or not pedidos_payload:
            return Response({"detail": "Informe rota_id e pedidos_ids."}, status=status.HTTP_400_BAD_REQUEST)

        rota = get_object_or_404(Rota, pk=rota_id)
        try:
            pedidos_normalizados = normalizar_payload_pedidos(pedidos_payload)
        except ValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        pedidos_ids = [p["pedido_id"] for p in pedidos_normalizados]
        pedidos_map = {p.id: p for p in Pedido.objects.filter(id__in=pedidos_ids)}
        if len(set(pedidos_ids)) != len(pedidos_map):
            return Response({"detail": "Alguns pedidos nao foram encontrados."}, status=status.HTTP_400_BAD_REQUEST)

        vinculos = []
        for entry in pedidos_normalizados:
            pedido = pedidos_map[entry["pedido_id"]]
            grupo = None
            grupo_id = entry.get("grupo_restricao_id")
            if grupo_id:
                grupo = get_object_or_404(PedidoRestricaoGrupo, pk=grupo_id, pedido=pedido)
            elif pedido.grupos_restricao.filter(ativo=True).exists():
                return Response(
                    {"detail": f"Pedido {pedido.id} foi repartido. Informe o grupo antes de adicionar na rota."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            vinculos.append((pedido, grupo))

        familias_existentes = coletar_familias_da_rota(rota)
        try:
            validar_novos_vinculos_em_rota(vinculos, familias_iniciais=familias_existentes)
        except ValidationError as exc:
            mensagem = ", ".join(exc.messages) if hasattr(exc, "messages") else str(exc)
            return Response({"detail": mensagem}, status=status.HTTP_400_BAD_REQUEST)

        ultima_ordem = RotaPedido.objects.filter(rota=rota).aggregate(Max("ordem_entrega")).get("ordem_entrega__max") or 0
        criados = 0
        for idx, (pedido, grupo) in enumerate(vinculos, start=1):
            if RotaPedido.objects.filter(
                rota=rota,
                pedido=pedido,
                grupo_restricao=grupo,
            ).exists():
                continue
            RotaPedido.objects.create(
                rota=rota,
                pedido=pedido,
                grupo_restricao=grupo,
                ordem_entrega=ultima_ordem + idx,
            )
            criados += 1

        return Response(
            {
                "success": True,
                "mensagem": f"{criados} pedidos atribuidos a rota {rota.id}.",
            },
            status=status.HTTP_200_OK,
        )


class RemoverPedidoRotaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pedido_id):
        pedido = get_object_or_404(Pedido, pk=pedido_id)
        removidos, _ = RotaPedido.objects.filter(pedido=pedido).delete()
        return Response(
            {"success": True, "mensagem": f"{removidos} vinculos removidos do pedido {pedido.id}."},
            status=status.HTTP_200_OK,
        )


class DashboardResumoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data_param = request.query_params.get("data")
        try:
            if data_param:
                data_ref = datetime.strptime(data_param, "%Y-%m-%d").date()
            else:
                data_ref = timezone.localdate()
        except ValueError:
            return Response(
                {"detail": "Data inválida. Utilize o formato AAAA-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pedidos_do_dia = Pedido.objects.filter(dtpedido=data_ref)
        pedidos_pendentes = (
            pedidos_do_dia.filter(
                Q(rotas__isnull=True) | Q(rotas__rota__status__in=["PLANEJADA", "EM_EXECUCAO"])
            )
            .distinct()
            .count()
        )

        rotas_do_dia = Rota.objects.filter(data_rota=data_ref)
        resumo = {
            "data_referencia": data_ref,
            "total_pedidos": pedidos_do_dia.count(),
            "pedidos_pendentes": pedidos_pendentes,
            "rotas_geradas": rotas_do_dia.count(),
            "rotas_em_execucao": rotas_do_dia.filter(status="EM_EXECUCAO").count(),
            "rotas_finalizadas": rotas_do_dia.filter(status="CONCLUIDA").count(),
        }

        return Response(resumo, status=status.HTTP_200_OK)


# ====================================================
# Geracao de PDF (rota otimizada)
# ====================================================
class GerarPDFRotaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            rota_ids = request.data.get("rota", [])
            distancia_total = request.data.get("distancia_total", 0)
            deposito = request.data.get("deposito") or DEFAULT_DEPOSITO
            algoritmo = request.data.get("algoritmo", "Algoritmo Genetico")
            tempo_execucao = request.data.get("tempo_execucao", 0)
            geracoes = request.data.get("geracoes", 0)

            pedidos = Pedido.objects.filter(id__in=rota_ids).prefetch_related("itens__produto")
            if pedidos.count() != len(rota_ids):
                return Response({"error": "Alguns pedidos nao foram encontrados"}, status=status.HTTP_404_NOT_FOUND)

            pedidos_dict = {p.id: p for p in pedidos}

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)

            styles = getSampleStyleSheet()
            titulo_style = ParagraphStyle(
                "CustomTitle",
                parent=styles["Heading1"],
                fontSize=18,
                textColor=colors.HexColor("#0f5132"),
                alignment=TA_CENTER,
                spaceAfter=12,
            )
            subtitulo_style = ParagraphStyle(
                "CustomSubtitle",
                parent=styles["Normal"],
                fontSize=10,
                textColor=colors.grey,
                alignment=TA_CENTER,
                spaceAfter=20,
            )
            secao_style = ParagraphStyle(
                "SectionTitle",
                parent=styles["Heading2"],
                fontSize=14,
                textColor=colors.HexColor("#0f5132"),
                spaceAfter=10,
                spaceBefore=15,
            )

            elementos = []
            elementos.append(Paragraph("RELATORIO DE ROTA OTIMIZADA", titulo_style))
            elementos.append(
                Paragraph(
                    f"Gerado em: {datetime.now().strftime('%d/%m/%Y as %H:%M')}",
                    subtitulo_style,
                )
            )
            elementos.append(Spacer(1, 0.5 * cm))

            # Resumo
            elementos.append(Paragraph("RESUMO DA OTIMIZACAO", secao_style))
            dados_resumo = [
                ["Algoritmo Utilizado:", algoritmo],
                ["Numero de Entregas:", str(len(rota_ids))],
                ["Distancia Total:", f"{distancia_total:.2f} km"],
                ["Tempo de Processamento:", f"{tempo_execucao:.2f} segundos"],
                ["Geracoes Processadas:", str(geracoes)],
            ]
            tabela_resumo = Table(dados_resumo, colWidths=[7 * cm, 9 * cm])
            tabela_resumo.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0f0f0")),
                        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ]
                )
            )
            elementos.append(tabela_resumo)
            elementos.append(Spacer(1, 0.5 * cm))

            # Deposito
            elementos.append(Paragraph("PONTO DE PARTIDA", secao_style))
            dados_dep = [
                ["Deposito/Sede"],
                [f"Coordenadas: {deposito.get('latitude')}, {deposito.get('longitude')}"],
                [deposito.get("endereco", "Endereco nao informado")],
            ]
            tabela_dep = Table(dados_dep, colWidths=[16 * cm])
            tabela_dep.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#0f5132")),
                        ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ]
                )
            )
            elementos.append(tabela_dep)
            elementos.append(Spacer(1, 0.5 * cm))

            # Entregas
            elementos.append(Paragraph("SEQUENCIA DE ENTREGAS OTIMIZADA", secao_style))
            dados_entregas = [["#", "NF", "Coordenadas", "Peso (kg)", "Produtos"]]

            for ordem, pid in enumerate(rota_ids, start=1):
                p = pedidos_dict[pid]
                peso_total = sum(i.produto.peso * i.quantidade for i in p.itens.all())
                produtos = ", ".join([f"{i.produto.nome} ({i.quantidade}x)" for i in p.itens.all()])
                dados_entregas.append(
                    [
                        str(ordem),
                        p.nf,
                        f"{p.latitude}, {p.longitude}",
                        f"{peso_total:.2f}",
                        produtos[:40] + "..." if len(produtos) > 40 else produtos,
                    ]
                )

            tabela_entregas = Table(
                dados_entregas,
                colWidths=[1.5 * cm, 2 * cm, 4 * cm, 2.5 * cm, 6 * cm],
            )
            tabela_entregas.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f5132")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ]
                )
            )
            elementos.append(tabela_entregas)
            elementos.append(Spacer(1, 0.5 * cm))

            doc.build(elementos)
            buffer.seek(0)

            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = (
                f'attachment; filename="rota_otimizada_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf"'
            )
            return response

        except Exception as e:
            return Response(
                {"error": "Erro ao gerar PDF", "detalhes": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
