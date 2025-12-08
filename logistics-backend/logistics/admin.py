from django.contrib import admin
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

# Registrar os models no admin
admin.site.register(Familia)
admin.site.register(Produto)
admin.site.register(Pedido)
admin.site.register(ProdutoPedido)
admin.site.register(PedidoRestricaoGrupo)
admin.site.register(RestricaoFamilia)
admin.site.register(Rota)
admin.site.register(RotaPedido)
admin.site.register(RotaTrajeto)
