// Opções de raio disponíveis - ADAPTADO PARA ZONA RURAL
export const RAIO_OPTIONS: RaioOption[] = [
    { label: "3 km - Propriedades próximas", value: 3 },
    { label: "5 km - Região local", value: 5 },
    { label: "8 km - Distrito/Comunidade", value: 8 },
    { label: "10 km - Zona rural expandida", value: 10 },
    { label: "15 km - Interior regional", value: 15 },
    { label: "20 km - Área rural ampla", value: 20 },
] as const;

// Raio padrão ao abrir o sistema (ajustado para rural - distâncias maiores)
export const RAIO_DEFAULT = 10;

// Paginação padrão
export const PAGE_SIZE_DEFAULT = 20;

// Coordenadas padrão (ajustar para o centro da sua região de atuação)
// Exemplo: região rural do interior do RS
export const COORDENADAS_DEFAULT = {
    latitude: -30.0346,  // Ajustar para seu município/região
    longitude: -51.2177,
    zoom: 11  // Zoom menor para cobrir área rural maior
} as const;

// Limites de capacidade
export const CAPACIDADE_LIMITES = {
    BAIXA: 70,      // < 70% - capacidade baixa
    MEDIA: 90,      // 70-90% - capacidade média
    ALTA: 100,      // 90-100% - capacidade alta
    EXCEDIDA: 100   // > 100% - excedida
} as const;

// Status para filtros rápidos
export const STATUS_FILTROS = [
    { value: "PLANEJADA", label: "Planejada" },
    { value: "EM_EXECUCAO", label: "Em Execução" },
    { value: "CONCLUIDA", label: "Concluída" },
] as const;
