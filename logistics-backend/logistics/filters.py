from django_filters import rest_framework as filters
from django.db.models import Q
from logistics.models import Familia, Produto, Pedido, Rota
import math


# =============================================================================
# FILTROS BÁSICOS
# =============================================================================

class FamiliaFilter(filters.FilterSet):
    """Filtro para famílias de produtos"""
    nome = filters.CharFilter(field_name="nome", lookup_expr="icontains")
    ativo = filters.BooleanFilter(field_name="ativo")
    
    class Meta:
        model = Familia
        fields = ['nome', 'ativo']


class ProdutoFilter(filters.FilterSet):
    """Filtro para produtos"""
    nome = filters.CharFilter(field_name="nome", lookup_expr="icontains")
    familia = filters.ModelChoiceFilter(queryset=Familia.objects.filter(ativo=True))
    peso_min = filters.NumberFilter(field_name="peso", lookup_expr="gte")
    peso_max = filters.NumberFilter(field_name="peso", lookup_expr="lte")
    ativo = filters.BooleanFilter(field_name="ativo")
    
    class Meta:
        model = Produto
        fields = ['nome', 'familia', 'peso_min', 'peso_max', 'ativo']


class PedidoFilter(filters.FilterSet):
    """
    Filtro para pedidos - funcionalidade principal do sistema
    """
    nf = filters.NumberFilter(field_name="nf")
    usuario = filters.CharFilter(field_name="usuario__name", lookup_expr="icontains")
    data_inicio = filters.DateFilter(field_name="dtpedido", lookup_expr="gte")
    data_fim = filters.DateFilter(field_name="dtpedido", lookup_expr="lte")
    disponivel_para_rota = filters.BooleanFilter(method='filter_disponivel_para_rota')
    familias = filters.BaseInFilter(field_name="itens__produto__familia__id", lookup_expr="in")
    
    # Filtros geográficos
    pedido_base = filters.NumberFilter(method='filter_por_raio')
    raio_km = filters.NumberFilter(method='filter_por_raio')
    
    def filter_disponivel_para_rota(self, queryset, name, value):
        """
        Filtro para mostrar apenas pedidos disponíveis para rota
        - True: pedidos que NÃO estão em nenhuma rota
        - False: pedidos que JÁ estão em alguma rota
        """
        if value:
            return queryset.filter(rotas__isnull=True)
        else:
            return queryset.filter(rotas__isnull=False).distinct()
    
    def calcular_distancia_km(self, lat1, lon1, lat2, lon2):
        """
        Calcula distância entre dois pontos usando fórmula de Haversine
        Retorna: distância em quilômetros
        """
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = (math.sin(dlat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2)
        c = 2 * math.asin(math.sqrt(a))
        
        raio_terra_km = 6371
        distancia = raio_terra_km * c
        return distancia
    
    def filter_por_raio(self, queryset, name, value):
        """
        ⭐ FILTRO PRINCIPAL: Filtra pedidos dentro de um raio do pedido base
        
        Como usar:
        GET /api/pedidos/?pedido_base=123&raio_km=5&disponivel_para_rota=true
        """
        request = self.request
        pedido_base_id = request.GET.get('pedido_base')
        raio_km = request.GET.get('raio_km')
        
        if not pedido_base_id or not raio_km:
            return queryset
        
        try:
            pedido_base_id = int(pedido_base_id)
            raio_km = float(raio_km)
            
            pedido_base = Pedido.objects.get(id=pedido_base_id)
            
            # ⭐ NOVO: Dicionário para armazenar distâncias
            pedidos_com_distancia = {}
            
            for pedido in queryset:
                if pedido.id == pedido_base_id:
                    pedidos_com_distancia[pedido.id] = 0  # Distância do próprio pedido é 0
                    continue
                
                distancia = self.calcular_distancia_km(
                    float(pedido_base.latitude),
                    float(pedido_base.longitude),
                    float(pedido.latitude),
                    float(pedido.longitude)
                )
                
                if distancia <= raio_km:
                    pedidos_com_distancia[pedido.id] = round(distancia, 2)
            
            # Sempre inclui o pedido base
            if pedido_base_id not in pedidos_com_distancia:
                pedidos_com_distancia[pedido_base_id] = 0
            
            # ⭐ NOVO: Armazena as distâncias no request para o serializer usar
            if not hasattr(request, '_pedidos_distancias'):
                request._pedidos_distancias = {}
            request._pedidos_distancias = pedidos_com_distancia
            
            return queryset.filter(id__in=pedidos_com_distancia.keys())
            
        except (Pedido.DoesNotExist, ValueError):
            return queryset.none()
    
    class Meta:
        model = Pedido
        fields = ['nf', 'usuario', 'data_inicio', 'data_fim', 
                 'disponivel_para_rota', 'familias', 'pedido_base', 'raio_km']


class RotaFilter(filters.FilterSet):
    """Filtro para rotas"""
    data_inicio = filters.DateFilter(field_name="data_rota", lookup_expr="gte")
    data_fim = filters.DateFilter(field_name="data_rota", lookup_expr="lte")
    status = filters.ChoiceFilter(choices=Rota.STATUS_CHOICES)
    capacidade_min = filters.NumberFilter(field_name="capacidade_max", lookup_expr="gte")
    capacidade_max = filters.NumberFilter(field_name="capacidade_max", lookup_expr="lte")
    
    class Meta:
        model = Rota
        fields = ['data_inicio', 'data_fim', 'status', 
                 'capacidade_min', 'capacidade_max']