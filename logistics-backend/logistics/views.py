from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from logistics.filters import FamiliaFilter, ProdutoFilter, PedidoFilter, RotaFilter
from logistics.models import Familia, Produto, Pedido, Rota
from logistics.serializers import (
    FamiliaSerializer, ProdutoSerializer, PedidoSerializer, 
    RotaSerializer, PedidoCreateSerializer, RotaCreateSerializer
)


# =============================================================================
# VIEWSETS BÁSICAS - Seguindo o padrão do LogisticsViewSet do curso
# =============================================================================

class FamiliaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para famílias de produtos
    - ReadOnlyModelViewSet: apenas leitura (GET), não permite criar/editar
    - Mesmo padrão do LogisticsViewSet do curso
    """
    queryset = Familia.objects.filter(ativo=True).order_by('nome')
    serializer_class = FamiliaSerializer
    permission_classes = [AllowAny]  # Qualquer usuário pode ver famílias
    filterset_class = FamiliaFilter
    ordering_fields = ['nome', 'created_at']  # ?ordering=nome ou ?ordering=-created_at


class ProdutoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para produtos
    - Filtra apenas produtos ativos por padrão
    - Ordena por nome para facilitar busca
    """
    queryset = Produto.objects.filter(ativo=True).select_related('familia').order_by('nome')
    serializer_class = ProdutoSerializer
    permission_classes = [AllowAny]
    filterset_class = ProdutoFilter
    ordering_fields = ['nome', 'peso', 'created_at']  # ?ordering=peso


# =============================================================================
# VIEWSET PRINCIPAL - Para seleção de pedidos e montagem de rotas
# =============================================================================

class PedidoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ⭐ ViewSet PRINCIPAL do sistema
    - Permite listar e visualizar pedidos
    - Inclui filtro por raio geográfico
    - Usado principalmente para SELEÇÃO de pedidos para rotas
    
    Seguindo exatamente o padrão do CourseViewSet:
    - ReadOnlyModelViewSet (apenas leitura)
    - AllowAny (qualquer usuário pode ver)
    - Filtros e ordenação configurados
    """
    queryset = Pedido.objects.all().select_related('usuario').prefetch_related('itens__produto').order_by('-created_at')
    serializer_class = PedidoSerializer
    permission_classes = [AllowAny]
    filterset_class = PedidoFilter  # ← Inclui o filtro por raio que criamos
    ordering_fields = ['dtpedido', 'nf', 'created_at']  # ?ordering=-dtpedido


class RotaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para visualizar rotas criadas
    - Lista rotas com seus pedidos e estatísticas
    - Inclui trajetos GPS para acompanhamento
    """
    queryset = Rota.objects.all().prefetch_related('pedidos__pedido', 'trajetos').order_by('-created_at')
    serializer_class = RotaSerializer
    permission_classes = [AllowAny]
    filterset_class = RotaFilter
    ordering_fields = ['data_rota', 'status', 'created_at']  # ?ordering=data_rota


# =============================================================================
# VIEWSETS PARA OPERAÇÕES DE ESCRITA (se necessário no futuro)
# =============================================================================

class PedidoCreateViewSet(viewsets.ModelViewSet):
    """
    ViewSet para CRIAR pedidos (operação completa)
    - Permite POST com itens aninhados
    - Usa serializer especializado para criação
    
    Nota: Esta ViewSet seria usada por um painel administrativo
    ou sistema interno, não pela interface de seleção de rotas
    """
    queryset = Pedido.objects.all()
    permission_classes = [AllowAny]  # Em produção, usar IsAuthenticated
    
    def get_serializer_class(self):
        """
        Retorna serializer apropriado para cada ação
        - CREATE/UPDATE: usa PedidoCreateSerializer (permite itens aninhados)
        - LIST/RETRIEVE: usa PedidoSerializer (com dados completos)
        """
        if self.action in ['create', 'update']:
            return PedidoCreateSerializer
        return PedidoSerializer


class RotaCreateViewSet(viewsets.ModelViewSet):
    """
    ViewSet para CRIAR e GERENCIAR rotas
    - Permite criar rota com lista de pedidos
    - Permite atualizar status da rota
    - Usado pelo sistema de gerenciamento de entregas
    """
    queryset = Rota.objects.all()
    permission_classes = [AllowAny]  # Em produção, usar IsAuthenticated
    
    def get_serializer_class(self):
        """
        Serializer apropriado para cada ação
        - CREATE: usa RotaCreateSerializer (criação com pedidos)
        - LIST/RETRIEVE: usa RotaSerializer (dados completos)
        """
        if self.action in ['create', 'update']:
            return RotaCreateSerializer
        return RotaSerializer


