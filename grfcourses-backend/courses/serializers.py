from rest_framework import serializers
from django.db.models import Sum, Count

from accounts.models import User
from courses.models import (
    Familia, Produto, Pedido, ProdutoPedido, 
    Rota, RotaPedido, RotaTrajeto
)


# =============================================================================
# SERIALIZERS BÁSICOS - Convertem models Django em JSON e vice-versa
# =============================================================================

class FamiliaSerializer(serializers.ModelSerializer):
    """
    Serializer para o modelo Familia
    - Converte dados da família de produtos entre Python/Django e JSON
    - Adiciona campo calculado 'total_produtos' que conta quantos produtos ativos existem
    """
    # SerializerMethodField permite criar campos calculados personalizados
    total_produtos = serializers.SerializerMethodField()
    
    class Meta:
        model = Familia  # Indica qual model este serializer representa
        fields = ['id', 'nome', 'descricao', 'ativo', 'created_at', 'total_produtos']
    
    def get_total_produtos(self, obj):
        """
        Método que calcula o total de produtos ativos desta família
        - obj: instância da Familia atual
        - Retorna: número inteiro com a contagem
        """
        return obj.produtos.filter(ativo=True).count()


class ProdutoSerializer(serializers.ModelSerializer):
    """
    Serializer para o modelo Produto
    - Gerencia a serialização/deserialização de produtos
    - Inclui relacionamento com Familia (mostra dados completos na leitura)
    - Permite enviar apenas o ID da família na escrita (mais eficiente)
    """
    # read_only=True: apenas para leitura (GET), não aceita na criação/edição
    familia = FamiliaSerializer(read_only=True)
    
    # write_only=True: apenas para escrita (POST/PUT), não aparece na resposta
    familia_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Produto
        fields = [
            'id', 'nome', 'peso', 'volume', 'familia', 'familia_id',
            'ativo', 'created_at'
        ]


class ProdutoSimpleSerializer(serializers.ModelSerializer):
    """
    Versão simplificada do ProdutoSerializer
    - Usado quando precisamos mostrar produto dentro de outros objetos
    - Evita consultas excessivas ao banco (N+1 queries)
    - source='familia.nome': acessa o nome da família através do relacionamento
    """
    familia_nome = serializers.CharField(source='familia.nome', read_only=True)
    
    class Meta:
        model = Produto
        fields = ['id', 'nome', 'peso', 'volume', 'familia_nome']


# =============================================================================
# SERIALIZERS DE RELACIONAMENTOS - Para tabelas de ligação (Many-to-Many)
# =============================================================================

class ProdutoPedidoSerializer(serializers.ModelSerializer):
    """
    Serializer para a tabela de relacionamento ProdutoPedido
    - Representa os itens dentro de um pedido
    - Mostra produto completo na leitura, aceita apenas ID na escrita
    - Calcula peso total do item (peso unitário × quantidade)
    """
    produto = ProdutoSimpleSerializer(read_only=True)
    produto_id = serializers.IntegerField(write_only=True)
    peso_total = serializers.SerializerMethodField()
    
    class Meta:
        model = ProdutoPedido
        fields = ['id', 'produto', 'produto_id', 'quantidade', 'peso_total']
    
    def get_peso_total(self, obj):
        """
        Calcula o peso total deste item do pedido
        - obj: instância do ProdutoPedido
        - Retorna: peso do produto × quantidade
        """
        return obj.produto.peso * obj.quantidade


class UsuarioSimpleSerializer(serializers.ModelSerializer):
    """
    Versão simplificada do usuário para usar em pedidos
    - Evita expor informações sensíveis do usuário
    - Mostra apenas dados básicos necessários
    """
    class Meta:
        model = User
        fields = ['id', 'name', 'email']


# =============================================================================
# SERIALIZERS PRINCIPAIS - Para as entidades principais do sistema
# =============================================================================

class PedidoSerializer(serializers.ModelSerializer):
    """
    Serializer principal para Pedidos
    - Inclui todos os relacionamentos (usuário, itens)
    - Calcula totais automaticamente (peso, volume, quantidade)
    - Permite criar pedido sem usuário (usuario_id é opcional)
    """
    usuario = UsuarioSimpleSerializer(read_only=True)
    usuario_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    # many=True: indica que são múltiplos itens relacionados
    itens = ProdutoPedidoSerializer(many=True, read_only=True)
    
    # Campos calculados para estatísticas do pedido
    peso_total = serializers.SerializerMethodField()
    volume_total = serializers.SerializerMethodField()
    total_itens = serializers.SerializerMethodField()
    distancia_km = serializers.SerializerMethodField()
    
    class Meta:
        model = Pedido
        fields = [
            'id', 'usuario', 'usuario_id', 'nf', 'observacao', 'dtpedido',
            'latitude', 'longitude', 'created_at', 'itens', 'peso_total',
            'volume_total', 'total_itens'
        ]
    
    def get_peso_total(self, obj):
        """
        Calcula peso total de todos os itens do pedido
        - Loop através de todos os itens
        - Soma peso unitário × quantidade de cada item
        """
        total = 0
        for item in obj.itens.all():
            total += item.produto.peso * item.quantidade
        return total
    
    def get_volume_total(self, obj):
        """
        Calcula volume total de todos os itens do pedido
        - Considera apenas produtos que têm volume definido
        - Alguns produtos podem não ter volume (ex: serviços)
        """
        total = 0
        for item in obj.itens.all():
            if item.produto.volume:  # Verifica se o produto tem volume
                total += item.produto.volume * item.quantidade
        return total
    
    def get_total_itens(self, obj):
        """
        Conta total de itens no pedido (soma das quantidades)
        - aggregate(): função do Django para cálculos no banco
        - Sum('quantidade'): soma todos os valores da coluna quantidade
        """
        return obj.itens.aggregate(total=Sum('quantidade'))['total'] or 0


    def get_distancia_km(self, obj):
    # Calcular distância do pedido base se estiver no contexto
     return self.context.get('distancia_km', 0)


class PedidoSimpleSerializer(serializers.ModelSerializer):
    """
    Versão simplificada do pedido para usar em listas e relacionamentos
    - Não inclui os itens (evita consultas pesadas)
    - Mostra apenas dados essenciais
    """
    usuario_nome = serializers.CharField(source='usuario.name', read_only=True)
    
    class Meta:
        model = Pedido
        fields = [
            'id', 'nf', 'dtpedido', 'latitude', 'longitude', 
            'usuario_nome', 'observacao'
        ]


# =============================================================================
# SERIALIZERS DE ROTA E LOGÍSTICA
# =============================================================================

class RotaTrajetoSerializer(serializers.ModelSerializer):
    """
    Serializer para pontos do trajeto da rota
    - Representa coordenadas GPS por onde a rota passou
    - Usado para rastreamento e histórico de movimento
    """
    class Meta:
        model = RotaTrajeto
        fields = ['id', 'latitude', 'longitude', 'datahora']


class RotaPedidoSerializer(serializers.ModelSerializer):
    """
    Serializer para o relacionamento Rota-Pedido
    - Define a ordem de entrega dos pedidos na rota
    - Controla status de entrega de cada pedido
    """
    pedido = PedidoSimpleSerializer(read_only=True)
    pedido_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = RotaPedido
        fields = [
            'id', 'pedido', 'pedido_id', 'ordem_entrega', 
            'entregue', 'data_entrega'
        ]


class RotaSerializer(serializers.ModelSerializer):
    """
    Serializer principal para Rotas de entrega
    - Inclui todos os pedidos da rota ordenados
    - Inclui trajeto GPS completo
    - Calcula estatísticas da rota (peso, entregas, percentuais)
    """
    pedidos = RotaPedidoSerializer(many=True, read_only=True)
    trajetos = RotaTrajetoSerializer(many=True, read_only=True)
    
    # ReadOnlyField: lê propriedade do modelo (não precisa de método get_)
    peso_total_pedidos = serializers.ReadOnlyField()
    
    # Campos calculados para dashboard e relatórios
    total_pedidos = serializers.SerializerMethodField()
    pedidos_entregues = serializers.SerializerMethodField()
    percentual_entrega = serializers.SerializerMethodField()
    
    class Meta:
        model = Rota
        fields = [
            'id', 'data_rota', 'capacidade_max', 'status', 'created_at',
            'updated_at', 'pedidos', 'trajetos', 'peso_total_pedidos',
            'total_pedidos', 'pedidos_entregues', 'percentual_entrega'
        ]
    
    def get_total_pedidos(self, obj):
        """Conta quantos pedidos estão na rota"""
        return obj.pedidos.count()
    
    def get_pedidos_entregues(self, obj):
        """Conta quantos pedidos já foram entregues"""
        return obj.pedidos.filter(entregue=True).count()
    
    def get_percentual_entrega(self, obj):
        """
        Calcula percentual de pedidos entregues
        - Evita divisão por zero
        - Retorna valor arredondado com 1 casa decimal
        """
        total = obj.pedidos.count()
        if total == 0:
            return 0
        entregues = obj.pedidos.filter(entregue=True).count()
        return round((entregues / total) * 100, 1)


class RotaSimpleSerializer(serializers.ModelSerializer):
    """
    Versão simplificada da rota para listagens rápidas
    - Usado em tabelas e seletores
    - Evita carregar pedidos e trajetos completos
    """
    total_pedidos = serializers.SerializerMethodField()
    peso_total = serializers.ReadOnlyField(source='peso_total_pedidos')
    
    class Meta:
        model = Rota
        fields = [
            'id', 'data_rota', 'capacidade_max', 'status', 
            'total_pedidos', 'peso_total'
        ]
    
    def get_total_pedidos(self, obj):
        return obj.pedidos.count()


# =============================================================================
# SERIALIZERS PARA CRIAÇÃO - Com relacionamentos aninhados
# =============================================================================

class PedidoCreateSerializer(serializers.ModelSerializer):
    """
    Serializer especializado para CRIAR pedidos com itens
    - Permite enviar pedido + lista de itens em uma única requisição
    - Gerencia a criação de múltiplos ProdutoPedido automaticamente
    - Transação: se algum item falhar, toda a criação é cancelada
    """
    # write_only: itens só são enviados na criação, não aparecem na resposta
    itens = ProdutoPedidoSerializer(many=True, write_only=True)
    
    class Meta:
        model = Pedido
        fields = [
            'usuario_id', 'nf', 'observacao', 'dtpedido',
            'latitude', 'longitude', 'itens'
        ]
    
    def create(self, validated_data):
        """
        Método personalizado para criar pedido com itens
        - validated_data: dados já validados pelo serializer
        - pop(): remove 'itens' dos dados e retorna a lista
        - Cria primeiro o pedido, depois os itens relacionados
        """
        # Remove lista de itens dos dados principais
        itens_data = validated_data.pop('itens')
        
        # Cria o pedido principal
        pedido = Pedido.objects.create(**validated_data)
        
        # Cria cada item do pedido
        for item_data in itens_data:
            ProdutoPedido.objects.create(
                pedido=pedido,
                produto_id=item_data['produto_id'],
                quantidade=item_data['quantidade']
            )
        
        return pedido


class RotaCreateSerializer(serializers.ModelSerializer):
    """
    Serializer especializado para CRIAR rotas com pedidos
    - Permite definir quais pedidos farão parte da rota
    - Define automaticamente a ordem de entrega
    - Cria relacionamentos RotaPedido automaticamente
    """
    # ListField: aceita uma lista de números inteiros (IDs dos pedidos)
    pedidos_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False  # Rota pode ser criada vazia e pedidos adicionados depois
    )
    
    class Meta:
        model = Rota
        fields = [
            'data_rota', 'capacidade_max', 'status', 'pedidos_ids'
        ]
    
    def create(self, validated_data):
        """
        Método personalizado para criar rota com pedidos
        - enumerate(lista, 1): gera números sequenciais começando em 1
        - Cria automaticamente a ordem de entrega baseada na sequência
        """
        pedidos_ids = validated_data.pop('pedidos_ids', [])
        
        # Cria a rota principal
        rota = Rota.objects.create(**validated_data)
        
        # Adiciona cada pedido à rota com ordem sequencial
        for ordem, pedido_id in enumerate(pedidos_ids, 1):
            RotaPedido.objects.create(
                rota=rota,
                pedido_id=pedido_id,
                ordem_entrega=ordem
            )
        
        return rota

