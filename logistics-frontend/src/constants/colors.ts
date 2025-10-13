export const statusColors: Record<RotaStatus, string> = {
    PLANEJADA: "#438efe",      // Azul - igual ao beginner do curso
    EM_EXECUCAO: "#feb134",    // Laranja - igual ao intermediate do curso
    CONCLUIDA: "#10b981",      // Verde - sucesso
} as const;

// Cores para indicadores de capacidade
export const capacidadeColors = {
    baixa: "#10b981",      // Verde - < 70%
    media: "#feb134",      // Laranja - 70-90%
    alta: "#fc624a",       // Vermelho - > 90%
    excedida: "#dc2626",   // Vermelho escuro - > 100%
} as const;

// Cores para raio no mapa - ADAPTADO PARA CONTEXTO RURAL
export const raioColors = {
    selected: "#438efe",     // Azul - pedido base selecionado
    available: "#10b981",    // Verde - propriedades disponíveis
    unavailable: "#6b7280",  // Cinza - propriedades indisponíveis
    rural: "#84cc16",        // Verde limão - zona rural
} as const;