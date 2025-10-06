type PedidoFilterParams = {
    nf?: number;
    usuario?: string;
    data_inicio?: string;
    data_fim?: string;
    disponivel_para_rota?: boolean;
    familias?: number[];
    // ⭐ Filtro por raio geográfico
    pedido_base?: number;
    raio_km?: number;
    ordering?: string;
}

type RotaFilterParams = {
    data_inicio?: string;
    data_fim?: string;
    status?: RotaStatus;
    capacidade_min?: number;
    capacidade_max?: number;
    ordering?: string;
}

type ProdutoFilterParams = {
    nome?: string;
    familia?: number;
    peso_min?: number;
    peso_max?: number;
    ativo?: boolean;
    ordering?: string;
}

type FamiliaFilterParams = {
    nome?: string;
    ativo?: boolean;
    min_produtos?: number;
    ordering?: string;
}
