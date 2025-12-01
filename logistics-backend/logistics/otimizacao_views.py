import logging
import math

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import Pedido, Rota, RotaPedido
from .ia.genetic_algorithm import otimizar_rota_pedidos

logger = logging.getLogger(__name__)


class OtimizarRotaGeneticoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            pedidos_ids = request.data.get("pedidos_ids", [])
            deposito = request.data.get("deposito")
            parametros = request.data.get("parametros", {})
            logger.info("[GA] requisicao: pedidos=%s deposito=%s params=%s", pedidos_ids, deposito, parametros)

            if not pedidos_ids or len(pedidos_ids) < 2:
                logger.warning("[GA] pedidos insuficientes para otimizar: %s", pedidos_ids)
                return Response(
                    {"error": "É necessário pelo menos 2 pedidos para otimização"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not deposito or "latitude" not in deposito or "longitude" not in deposito:
                logger.warning("[GA] deposito ausente ou incompleto: %s", deposito)
                return Response(
                    {"error": "Coordenadas do depósito são obrigatórias"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            pedidos = Pedido.objects.filter(id__in=pedidos_ids)

            if pedidos.count() != len(pedidos_ids):
                logger.warning("[GA] pedidos faltando; esperados=%s encontrados=%s", len(pedidos_ids), pedidos.count())
                return Response(
                    {"error": "Alguns pedidos não foram encontrados"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            def coord_valida(lat_val, lng_val):
                try:
                    lat_num = float(lat_val)
                    lng_num = float(lng_val)
                except Exception:
                    return False
                return math.isfinite(lat_num) and math.isfinite(lng_num) and abs(lat_num) <= 90 and abs(lng_num) <= 180

            pedidos_data = []
            for pedido in pedidos:
                if not coord_valida(pedido.latitude, pedido.longitude):
                    logger.warning("[GA] pedido %s com coordenadas invalidas: lat=%s lon=%s", pedido.id, pedido.latitude, pedido.longitude)
                    return Response(
                        {"error": f"Pedido {pedido.id} está com latitude/longitude inválidas para otimização."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                pedidos_data.append(
                    {
                        "id": pedido.id,
                        "latitude": float(pedido.latitude),
                        "longitude": float(pedido.longitude),
                        "nf": pedido.nf,
                    }
                )

            deposito_data = {"latitude": float(deposito["latitude"]), "longitude": float(deposito["longitude"])}
            if not coord_valida(deposito_data["latitude"], deposito_data["longitude"]):
                logger.warning("[GA] deposito com coordenadas invalidas: %s", deposito_data)
                return Response(
                    {"error": "Depósito com latitude/longitude inválidas para otimização."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            logger.info("[GA] iniciando otimizacao: pedidos=%s deposito=%s", pedidos_ids, deposito_data)
            resultado = otimizar_rota_pedidos(pedidos_data, deposito_data)
            logger.info(
                "[GA] concluido: dist_km=%s geracoes=%s ordem=%s",
                resultado.get("distancia_total_km"),
                resultado.get("num_geracoes"),
                resultado.get("pedidos_ordem"),
            )

            return Response(
                {
                    "status": "success",
                    "algoritmo": "genetico",
                    "num_geracoes": resultado.get("num_geracoes"),
                    "distancia_total_km": resultado.get("distancia_total_km"),
                    "resultado": resultado,
                    "mensagem": f'Rota otimizada com sucesso! Distância total: {resultado["distancia_total_km"]} km',
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.exception("[GA] erro ao otimizar rota")
            return Response(
                {"error": "Erro ao otimizar rota", "detalhes": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class SalvarRotaOtimizadaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            data_rota = request.data.get("data_rota")
            capacidade_max = request.data.get("capacidade_max")
            pedidos_ordem = request.data.get("pedidos_ordem", [])
            distancia_total = request.data.get("distancia_total")

            logger.info(
                "[GA] salvar rota otimizada: data=%s capacidade=%s pedidos=%s distancia=%s",
                data_rota,
                capacidade_max,
                pedidos_ordem,
                distancia_total,
            )

            if not data_rota or not capacidade_max or not pedidos_ordem:
                return Response(
                    {"error": "Dados obrigatórios faltando"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            rota = Rota.objects.create(
                data_rota=data_rota,
                capacidade_max=capacidade_max,
                status="PLANEJADA",
            )

            for ordem, pedido_id in enumerate(pedidos_ordem, 1):
                pedido = get_object_or_404(Pedido, pk=pedido_id)
                RotaPedido.objects.create(
                    rota=rota,
                    pedido=pedido,
                    ordem_entrega=ordem,
                )

            logger.info("[GA] rota salva id=%s pedidos=%s", rota.id, pedidos_ordem)

            return Response(
                {
                    "status": "success",
                    "rota_id": rota.id,
                    "mensagem": f"Rota #{rota.id} criada com sucesso!",
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.exception("[GA] erro ao salvar rota otimizada")
            return Response(
                {"error": "Erro ao salvar rota", "detalhes": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CompararAlgoritmosView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            pedidos_ids = request.data.get("pedidos_ids", [])
            deposito = request.data.get("deposito")

            if not pedidos_ids or not deposito:
                return Response(
                    {"error": "Dados obrigatórios faltando"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            pedidos = Pedido.objects.filter(id__in=pedidos_ids)
            pedidos_data = [
                {
                    "id": p.id,
                    "latitude": float(p.latitude),
                    "longitude": float(p.longitude),
                }
                for p in pedidos
            ]

            deposito_data = {"latitude": float(deposito["latitude"]), "longitude": float(deposito["longitude"])}

            resultado_ga = otimizar_rota_pedidos(pedidos_data, deposito_data)

            from .ia.genetic_algorithm import calcular_distancia

            rota_greedy = []
            visitados = set()
            atual = deposito_data
            distancia_greedy = 0

            for _ in range(len(pedidos_data)):
                melhor_dist = float("inf")
                melhor_idx = None

                for i, p in enumerate(pedidos_data):
                    if i not in visitados:
                        dist = calcular_distancia(
                            (atual["latitude"], atual["longitude"]),
                            (p["latitude"], p["longitude"]),
                        )
                        if dist < melhor_dist:
                            melhor_dist = dist
                            melhor_idx = i

                if melhor_idx is not None:
                    visitados.add(melhor_idx)
                    rota_greedy.append(melhor_idx)
                    distancia_greedy += melhor_dist
                    atual = pedidos_data[melhor_idx]

            distancia_greedy += calcular_distancia(
                (atual["latitude"], atual["longitude"]),
                (deposito_data["latitude"], deposito_data["longitude"]),
            )

            economia = distancia_greedy - resultado_ga["distancia_total_km"]
            economia_percentual = (economia / distancia_greedy * 100) if distancia_greedy > 0 else 0

            return Response(
                {
                    "status": "success",
                    "comparacao": {
                        "algoritmo_genetico": {
                            "distancia_km": resultado_ga["distancia_total_km"],
                            "tempo_s": resultado_ga["tempo_execucao_s"],
                            "geracoes": resultado_ga["num_geracoes"],
                        },
                        "vizinho_mais_proximo": {
                            "distancia_km": round(distancia_greedy, 2),
                            "tempo_s": 0.01,
                        },
                        "economia": {
                            "km": round(economia, 2),
                            "percentual": round(economia_percentual, 2),
                        },
                    },
                }
            )

        except Exception as e:
            logger.exception("[GA] erro ao comparar algoritmos")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
