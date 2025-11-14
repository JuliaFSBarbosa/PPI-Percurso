# logistics/views.py

from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404

# Importe seus models aqui (ajuste conforme necessário)
# from .models import Familia, Produto, Pedido, Rota
# from .serializers import FamiliaSerializer, ProdutoSerializer, PedidoSerializer, RotaSerializer

# ==========================================
# ViewSets Básicos (Leitura)
# ==========================================

class FamiliaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet apenas leitura para Família
    """
    # queryset = Familia.objects.all()
    # serializer_class = FamiliaSerializer
    
    def list(self, request):
        return Response({
            'message': 'Lista de famílias',
            'data': []
        })
    
    def retrieve(self, request, pk=None):
        return Response({
            'message': f'Detalhes da família {pk}',
            'data': {}
        })


class ProdutoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet apenas leitura para Produto
    """
    # queryset = Produto.objects.all()
    # serializer_class = ProdutoSerializer
    
    def list(self, request):
        return Response({
            'message': 'Lista de produtos',
            'data': []
        })
    
    def retrieve(self, request, pk=None):
        return Response({
            'message': f'Detalhes do produto {pk}',
            'data': {}
        })


class PedidoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet apenas leitura para Pedido
    """
    # queryset = Pedido.objects.all()
    # serializer_class = PedidoSerializer
    
    def list(self, request):
        # Dados de exemplo - substitua pela query real do banco
        pedidos_exemplo = [
            {
                'id': 1,
                'numero_nota': '1001',
                'cliente_nome': 'Cliente A',
                'peso_total': 10.5,
                'latitude': -27.2250,
                'longitude': -53.3450,
                'tem_rota': False
            },
            {
                'id': 2,
                'numero_nota': '1002',
                'cliente_nome': 'Cliente B',
                'peso_total': 15.0,
                'latitude': -27.2300,
                'longitude': -53.3500,
                'tem_rota': False
            },
            {
                'id': 3,
                'numero_nota': '1003',
                'cliente_nome': 'Cliente C',
                'peso_total': 20.0,
                'latitude': -27.2200,
                'longitude': -53.3400,
                'tem_rota': False
            },
            {
                'id': 4,
                'numero_nota': '1004',
                'cliente_nome': 'Cliente D',
                'peso_total': 12.5,
                'latitude': -27.2280,
                'longitude': -53.3480,
                'tem_rota': True
            }
        ]
        return Response(pedidos_exemplo)
    
    def retrieve(self, request, pk=None):
        return Response({
            'message': f'Detalhes do pedido {pk}',
            'data': {}
        })


class RotaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet apenas leitura para Rota
    """
    # queryset = Rota.objects.all()
    # serializer_class = RotaSerializer
    
    def list(self, request):
        return Response({
            'message': 'Lista de rotas',
            'data': []
        })
    
    def retrieve(self, request, pk=None):
        return Response({
            'message': f'Detalhes da rota {pk}',
            'data': {}
        })


# ==========================================
# ViewSets de Administração (CRUD Completo)
# ==========================================

class PedidoCreateViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo para administração de Pedidos
    """
    # queryset = Pedido.objects.all()
    # serializer_class = PedidoSerializer
    
    def list(self, request):
        return Response({'message': 'Lista de pedidos (admin)', 'data': []})
    
    def create(self, request):
        return Response({
            'message': 'Pedido criado com sucesso',
            'data': request.data
        }, status=status.HTTP_201_CREATED)
    
    def update(self, request, pk=None):
        return Response({
            'message': f'Pedido {pk} atualizado',
            'data': request.data
        })
    
    def destroy(self, request, pk=None):
        return Response({
            'message': f'Pedido {pk} deletado'
        }, status=status.HTTP_204_NO_CONTENT)


class RotaCreateViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo para administração de Rotas
    """
    # queryset = Rota.objects.all()
    # serializer_class = RotaSerializer
    
    def list(self, request):
        return Response({'message': 'Lista de rotas (admin)', 'data': []})
    
    def create(self, request):
        print("📥 Recebendo requisição para salvar rota:", request.data)
        
        # Extrair dados
        pedidos = request.data.get('pedidos', [])
        distancia_total = request.data.get('distancia_total', 0)
        otimizada_ia = request.data.get('otimizada_ia', False)
        
        # Aqui você salvaria no banco de dados
        # rota = Rota.objects.create(
        #     pedidos=pedidos,
        #     distancia_total=distancia_total,
        #     otimizada_ia=otimizada_ia
        # )
        
        return Response({
            'message': 'Rota criada com sucesso',
            'id': 1,  # ID da rota criada
            'pedidos': pedidos,
            'distancia_total': distancia_total,
            'otimizada_ia': otimizada_ia
        }, status=status.HTTP_201_CREATED)
    
    def update(self, request, pk=None):
        return Response({
            'message': f'Rota {pk} atualizada',
            'data': request.data
        })
    
    def destroy(self, request, pk=None):
        return Response({
            'message': f'Rota {pk} deletada'
        }, status=status.HTTP_204_NO_CONTENT)


# ==========================================
# Views de Otimização
# ==========================================

class OtimizarRotaView(APIView):
    """
    View para otimização de rotas usando IA
    POST /api/v1/logistics/otimizar-rota/
    """
    
    def post(self, request):
        """
        Recebe dados de pedidos e retorna rota otimizada
        
        Body esperado:
        {
            "pedidos": [1, 2, 3],
            "deposito": {"latitude": -27.225, "longitude": -53.345},
            "capacidade": 500
        }
        """
        try:
            print("📥 Recebendo requisição de otimização:", request.data)
            
            pedidos = request.data.get('pedidos', [])
            deposito = request.data.get('deposito', {})
            capacidade = request.data.get('capacidade', 500)
            
            algoritmo = 'tabu_search'
            parametros = {
                'max_iteracoes': 100,
                'tamanho_tabu': 10
            }
            
            # Validações
            if len(pedidos) < 2:
                return Response({
                    'error': 'É necessário pelo menos 2 pedidos para otimizar'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Importar função de otimização
            try:
                from logistics.ia.tabu_search import otimizar_rota_completa
            except ImportError as e:
                print(f"❌ Erro ao importar módulo: {e}")
                return Response({
                    'error': 'Módulo de otimização não encontrado',
                    'detalhes': 'O arquivo logistics/ia/tabu_search.py não existe ou tem erros'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Executar otimização
            print(f"🚀 Executando otimização para {len(pedidos)} pedidos")
            resultado = otimizar_rota_completa(
                pedidos=pedidos,
                deposito=deposito,
                capacidade=capacidade,
                algoritmo=algoritmo,
                **parametros
            )
            
            print(f"✅ Otimização concluída: {resultado.get('melhoria_percentual', 0):.2f}% de melhoria")
            
            return Response({
                'status': 'success',
                'distancia_inicial': resultado.get('distancia_inicial', 0),
                'distancia_otimizada': resultado.get('distancia', 0),
                'melhoria_percentual': resultado.get('melhoria_percentual', 0),
                'tempo_execucao': resultado.get('tempo', 0),
                'iteracoes': resultado.get('iteracoes', 0),
                'rota_otimizada': resultado.get('rota', [])
            })
            
        except Exception as e:
            print(f"❌ Erro ao otimizar rota: {e}")
            import traceback
            traceback.print_exc()
            
            return Response({
                'error': 'Erro ao otimizar rota',
                'detalhes': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class CompararAlgoritmosView(APIView):
    """
    View para comparar diferentes algoritmos de otimização
    POST /api/v1/logistics/comparar-algoritmos/
    """
    
    def post(self, request):
        """
        Compara resultados de diferentes algoritmos
        
        Body esperado:
        {
            "pedidos": [1, 2, 3, 4, 5],
            "algoritmos": ["tabu_search", "genetic", "simulated_annealing"],
            "deposito": {"latitude": -27.225, "longitude": -53.345}
        }
        """
        try:
            pedidos = request.data.get('pedidos', [])
            algoritmos = request.data.get('algoritmos', ['tabu_search'])
            deposito = request.data.get('deposito', {})
            
            print(f"📊 Comparando {len(algoritmos)} algoritmos para {len(pedidos)} pedidos")
            
            resultados = []
            
            try:
                from logistics.ia.tabu_search import otimizar_rota_completa
            except ImportError:
                return Response({
                    'error': 'Módulo de otimização não encontrado'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            for algoritmo in algoritmos:
                try:
                    print(f"  🔄 Testando {algoritmo}...")
                    resultado = otimizar_rota_completa(
                        pedidos=pedidos,
                        deposito=deposito,
                        capacidade=500,
                        algoritmo=algoritmo,
                        max_iteracoes=100
                    )
                    
                    resultados.append({
                        'algoritmo': algoritmo,
                        'distancia_total': resultado.get('distancia', 0),
                        'distancia_inicial': resultado.get('distancia_inicial', 0),
                        'tempo_execucao': resultado.get('tempo', 0),
                        'iteracoes': resultado.get('iteracoes', 0),
                        'melhoria_percentual': resultado.get('melhoria_percentual', 0),
                        'qualidade': 'ótima' if resultado.get('melhoria_percentual', 0) > 10 else 'boa'
                    })
                except Exception as e:
                    print(f"  ❌ Erro com {algoritmo}: {e}")
                    resultados.append({
                        'algoritmo': algoritmo,
                        'erro': str(e)
                    })
            
            # Determinar melhor algoritmo (menor distância)
            resultados_validos = [r for r in resultados if 'erro' not in r]
            if resultados_validos:
                melhor = min(resultados_validos, key=lambda x: x.get('distancia_total', float('inf')))
                
                return Response({
                    'status': 'success',
                    'resultados': resultados,
                    'melhor_algoritmo': melhor.get('algoritmo'),
                    'economia_distancia': f"{melhor.get('melhoria_percentual', 0):.2f}%",
                    'recomendacao': f"Use {melhor.get('algoritmo')} para este caso"
                })
            else:
                return Response({
                    'status': 'error',
                    'message': 'Nenhum algoritmo conseguiu otimizar',
                    'resultados': resultados
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            print(f"❌ Erro ao comparar algoritmos: {e}")
            import traceback
            traceback.print_exc()
            
            return Response({
                'error': 'Erro ao comparar algoritmos',
                'detalhes': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)