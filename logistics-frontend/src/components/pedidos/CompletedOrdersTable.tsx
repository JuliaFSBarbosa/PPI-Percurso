"use client";

import styles from "@/app/inicio/styles.module.css";

type PedidoLinha = {
  id: number;
  nf?: number;
  cliente?: string;
  dtpedido?: string;
  _totalItens?: number;
  _pesoTotal?: number;
  _volumeTotal?: number;
  rota?: number | null;
};

type Props = {
  pedidos: PedidoLinha[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onRemoveFromRoute: (id: number) => void;
  deletingId: number | null;
  loading: boolean;
  formatDateBR: (value: any) => string;
};

export function CompletedOrdersTable({
  pedidos,
  onEdit,
  onDelete,
  onRemoveFromRoute,
  deletingId,
  loading,
  formatDateBR,
}: Props) {
  return (
    <section className={`${styles.card} ${styles.table}`}>
      <div className={styles["card-head"]}>
        <h3>Pedidos com rota</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>NF</th>
            <th>Cliente</th>
            <th>Data</th>
            <th>Itens</th>
            <th>Peso total</th>
            <th>Volume total</th>
            <th>Rota</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={9}>Carregando pedidos...</td>
            </tr>
          )}
          {!loading && pedidos.length === 0 && (
            <tr>
              <td colSpan={9}>Nenhum pedido com rota.</td>
            </tr>
          )}
          {!loading &&
            pedidos.map((pedido) => (
              <tr key={pedido.id}>
                <td>{pedido.id}</td>
                <td>{pedido.nf}</td>
                <td>{pedido.cliente ?? "-"}</td>
                <td>{formatDateBR(pedido.dtpedido)}</td>
                <td>{pedido._totalItens ?? 0}</td>
                <td>{pedido._pesoTotal ?? "-"}</td>
                <td>{pedido._volumeTotal ?? "-"}</td>
                <td>{pedido.rota ?? "-"}</td>
                <td>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                      onClick={() => onRemoveFromRoute(pedido.id)}
                    >
                      Remover da rota
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                      onClick={() => onEdit(pedido.id)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                      disabled={deletingId === pedido.id}
                      onClick={() => onDelete(pedido.id)}
                    >
                      {deletingId === pedido.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  );
}
