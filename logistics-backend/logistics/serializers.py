from rest_framework import serializers
from django.db.models import Sum, Count

from accounts.models import User
from logistics.models import (
    Familia,
    Pedido,
    PedidoRestricaoGrupo,
    Produto,
    ProdutoPedido,
    RestricaoFamilia,
    Rota,
    RotaPedido,
    RotaTrajeto,
)
from logistics.services.restricoes import (
    analisar_restricoes_para_itens_payload,
    aplicar_restricoes_no_pedido,
    normalizar_payload_pedidos,
    validar_novos_vinculos_em_rota,
)


def _montar_alerta_restricao(pedido: Pedido):
    grupos = (
        pedido.grupos_restricao.filter(ativo=True)
        .prefetch_related("familias")
        .order_by("titulo")
    )
    grupos = list(grupos)
    if not grupos:
        return None
    partes = []
    for grupo in grupos:
        nomes = ", ".join(grupo.familias.values_list("nome", flat=True))
        partes.append(f"{grupo.titulo}: {nomes or 'sem famílias definidas'}")
    return "Pedido repartido por restrições de família -> " + " | ".join(partes)


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


class RestricaoFamiliaSerializer(serializers.ModelSerializer):
    familia_origem = FamiliaSerializer(read_only=True)
    familia_restrita = FamiliaSerializer(read_only=True)
    familia_origem_id = serializers.IntegerField(write_only=True)
    familia_restrita_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = RestricaoFamilia
        fields = [
            "id",
            "familia_origem",
            "familia_origem_id",
            "familia_restrita",
            "familia_restrita_id",
            "motivo",
            "ativo",
            "created_at",
        ]


class PedidoRestricaoGrupoSerializer(serializers.ModelSerializer):
    familias = FamiliaSerializer(many=True, read_only=True)
    total_itens = serializers.SerializerMethodField()

    class Meta:
        model = PedidoRestricaoGrupo
        fields = ["id", "titulo", "ativo", "familias", "total_itens", "created_at"]

    def get_total_itens(self, obj):
        return obj.itens.count()


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
        fields = ['id', 'nome', 'peso', 'volume', 'familia_nome', 'familia_id']


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
    grupo_restricao = PedidoRestricaoGrupoSerializer(read_only=True)
    peso_total = serializers.SerializerMethodField()
    
    class Meta:
        model = ProdutoPedido
        fields = [
            'id',
            'produto',
            'produto_id',
            'quantidade',
            'peso_total',
            'grupo_restricao',
        ]
    
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

    itens = ProdutoPedidoSerializer(many=True, read_only=True)
    grupos_restricao = PedidoRestricaoGrupoSerializer(many=True, read_only=True)

    peso_total = serializers.SerializerMethodField()
    volume_total = serializers.SerializerMethodField()
    total_itens = serializers.SerializerMethodField()
    distancia_km = serializers.SerializerMethodField()
    rotas = serializers.SerializerMethodField()
    restricao_alerta = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            'id', 'usuario', 'usuario_id', 'cliente', 'cidade', 'nf', 'observacao', 'dtpedido',
            'latitude', 'longitude', 'created_at', 'itens', 'grupos_restricao', 'peso_total',
            'volume_total', 'total_itens', 'distancia_km', 'rotas', 'restricao_alerta'
        ]

    def get_peso_total(self, obj):
        total = 0
        for item in obj.itens.all():
            total += item.produto.peso * item.quantidade
        return total

    def get_volume_total(self, obj):
        total = 0
        for item in obj.itens.all():
            if item.produto.volume:
                total += item.produto.volume * item.quantidade
        return total

    def get_total_itens(self, obj):
        return obj.itens.aggregate(total=Sum('quantidade'))['total'] or 0

    def get_distancia_km(self, obj):
        return self.context.get('distancia_km', 0)

    def get_rotas(self, obj):
        try:
            rels = obj.rotas.all()
        except Exception:
            return []
        return [
            {
                "id": rp.rota.id,
                "status": rp.rota.status,
                "data_rota": rp.rota.data_rota,
                "grupo_restricao_id": rp.grupo_restricao_id,
            }
            for rp in rels
        ]

    def get_restricao_alerta(self, obj):
        alerta = getattr(obj, "_restricao_msg", None)
        if alerta:
            return alerta
        return _montar_alerta_restricao(obj)


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
            'id', 'nf', 'cliente', 'cidade', 'dtpedido', 'latitude', 'longitude',
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
    grupo_restricao = PedidoRestricaoGrupoSerializer(read_only=True)
    grupo_restricao_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = RotaPedido
        fields = [
            'id', 'pedido', 'pedido_id', 'grupo_restricao', 'grupo_restricao_id',
            'ordem_entrega', 'entregue', 'data_entrega'
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
    restricao_alerta = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Pedido
        fields = [
            'usuario_id', 'cliente', 'cidade', 'nf', 'observacao', 'dtpedido',
            'latitude', 'longitude', 'itens', 'restricao_alerta'
        ]

    def validate_nf(self, value):
        """
        Garante que a NF seja única mesmo antes do constraint do banco,
        permitindo mensagem amigável.
        """
        qs = Pedido.objects.filter(nf=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Nota Fiscal já cadastrada no sistema, verifique o número digitado!')
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        itens_data = attrs.get('itens') or []
        analise = analisar_restricoes_para_itens_payload(itens_data)
        self._analise_restricoes = analise
        if analise.get("possui_conflito") and not self.context.get("allow_family_conflicts"):
            raise serializers.ValidationError(
                {
                    "code": "familias_incompativeis",
                    "detail": analise.get("mensagem") or "Pedido possui produtos de famílias incompatíveis.",
                    "conflitos": analise.get("conflitos") or [],
                    "grupos": analise.get("grupos") or [],
                    "pode_dividir": True,
                }
            )
        return attrs

    @property
    def analise_restricoes(self):
        return getattr(self, "_analise_restricoes", None)
    
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
        resultado = aplicar_restricoes_no_pedido(pedido)
        if resultado.get("mensagem"):
            pedido._restricao_msg = resultado["mensagem"]
        return pedido

    def update(self, instance, validated_data):
        """
        Atualiza pedido e substitui itens pelo payload recebido.
        """
        itens_data = validated_data.pop('itens', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if itens_data is not None:
            # Remove itens antigos e recria conforme payload
            instance.itens.all().delete()
            for item_data in itens_data:
                ProdutoPedido.objects.create(
                    pedido=instance,
                    produto_id=item_data['produto_id'],
                    quantidade=item_data['quantidade']
                )
        resultado = aplicar_restricoes_no_pedido(instance)
        if resultado.get("mensagem"):
            instance._restricao_msg = resultado["mensagem"]
        return instance

    def get_restricao_alerta(self, obj):
        alerta = getattr(obj, "_restricao_msg", None)
        if alerta:
            return alerta
        return _montar_alerta_restricao(obj)


class RotaCreateSerializer(serializers.ModelSerializer):
    """
    Serializer especializado para CRIAR rotas com pedidos
    - Permite definir quais pedidos farão parte da rota
    - Define automaticamente a ordem de entrega
    - Cria relacionamentos RotaPedido automaticamente
    """
    # ListField: aceita uma lista de números inteiros (IDs dos pedidos)
    pedidos_ids = serializers.ListField(
        child=serializers.JSONField(),
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
        pedidos_payload = validated_data.pop('pedidos_ids', [])
        pedidos_normalizados = normalizar_payload_pedidos(pedidos_payload)

        vinculos = []
        for entry in pedidos_normalizados:
            pedido_id = entry["pedido_id"]
            try:
                pedido = Pedido.objects.get(pk=pedido_id)
            except Pedido.DoesNotExist as exc:
                raise serializers.ValidationError(f"Pedido {pedido_id} não encontrado.") from exc
            grupo = None
            grupo_id = entry.get("grupo_restricao_id")
            if grupo_id:
                try:
                    grupo = PedidoRestricaoGrupo.objects.get(pk=grupo_id, pedido=pedido)
                except PedidoRestricaoGrupo.DoesNotExist as exc:
                    raise serializers.ValidationError("Grupo informado não pertence ao pedido selecionado.") from exc
            elif pedido.grupos_restricao.filter(ativo=True).exists():
                raise serializers.ValidationError(
                    f"Pedido {pedido.id} está repartido em grupos. Informe o grupo para roteirização."
                )
            vinculos.append((pedido, grupo))

        validar_novos_vinculos_em_rota(vinculos)

        rota = Rota.objects.create(**validated_data)
        for ordem, (pedido, grupo) in enumerate(vinculos, 1):
            RotaPedido.objects.create(
                rota=rota,
                pedido=pedido,
                grupo_restricao=grupo,
                ordem_entrega=ordem
            )
        
        return rota
