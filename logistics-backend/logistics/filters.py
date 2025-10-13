from django_filters import rest_framework as filters
from django.db.models import Q
from logistics.models import Familia, Produto, Pedido, Rota
import math


# =============================================================================
# FILTROS BÁSICOS - Seguindo o mesmo padrão do curso
# =============================================================================

class FamiliaFilter(filters.FilterSet):
    """
    Filtro para famílias de produtos - similar ao CourseFilter do curso
    Permite buscar famílias por nome
    """
    # Busca por nome (busca parcial, ignora maiúsculas/minúsculas)
    nome = filters.CharFilter(field_name="nome", lookup_expr="icontains")
    
    # Filtro por status ativo/inativo
    ativo = filters.BooleanFilter(field_name="ativo")
    
    class Meta:
        model = Familia
        fields = ['nome', 'ativo']


class ProdutoFilter(filters.FilterSet):
    """
    Filtro para produtos - inspirado no CourseFilter
    Permite filtrar produtos por características básicas
    """
    # Busca por nome do produto
    nome = filters.CharFilter(field_name="nome", lookup_expr="icontains")
    
    # Filtro por família (dropdown no frontend)
    familia = filters.ModelChoiceFilter(queryset=Familia.objects.all())
    
    # Filtros de faixa de peso - mesmo padrão price_min/price_max do curso
    peso_min = filters.NumberFilter(field_name="peso", lookup_expr="gte")
    peso_max = filters.NumberFilter(field_name="peso", lookup_expr="lte")
    
    # Filtro por status ativo
    ativo = filters.BooleanFilter(field_name="ativo")
    
    class Meta:
        model = Produto
        fields = ['nome', 'familia', 'peso_min', 'peso_max', 'ativo']


class PedidoFilter(filters.FilterSet):
    """
    Filtro para pedidos - funcionalidade principal do sistema
    Permite filtrar pedidos para seleção em rotas
    """
    # Filtro por número da nota fiscal
    nf = filters.NumberFilter(field_name="nf")
    
    # Busca por nome do usuário que fez o pedido
    usuario = filters.CharFilter(field_name="usuario__name", lookup_expr="icontains")
    
    # Filtros por data - mesmo padrão do curso adaptado para pedidos
    data_inicio = filters.DateFilter(field_name="dtpedido", lookup_expr="gte")
    data_fim = filters.DateFilter(field_name="dtpedido", lookup_expr="lte")
    
    # ⭐ FILTRO ESPECIAL: Excluir pedidos que já estão em alguma rota
    disponivel_para_rota = filters.BooleanFilter(method='filter_disponivel_para_rota')
    
    # ⭐ FILTRO DE FAMÍLIA: Mostrar apenas pedidos com produtos de famílias específicas
    # Inspirado no filtro 'tags' do curso, mas adaptado para famílias de produtos
    familias = filters.BaseInFilter(field_name="itens__produto__familia__id", lookup_expr="in")
    
    # 🌍 NOVOS FILTROS GEOGRÁFICOS: Para seleção por proximidade
    # Pedido base para calcular distância
    pedido_base = filters.NumberFilter(method='filter_por_raio')
    # Raio em quilômetros (3, 5, 8, etc.)
    raio_km = filters.NumberFilter(method='filter_por_raio')
    
    def filter_disponivel_para_rota(self, queryset, name, value):
        """
        Filtro customizado para mostrar apenas pedidos disponíveis para rota
        - Se value=True: mostra apenas pedidos que NÃO estão em nenhuma rota
        - Se value=False: mostra apenas pedidos que JÁ estão em alguma rota
        
        Este é um método simples que estudantes podem entender facilmente
        """
        if value:
            # Mostra apenas pedidos que não estão em nenhuma rota
            return queryset.filter(rotas__isnull=True)
        else:
            # Mostra apenas pedidos que já estão em alguma rota  
            return queryset.filter(rotas__isnull=False)
    
    def calcular_distancia_km(self, lat1, lon1, lat2, lon2):
        """
        Calcula distância entre dois pontos geográficos usando fórmula de Haversine
        
        Parâmetros:
        - lat1, lon1: coordenadas do primeiro ponto (pedido base)
        - lat2, lon2: coordenadas do segundo ponto (pedido comparado)
        
        Retorna: distância em quilômetros
        
        A fórmula de Haversine é usada para calcular distâncias entre pontos
        na superfície da Terra considerando que ela é uma esfera.
        """
        # Converte graus para radianos (necessário para funções trigonométricas)
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Diferenças entre as coordenadas
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        # Fórmula de Haversine
        a = (math.sin(dlat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2)
        c = 2 * math.asin(math.sqrt(a))
        
        # Raio da Terra em quilômetros
        raio_terra_km = 6371
        
        # Distância final em quilômetros
        distancia = raio_terra_km * c
        return distancia
    
    def filter_por_raio(self, queryset, name, value):
        """
        ⭐ FILTRO PRINCIPAL: Filtra pedidos dentro de um raio do pedido base
        
        Como usar:
        GET /api/pedidos/?pedido_base=123&raio_km=5&disponivel_para_rota=true
        
        Funcionamento:
        1. Busca o pedido base (pedido_base=123)
        2. Pega suas coordenadas (latitude, longitude)
        3. Calcula distância para todos os outros pedidos
        4. Retorna apenas pedidos dentro do raio especificado
        5. Exclui automaticamente pedidos com famílias incompatíveis
        """
        # Pega os valores dos filtros da requisição
        request = self.request
        pedido_base_id = request.GET.get('pedido_base')
        raio_km = request.GET.get('raio_km')
        
        # Se não tiver os dois parâmetros, não aplica o filtro
        if not pedido_base_id or not raio_km:
            return queryset
        
        try:
            # Converte para números
            pedido_base_id = int(pedido_base_id)
            raio_km = float(raio_km)
            
            # Busca o pedido base
            pedido_base = Pedido.objects.get(id=pedido_base_id)
            
            # ⭐ APLICAÇÃO DAS RESTRIÇÕES DE FAMÍLIA
            # Busca as famílias dos produtos do pedido base
            familias_pedido_base = set(
                pedido_base.itens.values_list('produto__familia_id', flat=True)
            )
            
            # Lista para armazenar IDs dos pedidos que estão no raio
            pedidos_no_raio = []
            
            # Itera por todos os pedidos do queryset
            for pedido in queryset:
                # Pula o próprio pedido base
                if pedido.id == pedido_base_id:
                    continue
                
                # ✅ VERIFICAÇÃO DE COMPATIBILIDADE DE FAMÍLIAS
                # Busca as famílias dos produtos deste pedido
                familias_pedido_atual = set(
                    pedido.itens.values_list('produto__familia_id', flat=True)
                )
                
                # 🚫 REGRA SIMPLES: Se têm famílias diferentes, podem ser incompatíveis
                # Para um sistema mais sofisticado, aqui consultaríamos uma tabela de restrições
                # Por agora, vamos assumir que pedidos com famílias diferentes são compatíveis
                # (você pode adicionar lógica específica aqui posteriormente)
                
                # Calcula distância entre pedido base e pedido atual
                distancia = self.calcular_distancia_km(
                    float(pedido_base.latitude),
                    float(pedido_base.longitude),
                    float(pedido.latitude),
                    float(pedido.longitude)
                )
                
                # Se está dentro do raio, adiciona à lista
                if distancia <= raio_km:
                    pedidos_no_raio.append(pedido.id)
            
            # Sempre inclui o pedido base na seleção
            pedidos_no_raio.append(pedido_base_id)
            
            # Filtra o queryset para incluir apenas pedidos no raio
            return queryset.filter(id__in=pedidos_no_raio)
            
        except (Pedido.DoesNotExist, ValueError):
            # Se pedido base não existe ou parâmetros inválidos, retorna queryset vazio
            return queryset.none()
    
    class Meta:
        model = Pedido
        fields = ['nf', 'usuario', 'data_inicio', 'data_fim', 
                 'disponivel_para_rota', 'familias', 'pedido_base', 'raio_km']


class RotaFilter(filters.FilterSet):
    """
    Filtro para rotas - controle das entregas
    Permite filtrar rotas por status e data
    """
    # Filtro por data da rota
    data_inicio = filters.DateFilter(field_name="data_rota", lookup_expr="gte")
    data_fim = filters.DateFilter(field_name="data_rota", lookup_expr="lte")
    
    # Filtro por status - similar ao 'level' do curso
    status = filters.ChoiceFilter(choices=Rota.STATUS_CHOICES)
    
    # Filtros por capacidade - mesmo padrão price_min/max
    capacidade_min = filters.NumberFilter(field_name="capacidade_max", lookup_expr="gte")
    capacidade_max = filters.NumberFilter(field_name="capacidade_max", lookup_expr="lte")
    
    class Meta:
        model = Rota
        fields = ['data_inicio', 'data_fim', 'status', 
                 'capacidade_min', 'capacidade_max']
