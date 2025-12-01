from django.db import models
from accounts.models import User  # usando seu modelo de usuário customizado


class Familia(models.Model):
    nome = models.CharField(max_length=50, unique=True)
    descricao = models.TextField(blank=True, null=True)
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.nome
    
    class Meta:
        verbose_name = 'Família'
        verbose_name_plural = 'Famílias'


class Produto(models.Model):
    nome = models.CharField(max_length=50)
    peso = models.DecimalField(max_digits=10, decimal_places=3)
    volume = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    familia = models.ForeignKey(
        Familia, 
        related_name='produtos', 
        on_delete=models.PROTECT
    )
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.nome
    
    class Meta:
        verbose_name = 'Produto'
        verbose_name_plural = 'Produtos'


class Pedido(models.Model):
    # Relacionando pedido com seu modelo User
    usuario = models.ForeignKey(
        User, 
        related_name='pedidos_logistica', 
        on_delete=models.CASCADE,
        null=True, 
        blank=True  # Caso nem todos os pedidos precisem ter usuário associado
    )
    cliente = models.CharField(max_length=100, default="")
    cidade = models.CharField(max_length=100, default="", blank=True)
    nf = models.IntegerField(verbose_name='Nota Fiscal')
    observacao = models.CharField(max_length=100, blank=True, null=True)
    dtpedido = models.DateField(verbose_name='Data do Pedido')
    latitude = models.DecimalField(max_digits=10, decimal_places=6)
    longitude = models.DecimalField(max_digits=10, decimal_places=6)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Pedido {self.id} - NF {self.nf}"
    
    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        ordering = ['-created_at']


class ProdutoPedido(models.Model):
    produto = models.ForeignKey(
        Produto, 
        related_name='itens_pedido', 
        on_delete=models.CASCADE
    )
    pedido = models.ForeignKey(
        Pedido, 
        related_name='itens', 
        on_delete=models.CASCADE
    )
    quantidade = models.PositiveIntegerField()
    
    def __str__(self):
        return f"{self.produto.nome} - Pedido {self.pedido.id}"
    
    class Meta:
        unique_together = ('produto', 'pedido')
        verbose_name = 'Item do Pedido'
        verbose_name_plural = 'Itens dos Pedidos'


class Rota(models.Model):
    STATUS_CHOICES = [
        ('PLANEJADA', 'Planejada'),
        ('EM_EXECUCAO', 'Em execução'),
        ('CONCLUIDA', 'Concluída'),
    ]
    
    data_rota = models.DateField()
    capacidade_max = models.DecimalField(
        max_digits=10, 
        decimal_places=3,
        verbose_name='Capacidade Máxima'
    )
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='PLANEJADA'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Rota {self.id} - {self.data_rota}"
    
    @property
    def peso_total_pedidos(self):
        """Calcula o peso total dos produtos nos pedidos da rota"""
        peso_total = 0
        for rota_pedido in self.pedidos.all():
            for item in rota_pedido.pedido.itens.all():
                peso_total += item.produto.peso * item.quantidade
        return peso_total
    
    class Meta:
        verbose_name = 'Rota'
        verbose_name_plural = 'Rotas'
        ordering = ['-created_at']


class RotaPedido(models.Model):
    rota = models.ForeignKey(
        Rota, 
        related_name='pedidos', 
        on_delete=models.CASCADE
    )
    pedido = models.ForeignKey(
        Pedido, 
        related_name='rotas', 
        on_delete=models.CASCADE
    )
    ordem_entrega = models.PositiveIntegerField(verbose_name="Ordem de Entrega")
    entregue = models.BooleanField(default=False)
    data_entrega = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Rota {self.rota.id} - Pedido {self.pedido.id} (Ordem: {self.ordem_entrega})"
    
    class Meta:
        unique_together = ('rota', 'pedido')
        verbose_name = 'Pedido da Rota'
        verbose_name_plural = 'Pedidos das Rotas'
        ordering = ['rota', 'ordem_entrega']


class RotaTrajeto(models.Model):
    rota = models.ForeignKey(
        Rota, 
        related_name='trajetos', 
        on_delete=models.CASCADE
    )
    latitude = models.DecimalField(max_digits=10, decimal_places=6)  # Ajustado para 10 dígitos
    longitude = models.DecimalField(max_digits=10, decimal_places=6)  # Ajustado para 10 dígitos
    datahora = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Trajeto Rota {self.rota.id} - {self.datahora}"
    
    class Meta:
        verbose_name = 'Trajeto da Rota'
        verbose_name_plural = 'Trajetos das Rotas'
        ordering = ['rota', 'datahora']

# Adicione este model no seu models.py

class RestricaoFamilia(models.Model):
    """
    Define incompatibilidades entre famílias de produtos
    Exemplo: Alimentos não podem ser transportados com Produtos Químicos
    """
    familia_origem = models.ForeignKey(
        Familia,
        related_name='restricoes_como_origem',
        on_delete=models.CASCADE,
        verbose_name='Família de Origem'
    )
    familia_restrita = models.ForeignKey(
        Familia,
        related_name='restricoes_como_destino',
        on_delete=models.CASCADE,
        verbose_name='Família Incompatível'
    )
    motivo = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text='Motivo da incompatibilidade'
    )
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.familia_origem.nome} ≠ {self.familia_restrita.nome}"
    
    class Meta:
        verbose_name = 'Restrição de Família'
        verbose_name_plural = 'Restrições de Famílias'
        unique_together = ('familia_origem', 'familia_restrita')
        ordering = ['familia_origem__nome']
    
    def clean(self):
        """Validação customizada"""
        from django.core.exceptions import ValidationError
        
        # Não pode criar restrição de uma família com ela mesma
        if self.familia_origem == self.familia_restrita:
            raise ValidationError('Uma família não pode ser incompatível com ela mesma.')
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# ======================================================
# MÉTODO HELPER PARA VERIFICAR COMPATIBILIDADE
# ======================================================

def verificar_compatibilidade_familias(familias_pedido1, familias_pedido2):
    """
    Verifica se duas listas de famílias são compatíveis
    
    Args:
        familias_pedido1: Set ou List de IDs de famílias do pedido 1
        familias_pedido2: Set ou List de IDs de famílias do pedido 2
    
    Returns:
        tuple: (bool compatível, str motivo)
    """
    from logistics.models import RestricaoFamilia
    
    # Converte para sets
    fam1 = set(familias_pedido1)
    fam2 = set(familias_pedido2)
    
    # Busca restrições ativas
    restricoes = RestricaoFamilia.objects.filter(
        ativo=True,
        familia_origem_id__in=fam1,
        familia_restrita_id__in=fam2
    ).select_related('familia_origem', 'familia_restrita')
    
    if restricoes.exists():
        restricao = restricoes.first()
        motivo = restricao.motivo or f"{restricao.familia_origem.nome} incompatível com {restricao.familia_restrita.nome}"
        return False, motivo
    
    # Verifica também no sentido inverso
    restricoes_inversas = RestricaoFamilia.objects.filter(
        ativo=True,
        familia_origem_id__in=fam2,
        familia_restrita_id__in=fam1
    ).select_related('familia_origem', 'familia_restrita')
    
    if restricoes_inversas.exists():
        restricao = restricoes_inversas.first()
        motivo = restricao.motivo or f"{restricao.familia_origem.nome} incompatível com {restricao.familia_restrita.nome}"
        return False, motivo
    
    return True, ""


# ======================================================
# ATUALIZE O FILTRO PedidoFilter PARA USAR RESTRIÇÕES
# ======================================================

# No método filter_por_raio do PedidoFilter, substitua a seção de verificação:

def filter_por_raio(self, queryset, name, value):
    """
    Filtra pedidos dentro de um raio do pedido base
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
        
        # Busca as famílias dos produtos do pedido base
        familias_pedido_base = set(
            pedido_base.itens.values_list('produto__familia_id', flat=True)
        )
        
        pedidos_com_distancia = {}
        
        for pedido in queryset:
            if pedido.id == pedido_base_id:
                pedidos_com_distancia[pedido.id] = 0
                continue
            
            # ⭐ VERIFICA COMPATIBILIDADE DE FAMÍLIAS
            familias_pedido_atual = set(
                pedido.itens.values_list('produto__familia_id', flat=True)
            )
            
            compativel, motivo = verificar_compatibilidade_familias(
                familias_pedido_base,
                familias_pedido_atual
            )
            
            if not compativel:
                # Pula pedidos incompatíveis
                continue
            
            # Calcula distância
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
        
        # Armazena as distâncias no request
        if not hasattr(request, '_pedidos_distancias'):
            request._pedidos_distancias = {}
        request._pedidos_distancias = pedidos_com_distancia
        
        return queryset.filter(id__in=pedidos_com_distancia.keys())
        
    except (Pedido.DoesNotExist, ValueError):
        return queryset.none()
