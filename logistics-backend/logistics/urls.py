# logistics-backend/logistics/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FamiliaViewSet,
    ProdutoViewSet,
    PedidoViewSet,
    RotaViewSet,
    PedidoCreateViewSet,
    RotaCreateViewSet,
    GerarPDFRotaView,
    AtribuirPedidosRotaView,
    RemoverPedidoRotaView,
)
from .otimizacao_views import (
    OtimizarRotaGeneticoView,
    SalvarRotaOtimizadaView,
    CompararAlgoritmosView,
)

router = DefaultRouter()

# ViewSets de leitura (Read-Only)
router.register(r'familias', FamiliaViewSet, basename='familia')
router.register(r'produtos', ProdutoViewSet, basename='produto')
router.register(r'pedidos', PedidoViewSet, basename='pedido')
router.register(r'rotas', RotaViewSet, basename='rota')

# ViewSets de escrita (Admin)
router.register(r'familias-admin', FamiliaViewSet, basename='familia-admin')
router.register(r'produtos-admin', ProdutoViewSet, basename='produto-admin')
router.register(r'pedidos-admin', PedidoCreateViewSet, basename='pedido-admin')
router.register(r'rotas-admin', RotaCreateViewSet, basename='rota-admin')

urlpatterns = [
    path('', include(router.urls)),

    # Atribuir/remover pedidos em rotas
    path('pedidos/atribuir-rota/', AtribuirPedidosRotaView.as_view(), name='atribuir-pedidos-rota'),
    path('pedidos/<int:pedido_id>/remover-rota/', RemoverPedidoRotaView.as_view(), name='remover-pedido-rota'),
    
    # Rotas de Otimização com Algoritmo Genético
    path('otimizar-rota-genetico/', OtimizarRotaGeneticoView.as_view(), name='otimizar-rota-genetico'),
    path('salvar-rota-otimizada/', SalvarRotaOtimizadaView.as_view(), name='salvar-rota-otimizada'),
    path('comparar-algoritmos/', CompararAlgoritmosView.as_view(), name='comparar-algoritmos'),
    
    # Geração de PDF
    path('gerar-pdf-rota/', GerarPDFRotaView.as_view(), name='gerar-pdf-rota'),
]
