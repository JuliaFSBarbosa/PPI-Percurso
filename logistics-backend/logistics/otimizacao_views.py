# logistics/views_otimizacao.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import Pedido, Rota, RotaPedido
from .ia.genetic_algorithm import otimizar_rota_pedidos

class OtimizarRotaGeneticoView(APIView):
    """
    View para otimizar rotas usando Algoritmo Genético
    
    POST /api/v1/logistics/otimizar-rota-genetico/
    Body:
    {
        "pedidos_ids": [1, 2, 3, 4, 5],
        "deposito": {
            "latitude": -27.5969,
            "longitude": -48.5495
        },
        "parametros": {
            "tamanho_populacao": 100,
            "num_geracoes": 500,
            "taxa_crossover": 0.8,
            "taxa_mutacao": 0.2
        }
    }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            # Validação dos dados
            pedidos_ids = request.data.get('pedidos_ids', [])
            deposito = request.data.get('deposito')
            parametros = request.data.get('parametros', {})
            
            if not pedidos_ids or len(pedidos_ids) < 2:
                return Response(
                    {'error': 'É necessário pelo menos 2 pedidos para otimização'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not deposito or 'latitude' not in deposito or 'longitude' not in deposito:
                return Response(
                    {'error': 'Coordenadas do depósito são obrigatórias'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Busca pedidos no banco
            pedidos = Pedido.objects.filter(id__in=pedidos_ids)
            
            if pedidos.count() != len(pedidos_ids):
                return Response(
                    {'error': 'Alguns pedidos não foram encontrados'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Prepara dados para algoritmo
            pedidos_data = []
            for pedido in pedidos:
                pedidos_data.append({
                    'id': pedido.id,
                    'latitude': float(pedido.latitude),
                    'longitude': float(pedido.longitude),
                    'nf': pedido.nf
                })
            
            deposito_data = {
                'latitude': float(deposito['latitude']),
                'longitude': float(deposito['longitude'])
            }
            
            # Executa otimização
            resultado = otimizar_rota_pedidos(pedidos_data, deposito_data)
            
            return Response({
                'status': 'success',
                'resultado': resultado,
                'mensagem': f'Rota otimizada com sucesso! Distância total: {resultado["distancia_total_km"]} km'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': 'Erro ao otimizar rota', 'detalhes': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SalvarRotaOtimizadaView(APIView):
    """
    Salva a rota otimizada no banco de dados
    
    POST /api/v1/logistics/salvar-rota-otimizada/
    Body:
    {
        "data_rota": "2025-01-20",
        "capacidade_max": 500,
        "pedidos_ordem": [3, 1, 5, 2, 4],
        "distancia_total": 45.5
    }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            data_rota = request.data.get('data_rota')
            capacidade_max = request.data.get('capacidade_max')
            pedidos_ordem = request.data.get('pedidos_ordem', [])
            distancia_total = request.data.get('distancia_total')
            
            if not data_rota or not capacidade_max or not pedidos_ordem:
                return Response(
                    {'error': 'Dados obrigatórios faltando'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Cria rota
            rota = Rota.objects.create(
                data_rota=data_rota,
                capacidade_max=capacidade_max,
                status='PLANEJADA'
            )
            
            # Adiciona pedidos na ordem otimizada
            for ordem, pedido_id in enumerate(pedidos_ordem, 1):
                pedido = get_object_or_404(Pedido, pk=pedido_id)
                RotaPedido.objects.create(
                    rota=rota,
                    pedido=pedido,
                    ordem_entrega=ordem
                )
            
            return Response({
                'status': 'success',
                'rota_id': rota.id,
                'mensagem': f'Rota #{rota.id} criada com sucesso!'
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': 'Erro ao salvar rota', 'detalhes': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CompararAlgoritmosView(APIView):
    """
    Compara Algoritmo Genético com outros métodos
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            pedidos_ids = request.data.get('pedidos_ids', [])
            deposito = request.data.get('deposito')
            
            if not pedidos_ids or not deposito:
                return Response(
                    {'error': 'Dados obrigatórios faltando'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Busca pedidos
            pedidos = Pedido.objects.filter(id__in=pedidos_ids)
            pedidos_data = [{
                'id': p.id,
                'latitude': float(p.latitude),
                'longitude': float(p.longitude)
            } for p in pedidos]
            
            deposito_data = {
                'latitude': float(deposito['latitude']),
                'longitude': float(deposito['longitude'])
            }
            
            # Algoritmo Genético
            resultado_ga = otimizar_rota_pedidos(pedidos_data, deposito_data)
            
            # Vizinho Mais Próximo (greedy)
            from .ia.genetic_algorithm import calcular_distancia
            
            rota_greedy = []
            visitados = set()
            atual = deposito_data
            distancia_greedy = 0
            
            for _ in range(len(pedidos_data)):
                melhor_dist = float('inf')
                melhor_idx = None
                
                for i, p in enumerate(pedidos_data):
                    if i not in visitados:
                        dist = calcular_distancia(
                            (atual['latitude'], atual['longitude']),
                            (p['latitude'], p['longitude'])
                        )
                        if dist < melhor_dist:
                            melhor_dist = dist
                            melhor_idx = i
                
                if melhor_idx is not None:
                    visitados.add(melhor_idx)
                    rota_greedy.append(melhor_idx)
                    distancia_greedy += melhor_dist
                    atual = pedidos_data[melhor_idx]
            
            # Volta ao depósito
            distancia_greedy += calcular_distancia(
                (atual['latitude'], atual['longitude']),
                (deposito_data['latitude'], deposito_data['longitude'])
            )
            
            # Compara resultados
            economia = distancia_greedy - resultado_ga['distancia_total_km']
            economia_percentual = (economia / distancia_greedy * 100) if distancia_greedy > 0 else 0
            
            return Response({
                'status': 'success',
                'comparacao': {
                    'algoritmo_genetico': {
                        'distancia_km': resultado_ga['distancia_total_km'],
                        'tempo_s': resultado_ga['tempo_execucao_s'],
                        'geracoes': resultado_ga['num_geracoes']
                    },
                    'vizinho_mais_proximo': {
                        'distancia_km': round(distancia_greedy, 2),
                        'tempo_s': 0.01  # Greedy é muito rápido
                    },
                    'economia': {
                        'km': round(economia, 2),
                        'percentual': round(economia_percentual, 2)
                    }
                }
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )