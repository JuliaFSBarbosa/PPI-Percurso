type Familia = {
    id: number;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    created_at: string;
    total_produtos: number;
}

type Produto = {
    id: number;
    nome: string;
    peso: number;
    volume: number | null;
    familia: {
        id: number;
        nome: string;
        descricao: string | null;
    };
    ativo: boolean;
    created_at: string;
}

type ProdutoSimple = {
    id: number;
    nome: string;
    peso: number;
    volume: number | null;
    familia_id: number;
    familia_nome: string;
}

type ProdutoPedido = {
    id: number;
    produto: ProdutoSimple;
    quantidade: number;
    peso_total: number;
}

// PEDIDOS
type Pedido = {
    id: number;
    cliente: string;
    cidade?: string;
    usuario: {
        id: number;
        name: string;
        email: string;
    } | null;
    nf: number;
    observacao: string | null;
    dtpedido: string;
    latitude: number;
    longitude: number;
    created_at: string;
    itens: ProdutoPedido[];
    peso_total: number;
    volume_total: number;
    total_itens: number;
    rotas?: {
        id: number;
        status: RotaStatus;
        data_rota: string;
    }[];
}

type PedidoRestricaoGrupoSugestao = {
    indice: number;
    titulo: string;
    familias: string[];
    total_itens: number;
    itens: {
        produto_id: number;
        produto_nome: string;
        quantidade: number;
        familia_nome: string;
    }[];
};

type APIDividirPedidoResponse = {
    dividido: boolean;
    total_grupos: number;
    pedidos: Pedido[];
    mensagem: string;
    nf: number;
    success?: boolean;
};

type PedidoSimple = {
    id: number;
    cliente: string;
    nf: number;
    dtpedido: string;
    latitude: number;
    longitude: number;
    usuario_nome: string | null;
    observacao: string | null;
}

// ROTAS
type RotaStatus = "PLANEJADA" | "EM_EXECUCAO" | "CONCLUIDA";

type RotaTrajeto = {
    id: number;
    latitude: number;
    longitude: number;
    datahora: string;
}

type RotaPedido = {
    id: number;
    pedido: PedidoSimple;
    ordem_entrega: number;
    entregue: boolean;
    data_entrega: string | null;
}

type Rota = {
    id: number;
    data_rota: string;
    capacidade_max: number;
    status: RotaStatus;
    created_at: string;
    updated_at: string;
    pedidos: RotaPedido[];
    trajetos: RotaTrajeto[];
    peso_total_pedidos: number;
    total_pedidos: number;
    pedidos_entregues: number;
    percentual_entrega: number;
}

type RotaSimple = {
    id: number;
    data_rota: string;
    capacidade_max: number;
    status: RotaStatus;
    total_pedidos: number;
    peso_total: number;
}

// RESPOSTAS DA API
type APIGetFamiliaResponse = Familia;

type APIGetFamiliasResponse = {
    results: Familia[];
    count: number;
    next: string | null;
    previous: string | null;
}

type APIGetProdutoResponse = Produto;

type APIGetProdutosResponse = {
    results: Produto[];
    count: number;
    next: string | null;
    previous: string | null;
}

type RestricaoFamilia = {
    id: number;
    familia_origem: Familia;
    familia_restrita: Familia;
    motivo: string | null;
    ativo: boolean;
    created_at: string;
}

type APIGetRestricoesFamiliasResponse = {
    results: RestricaoFamilia[];
    count: number;
    next: string | null;
    previous: string | null;
}

type APIGetPedidoResponse = Pedido;

type APIGetPedidosResponse = {
    results: Pedido[];
    count: number;
    next: string | null;
    previous: string | null;
}

type APIGetRotaResponse = Rota;

type APIGetRotasResponse = {
    results: Rota[];
    count: number;
    next: string | null;
    previous: string | null;
}

type DashboardResumo = {
    data_referencia: string;
    total_pedidos: number;
    pedidos_pendentes: number;
    rotas_geradas: number;
    rotas_em_execucao: number;
    rotas_finalizadas: number;
}

type APIGetDashboardResumoResponse = DashboardResumo;
