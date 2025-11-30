# logistics/views.py
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.shortcuts import get_object_or_404
from django.http import HttpResponse

from .models import Familia, Produto, Pedido, Rota, RotaPedido

# Serializers & Filters
from .serializers import (
    FamiliaSerializer,
    ProdutoSerializer,
    PedidoSerializer,
    PedidoCreateSerializer,
    RotaSerializer
)
from .filters import FamiliaFilter, ProdutoFilter, PedidoFilter
from django_filters.rest_framework import DjangoFilterBackend

# IA (Somente Algoritmo Genético)
from .ia.genetic_algorithm import otimizar_rota_pedidos, calcular_distancia

# PDF
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER
import io
from datetime import datetime


# ====================================================
# ViewSets para Família
# ====================================================
class FamiliaViewSet(viewsets.ModelViewSet):
    queryset = Familia.objects.filter(ativo=True).order_by('nome')
    serializer_class = FamiliaSerializer
    permission_classes = [AllowAny]
    filterset_class = FamiliaFilter
    ordering_fields = ['nome', 'created_at']
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']


# ====================================================
# ViewSets para Produto
# ====================================================
class ProdutoViewSet(viewsets.ModelViewSet):
    queryset = Produto.objects.filter(ativo=True).select_related('familia').order_by('nome')
    serializer_class = ProdutoSerializer
    permission_classes = [AllowAny]
    filterset_class = ProdutoFilter
    ordering_fields = ['nome', 'peso', 'created_at']
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']


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


class RotaCreateViewSet(viewsets.ModelViewSet):
    queryset = Rota.objects.all()
    serializer_class = RotaSerializer


# ====================================================
# Geração de PDF (rota otimizada)
# ====================================================
class GerarPDFRotaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            rota_ids = request.data.get('rota', [])
            distancia_total = request.data.get('distancia_total', 0)
            deposito = request.data.get('deposito', {})
            algoritmo = request.data.get('algoritmo', 'Algoritmo Genético')
            tempo_execucao = request.data.get('tempo_execucao', 0)
            geracoes = request.data.get('geracoes', 0)

            pedidos = Pedido.objects.filter(id__in=rota_ids).prefetch_related('itens__produto')
            if pedidos.count() != len(rota_ids):
                return Response({'error': 'Alguns pedidos não foram encontrados'},
                                status=status.HTTP_404_NOT_FOUND)

            pedidos_dict = {p.id: p for p in pedidos}

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)

            styles = getSampleStyleSheet()
            titulo_style = ParagraphStyle(
                'CustomTitle', parent=styles['Heading1'],
                fontSize=18, textColor=colors.HexColor('#0f5132'),
                alignment=TA_CENTER, spaceAfter=12
            )
            subtitulo_style = ParagraphStyle(
                'CustomSubtitle', parent=styles['Normal'],
                fontSize=10, textColor=colors.grey,
                alignment=TA_CENTER, spaceAfter=20
            )
            secao_style = ParagraphStyle(
                'SectionTitle', parent=styles['Heading2'],
                fontSize=14, textColor=colors.HexColor('#0f5132'),
                spaceAfter=10, spaceBefore=15
            )

            elementos = []
            elementos.append(Paragraph("RELATÓRIO DE ROTA OTIMIZADA", titulo_style))
            elementos.append(Paragraph(f"Gerado em: {datetime.now().strftime('%d/%m/%Y às %H:%M')}",
                                      subtitulo_style))
            elementos.append(Spacer(1, 0.5*cm))

            # Resumo
            elementos.append(Paragraph("RESUMO DA OTIMIZAÇÃO", secao_style))
            dados_resumo = [
                ['Algoritmo Utilizado:', algoritmo],
                ['Número de Entregas:', str(len(rota_ids))],
                ['Distância Total:', f'{distancia_total:.2f} km'],
                ['Tempo de Processamento:', f'{tempo_execucao:.2f} segundos'],
                ['Gerações Processadas:', str(geracoes)],
            ]
            tabela_resumo = Table(dados_resumo, colWidths=[7*cm, 9*cm])
            tabela_resumo.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elementos.append(tabela_resumo)
            elementos.append(Spacer(1, 0.5*cm))

            # Depósito
            elementos.append(Paragraph("PONTO DE PARTIDA", secao_style))
            dados_dep = [
                ['Depósito/Sede'],
                [f"Coordenadas: {deposito.get('latitude')}, {deposito.get('longitude')}"],
                [deposito.get('endereco', 'Endereço não informado')]
            ]
            tabela_dep = Table(dados_dep, colWidths=[16*cm])
            tabela_dep.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#0f5132')),
                ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elementos.append(tabela_dep)
            elementos.append(Spacer(1, 0.5*cm))

            # Entregas
            elementos.append(Paragraph("SEQUÊNCIA DE ENTREGAS OTIMIZADA", secao_style))
            dados_entregas = [['#', 'NF', 'Coordenadas', 'Peso (kg)', 'Produtos']]

            for ordem, pid in enumerate(rota_ids, start=1):
                p = pedidos_dict[pid]
                peso_total = sum(i.produto.peso * i.quantidade for i in p.itens.all())
                produtos = ', '.join([
                    f"{i.produto.nome} ({i.quantidade}x)"
                    for i in p.itens.all()
                ])
                dados_entregas.append([
                    str(ordem),
                    p.nf,
                    f"{p.latitude}, {p.longitude}",
                    f"{peso_total:.2f}",
                    produtos[:40] + '...' if len(produtos) > 40 else produtos
                ])

            tabela_entregas = Table(
                dados_entregas,
                colWidths=[1.5*cm, 2*cm, 4*cm, 2.5*cm, 6*cm]
            )
            tabela_entregas.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f5132')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elementos.append(tabela_entregas)
            elementos.append(Spacer(1, 0.5*cm))

            doc.build(elementos)
            buffer.seek(0)

            response = HttpResponse(buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = (
                f'attachment; filename="rota_otimizada_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf"'
            )
            return response

        except Exception as e:
            return Response({'error': 'Erro ao gerar PDF', 'detalhes': str(e)},
                            status=status.HTTP_400_BAD_REQUEST)
