export const statusLabels: Record<RotaStatus, string> = {
    PLANEJADA: "Planejada",
    EM_EXECUCAO: "Em Execução",
    CONCLUIDA: "Concluída"
} as const;

// Labels para opções de raio - ADAPTADO PARA ZONA RURAL/INTERIOR
export const raioLabels: Record<number, string> = {
    3: "3 km - Propriedades próximas",
    5: "5 km - Região local",
    8: "8 km - Distrito/Comunidade",
    10: "10 km - Zona rural expandida",
    15: "15 km - Interior regional",
    20: "20 km - Área rural ampla"
} as const;

// Labels curtos para raio (dropdowns)
export const raioLabelsShort: Record<number, string> = {
    3: "3 km - Próximas",
    5: "5 km - Local",
    8: "8 km - Distrito",
    10: "10 km - Expandida",
    15: "15 km - Regional",
    20: "20 km - Ampla"
} as const;

