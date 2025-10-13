from django.contrib import admin
from logistics.models import (  
    Familia, Produto, Pedido, ProdutoPedido,
    Rota, RotaPedido, RotaTrajeto
)

# Registrar os models no admin
admin.site.register(Familia)
admin.site.register(Produto)
admin.site.register(Pedido)
admin.site.register(ProdutoPedido)
admin.site.register(Rota)
admin.site.register(RotaPedido)
admin.site.register(RotaTrajeto)