"use client";

import styles from "@/app/inicio/styles.module.css";

type PedidoLinha = {
  id: number;
  nf?: number;
  cliente?: string;
  cidade?: string;
  dtpedido?: string;
  _totalItens?: number;
  _pesoTotal?: number;
  _volumeTotal?: number;
  rota?: number | null;
};

type Props = {
  pedidos: PedidoLinha[];
  selectedIds: number[];
  onToggleSelect: (id: number, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  deletingId: number | null;
  loading: boolean;
  formatDateBR: (value: any) => string;
};

export function OrdersTable({
  pedidos,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  deletingId,
  loading,
  formatDateBR,
}: Props) {
  const allSelected = pedidos.length > 0 && selectedIds.length === pedidos.length;

  return (
    <section className={`${styles.card} ${styles.table}`}>
      <div className={styles["card-head"]}>
        <h3>Pedidos</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Selecionar todos os pedidos"
                disabled={loading || pedidos.length === 0}
                checked={!loading && allSelected}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
              />
            </th>
            <th>ID</th>
            <th>NF</th>
            <th>Cliente</th>
            <th>Cidade</th>
            <th>Data</th>
            <th>Itens</th>
            <th>Peso total</th>
            <th>Volume total</th>
            <th>Status da rota</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={11}>Carregando pedidos...</td>
            </tr>
          )}
          {!loading && pedidos.length === 0 && (
            <tr>
              <td colSpan={11}>Nenhum pedido cadastrado.</td>
            </tr>
          )}
          {!loading &&
            pedidos.map((pedido) => (
              <tr key={pedido.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar pedido ${pedido.id}`}
                    checked={selectedIds.includes(pedido.id)}
                    onChange={(e) => onToggleSelect(pedido.id, e.target.checked)}
                  />
                </td>
                <td>{pedido.id}</td>
                <td>{pedido.nf}</td>
                <td>{pedido.cliente ?? "-"}</td>
                <td>{pedido.cidade ?? "-"}</td>
                <td>{formatDateBR(pedido.dtpedido)}</td>
                <td>{pedido._totalItens ?? 0}</td>
                <td>{pedido._pesoTotal ?? "-"}</td>
                <td>{pedido._volumeTotal ?? "-"}</td>
                <td>
                  {pedido.rota !== null && typeof pedido.rota !== "undefined" ? (
                    <span className={`${styles.badge} ${styles.ok}`}>Rota gerada</span>
                  ) : (
                    <span className={`${styles.badge} ${styles.warn}`}>Pendente</span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
