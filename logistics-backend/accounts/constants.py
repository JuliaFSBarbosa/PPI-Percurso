COMMON_FEATURES = [
    {"id": "visualizar", "label": "Visualizar"},
    {"id": "criar", "label": "Criar"},
    {"id": "editar", "label": "Editar"},
    {"id": "excluir", "label": "Excluir"},
]

SCREEN_DEFINITIONS = [
    {
        "id": "inicio",
        "label": "Início",
        "routes": ["/inicio", "/inicio/padrao"],
        "features": [{"id": "visualizar", "label": "Visualizar"}],
    },
    {
        "id": "rotas",
        "label": "Rotas",
        "routes": ["/rotas"],
        "features": list(COMMON_FEATURES),
    },
    {
        "id": "pedidos",
        "label": "Pedidos",
        "routes": ["/pedidos", "/entregas"],
        "features": list(COMMON_FEATURES),
    },
    {
        "id": "produtos",
        "label": "Produtos",
        "routes": ["/produtos"],
        "features": list(COMMON_FEATURES),
    },
    {
        "id": "usuarios",
        "label": "Usuários",
        "routes": ["/configuracoes"],
        "features": list(COMMON_FEATURES),
    },
]


SCREEN_IDS = [screen["id"] for screen in SCREEN_DEFINITIONS]
SCREEN_FEATURES = {
    screen["id"]: [feature["id"] for feature in screen.get("features", [])]
    for screen in SCREEN_DEFINITIONS
}
DEFAULT_PROFILE_NAME = "Usuário padrão"
DEFAULT_PROFILE_PERMISSIONS = ["inicio", "rotas"]
DEFAULT_PROFILE_FEATURE_PERMISSIONS = {
    screen_id: SCREEN_FEATURES.get(screen_id, [])
    for screen_id in DEFAULT_PROFILE_PERMISSIONS
}
ADMIN_PROFILE_NAME = "Administrador"
ADMIN_PROFILE_PERMISSIONS = SCREEN_IDS
ADMIN_PROFILE_FEATURE_PERMISSIONS = {
    screen_id: SCREEN_FEATURES.get(screen_id, [])
    for screen_id in SCREEN_IDS
}
