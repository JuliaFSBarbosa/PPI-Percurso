from rest_framework.routers import DefaultRouter
from courses.views import (
    FamiliaViewSet, ProdutoViewSet, PedidoViewSet, RotaViewSet,
    PedidoCreateViewSet, RotaCreateViewSet
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

urlpatterns = router.urls
