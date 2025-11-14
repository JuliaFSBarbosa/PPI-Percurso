# logistics/urls.py
# ATUALIZAR o arquivo existente adicionando as novas rotas

from rest_framework.routers import DefaultRouter
from django.urls import path
from logistics.views import (
    FamiliaViewSet, ProdutoViewSet, PedidoViewSet, RotaViewSet,
    PedidoCreateViewSet, RotaCreateViewSet,
    # ✅ NOVOS IMPORTS
    OtimizarRotaView,
    CompararAlgoritmosView
)

router = DefaultRouter()

# ViewSets apenas leitura (GET)
router.register(r'familias', FamiliaViewSet, basename="familia")
router.register(r'produtos', ProdutoViewSet, basename="produto")
router.register(r'pedidos', PedidoViewSet, basename="pedido")
router.register(r'rotas', RotaViewSet, basename="rota")

# ViewSets para criação (POST/PUT/DELETE)
router.register(r'pedidos-admin', PedidoCreateViewSet, basename="pedido-admin")
router.register(r'rotas-admin', RotaCreateViewSet, basename="rota-admin")

# ✅ NOVAS ROTAS DE OTIMIZAÇÃO
urlpatterns = router.urls + [
    path('otimizar-rota/', OtimizarRotaView.as_view(), name='otimizar-rota'),
    path('comparar-algoritmos/', CompararAlgoritmosView.as_view(), name='comparar-algoritmos'),
]