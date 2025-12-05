SCREEN_DEFINITIONS = [
    {
        "id": "inicio",
        "label": "Início",
        "routes": ["/inicio", "/inicio/padrao"],
    },
    {
        "id": "rotas",
        "label": "Rotas",
        "routes": ["/rotas"],
    },
    {
        "id": "pedidos",
        "label": "Pedidos",
        "routes": ["/pedidos", "/entregas"],
    },
    {
        "id": "produtos",
        "label": "Produtos",
        "routes": ["/produtos"],
    },
    {
        "id": "usuarios",
        "label": "Usuários",
        "routes": ["/configuracoes"],
    },
]


SCREEN_IDS = [screen["id"] for screen in SCREEN_DEFINITIONS]
DEFAULT_PROFILE_NAME = "Usuário padrão"
DEFAULT_PROFILE_PERMISSIONS = ["inicio", "rotas"]
ADMIN_PROFILE_NAME = "Administrador"
ADMIN_PROFILE_PERMISSIONS = SCREEN_IDS
