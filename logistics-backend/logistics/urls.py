# logistics-backend/logistics/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .otimizacao_views import (
    CompararAlgoritmosView,
    GerarRelatorioRotaPDFView,
    OtimizarRotaGeneticoView,
    SalvarRotaOtimizadaView,
)
from .views import (
    AtribuirPedidosRotaView,
    DashboardResumoView,
    FamiliaViewSet,
    GerarPDFRotaView,
    PedidoCreateViewSet,
    PedidoViewSet,
    ProdutoViewSet,
    RemoverPedidoRotaView,
    RestricaoFamiliaViewSet,
    RotaCreateViewSet,
    RotaViewSet,
)

router = DefaultRouter()

# ViewSets de leitura (Read-Only)
router.register(r"familias", FamiliaViewSet, basename="familia")
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"pedidos", PedidoViewSet, basename="pedido")
router.register(r"rotas", RotaViewSet, basename="rota")
router.register(r"restricoes-familias", RestricaoFamiliaViewSet, basename="restricao-familia")

# ViewSets de escrita (Admin)
router.register(r"familias-admin", FamiliaViewSet, basename="familia-admin")
router.register(r"produtos-admin", ProdutoViewSet, basename="produto-admin")
router.register(r"pedidos-admin", PedidoCreateViewSet, basename="pedido-admin")
router.register(r"rotas-admin", RotaCreateViewSet, basename="rota-admin")

# Endpoints especificos devem vir antes do include do router para evitar conflitos (ex.: rotas/relatorio-pdf).
urlpatterns = [
    path("pedidos/atribuir-rota/", AtribuirPedidosRotaView.as_view(), name="atribuir-pedidos-rota"),
    path("pedidos/<int:pedido_id>/remover-rota/", RemoverPedidoRotaView.as_view(), name="remover-pedido-rota"),
    path("dashboard/resumo/", DashboardResumoView.as_view(), name="dashboard-resumo"),
    path("otimizar-rota-genetico/", OtimizarRotaGeneticoView.as_view(), name="otimizar-rota-genetico"),
    path("salvar-rota-otimizada/", SalvarRotaOtimizadaView.as_view(), name="salvar-rota-otimizada"),
    path("comparar-algoritmos/", CompararAlgoritmosView.as_view(), name="comparar-algoritmos"),
    path("rotas/relatorio-pdf/", GerarRelatorioRotaPDFView.as_view(), name="relatorio-rota-pdf"),
    path("gerar-pdf-rota/", GerarPDFRotaView.as_view(), name="gerar-pdf-rota"),
    path("", include(router.urls)),
]
