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
}

type PedidoSimple = {
    id: number;
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