type PedidoCreatePayload = {
    usuario_id?: number | null;
    nf: number;
    observacao?: string | null;
    dtpedido: string;
    latitude: number;
    longitude: number;
    itens: {
        produto_id: number;
        quantidade: number;
    }[];
}

type RotaCreatePayload = {
    data_rota: string;
    capacidade_max: number;
    status?: RotaStatus;
    pedidos_ids?: number[];
}

type APIPostPedidoResponse = Pedido;
type APIPostRotaResponse = Rota;