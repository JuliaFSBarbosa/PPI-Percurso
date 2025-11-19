# logistics/views.py

from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404

# Imports dos modelos
from .models import Familia, Produto, Pedido, Rota

# Imports dos serializers
from .serializers import (
    FamiliaSerializer,
    ProdutoSerializer,
    PedidoSerializer,
    RotaSerializer
)

# Imports dos filtros
from .filters import FamiliaFilter, ProdutoFilter


# ==========================================
# ViewSets para Família
# ==========================================

class FamiliaViewSet(viewsets.ModelViewSet):
    """
    CRUD completo para Família
    """
    queryset = Familia.objects.filter(ativo=True).order_by('nome')
    serializer_class = FamiliaSerializer
    permission_classes = [AllowAny]
    filterset_class = FamiliaFilter
    ordering_fields = ['nome', 'created_at']
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']


# ==========================================
# ViewSets para Produto
# ==========================================

class ProdutoViewSet(viewsets.ModelViewSet):
    queryset = Produto.objects.filter(ativo=True).select_related('familia').order_by('nome')
    serializer_class = ProdutoSerializer
    permission_classes = [AllowAny]
    filterset_class = ProdutoFilter
    ordering_fields = ['nome', 'peso', 'created_at']
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']


# ==========================================
# ViewSet principal para leitura de Pedidos
# ==========================================

class PedidoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer

    def list(self, request):
        return Response(PedidoSerializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        pedido = get_object_or_404(Pedido, pk=pk)
        return Response(PedidoSerializer(pedido).data)


# ==========================================
# ViewSet principal para leitura de Rotas
# ==========================================

class RotaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Rota.objects.all()
    serializer_class = RotaSerializer


# ==========================================
# ViewSets de Administração (CRUD Completo)
# ==========================================

class PedidoCreateViewSet(viewsets.ModelViewSet):
    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer


class RotaCreateViewSet(viewsets.ModelViewSet):
    queryset = Rota.objects.all()
    serializer_class = RotaSerializer


# ==========================================
# View de Otimização - IA
# ==========================================

class OtimizarRotaView(APIView):
    """
    View para otimização de rotas usando IA
    """

    def post(self, request):
        try:
            pedidos = request.data.get('pedidos', [])
            deposito = request.data.get('deposito', {})
            capacidade = request.data.get('capacidade', 500)

            if len(pedidos) < 2:
                return Response(
                    {'error': 'É necessário pelo menos 2 pedidos'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Import dinâmica do módulo de IA
            try:
                from logistics.ia.tabu_search import otimizar_rota_completa
            except ImportError:
                return Response(
                    {'error': 'Módulo de IA não encontrado'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            resultado = otimizar_rota_completa(
                pedidos=pedidos,
                deposito=deposito,
                capacidade=capacidade,
                algoritmo='tabu_search',
                max_iteracoes=100,
                tamanho_tabu=10
            )

            return Response({
                'status': 'success',
                'distancia_inicial': resultado.get('distancia_inicial'),
                'distancia_otimizada': resultado.get('distancia'),
                'melhoria_percentual': resultado.get('melhoria_percentual'),
                'rota_otimizada': resultado.get('rota'),
                'tempo_execucao': resultado.get('tempo'),
                'iteracoes': resultado.get('iteracoes')
            })

        except Exception as e:
            return Response(
                {'error': 'Erro ao otimizar rota', 'detalhes': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


# ==========================================
# View para Comparar Algoritmos de IA
# ==========================================

class CompararAlgoritmosView(APIView):

    def post(self, request):
        try:
            pedidos = request.data.get('pedidos', [])
            algoritmos = request.data.get('algoritmos', ['tabu_search'])
            deposito = request.data.get('deposito', {})

            try:
                from logistics.ia.tabu_search import otimizar_rota_completa
            except ImportError:
                return Response(
                    {'error': 'Módulo de IA não encontrado'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            resultados = []

            for algoritmo in algoritmos:
                try:
                    resultado = otimizar_rota_completa(
                        pedidos=pedidos,
                        deposito=deposito,
                        capacidade=500,
                        algoritmo=algoritmo,
                        max_iteracoes=100
                    )

                    resultados.append({
                        'algoritmo': algoritmo,
                        'distancia_total': resultado.get('distancia'),
                        'melhoria_percentual': resultado.get('melhoria_percentual'),
                        'tempo_execucao': resultado.get('tempo'),
                        'iteracoes': resultado.get('iteracoes')
                    })

                except Exception as e:
                    resultados.append({
                        'algoritmo': algoritmo,
                        'erro': str(e)
                    })

            return Response({
                'status': 'success',
                'resultados': resultados
            })

        except Exception as e:
            return Response(
                {'error': 'Erro ao comparar algoritmos', 'detalhes': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
