"use client";

import styles from "@/app/inicio/styles.module.css";
import { statusLabels } from "@/constants/labels";

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
  rotas?: { id: number; status: RotaStatus; data_rota: string }[];
};

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  canPrev: boolean;
  canNext: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
};

type SortKey =
  | "id"
  | "nf"
  | "cliente"
  | "cidade"
  | "data"
  | "itens"
  | "peso"
  | "volume"
  | "status";
type SortDirection = "asc" | "desc";

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
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  pagination?: PaginationProps;
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
  sortKey,
  sortDirection,
  onSortChange,
  pagination,
}: Props) {
  const allSelected = pedidos.length > 0 && selectedIds.length === pedidos.length;
  const buildSortLabel = (label: string, key: SortKey) => {
    const isActive = sortKey === key;
    const indicator = isActive ? (sortDirection === "asc" ? "▲" : "▼") : "";
    const ariaSort = isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none";
    return (
      <th aria-sort={ariaSort}>
        <button
          type="button"
          className={`${styles.tableSortButton} ${isActive ? styles.tableSortButtonActive : ""}`}
          onClick={() => onSortChange(key)}
          aria-label={`Ordenar por ${label} (${isActive ? (sortDirection === "asc" ? "crescente" : "decrescente") : "sem ordenação"})`}
        >
          <span>{label}</span>
          <span className={styles.tableSortIndicator} aria-hidden>
            {indicator}
          </span>
        </button>
      </th>
    );
  };

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
            {buildSortLabel("ID", "id")}
            {buildSortLabel("NF", "nf")}
            {buildSortLabel("Cliente", "cliente")}
            {buildSortLabel("Cidade", "cidade")}
            {buildSortLabel("Data", "data")}
            {buildSortLabel("Itens", "itens")}
            {buildSortLabel("Peso total", "peso")}
            {buildSortLabel("Volume total", "volume")}
            {buildSortLabel("Status da rota", "status")}
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
            pedidos.map((pedido) => {
              const cidade = (pedido as any).cidade || "";
              const rotasAssociadas = Array.isArray((pedido as any).rotas) ? (pedido as any).rotas : [];
              const possuiResumoRota = pedido.rota !== null && typeof pedido.rota !== "undefined";
              let badgeClass = `${styles.badge} ${styles.warn}`;
              let badgeText = "Pendente";

              if (rotasAssociadas.length > 0) {
                const todasConcluidas = rotasAssociadas.every((rota) => rota.status === "CONCLUIDA");
                const algumaExecucao = rotasAssociadas.some((rota) => rota.status === "EM_EXECUCAO");
                if (todasConcluidas) {
                  badgeClass = `${styles.badge} ${styles.done}`;
                  badgeText = statusLabels.CONCLUIDA;
                } else if (algumaExecucao) {
                  badgeClass = `${styles.badge} ${styles.statusInfo}`;
                  badgeText = statusLabels.EM_EXECUCAO;
                } else {
                  badgeClass = `${styles.badge} ${styles.late}`;
                  badgeText = statusLabels.PLANEJADA;
                }
              } else if (possuiResumoRota) {
                badgeClass = `${styles.badge} ${styles.done}`;
                badgeText = "Rota vinculada";
              }
              const pedidoEntregue =
                rotasAssociadas.length > 0 && rotasAssociadas.every((rota) => rota.status === "CONCLUIDA");
              const pedidoEmRotaAtiva =
                rotasAssociadas.some((rota) => rota.status !== "CONCLUIDA") ||
                (rotasAssociadas.length === 0 && possuiResumoRota);
              const pedidoIndisponivel = pedidoEntregue || pedidoEmRotaAtiva;
              return (
              <tr key={pedido.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar pedido ${pedido.id}`}
                    checked={!pedidoIndisponivel && selectedIds.includes(pedido.id)}
                    disabled={pedidoIndisponivel}
                    onChange={(e) => onToggleSelect(pedido.id, e.target.checked)}
                  />
                </td>
                <td>{pedido.id}</td>
                <td>{pedido.nf}</td>
                <td>{pedido.cliente ?? "-"}</td>
                <td>{cidade || "-"}</td>
                <td>{formatDateBR(pedido.dtpedido)}</td>
                <td>{pedido._totalItens ?? 0}</td>
                <td>{pedido._pesoTotal ?? "-"}</td>
                <td>{pedido._volumeTotal ?? "-"}</td>
                <td>
                  <span className={badgeClass}>{badgeText}</span>
                </td>
                <td>
                <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
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
              );
            })}
        </tbody>
      </table>
      {pagination && (
        <div className={styles.tableFooter}>
          <span className={styles.muted}>
            Página {pagination.currentPage} de {pagination.totalPages} ({pagination.totalCount} registros)
          </span>
          <div className={styles.paginationActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
              disabled={!pagination.canPrev || pagination.loading}
              aria-label="Página anterior"
              onClick={pagination.onPrev}
            >
              &lt;
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
              disabled={!pagination.canNext || pagination.loading}
              aria-label="Próxima página"
              onClick={pagination.onNext}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
