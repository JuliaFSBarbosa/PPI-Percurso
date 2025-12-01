"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { SelectedOrdersMap } from "@/components/pedidos/SelectedOrdersMap";
import { OrdersTable } from "@/components/pedidos/OrdersTable";
import styles from "../inicio/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });
const PAGE_SIZE = 200;

const parseError = (raw: string, fallback: string, status?: number) => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.detail) return parsed.detail as string;
    const first = parsed && Object.keys(parsed)[0];
    if (first) {
      const value = parsed[first];
      if (Array.isArray(value)) return String(value[0]);
      if (typeof value === "string") return value;
    }
  } catch {
    const trimmed = raw.trim();
    if (trimmed.startsWith("<")) {
      return `${fallback} (status ${status ?? "desconhecido"})`;
    }
  }
  return raw || fallback;
};

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const formatDateBR = (value: any) => {
  if (!value) return "-";
  const asString = String(value).trim();
  const iso = asString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = asString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  const d = new Date(asString);
  if (!Number.isNaN(d.getTime())) {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  return asString;
};

const normalizeId = (value: number | string | null | undefined) => Number(value ?? 0);

type PedidoEnriquecido = Pedido & {
  _totalItens?: number;
  _pesoTotal?: number;
  _volumeTotal?: number;
  cidade?: string;
  rota?: number | null;
};

export default function PedidosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [savingRouteId, setSavingRouteId] = useState<number | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuário").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  const loadPedidos = async (currentOffset: number) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const resp = await fetch(`/api/proxy/pedidos?limit=${PAGE_SIZE}&offset=${currentOffset}`, { cache: "no-store" });
      const raw = await resp.text();
      if (!resp.ok) throw new Error(parseError(raw, "Não foi possível carregar os pedidos.", resp.status));
      const data = JSON.parse(raw) as API<APIGetPedidosResponse>;
      if (!data.success) throw new Error(data.detail || "Erro ao buscar pedidos.");
      setTotalCount(data.data?.count ?? 0);
      let lista = data.data?.results ?? [];

      const pedidosSemItens = lista.filter(
        (p) =>
          !Array.isArray((p as any).itens) ||
          ((p as any).itens?.length ?? 0) === 0 ||
          (p as any).total_itens === 0 ||
          (p as any).total_itens === null ||
          typeof (p as any).total_itens === "undefined"
      );

      if (pedidosSemItens.length > 0) {
        const detalhes = await Promise.all(
          pedidosSemItens.map(async (p) => {
            try {
              const r = await fetch(`/api/proxy/pedidos/${p.id}`, { cache: "no-store" });
              const txt = await r.text();
              if (!r.ok) return null;
              const parsed = JSON.parse(txt) as API<APIGetPedidoResponse>;
              if (!parsed.success || !parsed.data) return null;
              return parsed.data;
            } catch {
              return null;
            }
          })
        );

        lista = lista.map((p) => {
          const det = detalhes.find((d) => d && d.id === p.id);
          if (!det) return p;
          return {
            ...p,
            itens: det.itens ?? (p as any).itens,
            total_itens: det.total_itens ?? (p as any).total_itens,
            peso_total: det.peso_total ?? (p as any).peso_total,
            volume_total: det.volume_total ?? (p as any).volume_total,
          } as Pedido;
        });
      }

      const listaNormalizada = lista.map(
        (p) =>
          ({
            ...p,
            id: normalizeId((p as any).id),
          } as Pedido)
      );

      setPedidos(listaNormalizada);
    } catch (err) {
      setPedidos([]);
      setError(err instanceof Error ? err.message : "Falha ao carregar pedidos.");
      setInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPedidos(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const pedidosWithTotals = useMemo<PedidoEnriquecido[]>(() => {
    return pedidos.map((pedido) => {
      const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

      const totalItensFromApi = Number((pedido as any).total_itens);
      const pesoTotalFromApi = Number((pedido as any).peso_total);
      const volumeTotalFromApi = Number((pedido as any).volume_total);

      const totalItens =
        Number.isFinite(totalItensFromApi)
          ? totalItensFromApi
          : itens.reduce((sum, it) => sum + Number(it.quantidade || 0), 0);

      const pesoTotal =
        Number.isFinite(pesoTotalFromApi)
          ? pesoTotalFromApi
          : itens.reduce(
              (sum, it) =>
                sum +
                (Number(it.peso_total) ||
                  Number(it.quantidade || 0) * Number((it as any)?.produto?.peso || 0)),
              0
            );

      const volumeTotal =
        Number.isFinite(volumeTotalFromApi)
          ? volumeTotalFromApi
          : itens.reduce(
              (sum, it) => sum + Number(it.quantidade || 0) * Number((it as any)?.produto?.volume || 0),
              0
            );

      const cidade = (pedido as any).cidade || "-";

      const rota =
        typeof (pedido as any).rota !== "undefined"
          ? (pedido as any).rota
          : Array.isArray((pedido as any).rotas) && (pedido as any).rotas.length > 0
          ? (pedido as any).rotas[0].id ?? null
          : null;

      return { ...pedido, _totalItens: totalItens, _pesoTotal: pesoTotal, _volumeTotal: volumeTotal, cidade, rota };
    });
  }, [pedidos]);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE) || 1);
  const canPrev = offset > 0;
  const canNext = offset + pedidos.length < totalCount;

  const selectedOrders = pedidosWithTotals.filter((p) => selectedIds.includes(p.id));

  const handleOptimize = async () => {
    setError(null);
    setInfo(null);
    setSavingRouteId(null);
    if (selectedIds.length === 0) {
      setError("Selecione ao menos um pedido para gerar rota.");
      return;
    }
    setOptimizing(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const capacidade = pedidosWithTotals
        .filter((p) => selectedIds.includes(p.id))
        .reduce((sum, p) => sum + (Number(p._pesoTotal) || 0), 0);

      const resp = await fetch("/api/proxy/rotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_rota: hoje,
          capacidade_max: capacidade || 0,
          pedidos_ids: selectedIds,
        }),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(parseError(text, "Falha ao criar rota.", resp.status));
      const data = text ? JSON.parse(text) : {};
      if (data.success === false) throw new Error(data.detail || "Erro ao criar rota.");
      setSavingRouteId(data.id || data.rota_id || null);
      setInfo("Rota criada com sucesso.");
      setSelectedIds([]);
      await loadPedidos(0);
      setOffset(0);
    } catch (e: any) {
      setError(e.message || "Erro ao gerar rota.");
    } finally {
      setOptimizing(false);
    }
  };

  const handleDelete = async (pedidoId: number) => {
    if (!confirm(`Excluir o pedido ${pedidoId}?`)) return;
    setError(null);
    setInfo(null);
    setDeletingId(pedidoId);
    try {
      const targetId = normalizeId(pedidoId);
      const newTotal = Math.max(0, totalCount - 1);
      const adjustedOffset = offset >= newTotal && offset > 0 ? Math.max(0, offset - PAGE_SIZE) : offset;
      const resp = await fetch(`/api/proxy/pedidos/${pedidoId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(parseError(text, "Falha ao excluir pedido.", resp.status));
      }
      setPedidos((prev) => prev.filter((p) => normalizeId((p as any).id) !== targetId));
      setSelectedIds((prev) => prev.filter((id) => normalizeId(id) !== targetId));
      setTotalCount(newTotal);
      setInfo("Pedido excluído com sucesso.");
      await loadPedidos(adjustedOffset);
      if (adjustedOffset !== offset) {
        setOffset(adjustedOffset);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir pedido.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logomarca Caminhao" />
        </div>
        <nav>
          <Link href="/inicio">Inicio</Link>
          <Link href="/rotas">Rotas</Link>
          <Link className={styles.active} aria-current="page" href="/pedidos">
            Pedidos
          </Link>
          <Link href="/produtos">Produtos</Link>
          <Link href="/configuracoes">Usuarios</Link>
        </nav>
      </aside>

      <main className={styles.content}>
        {loading && <LoadingOverlay message="Carregando pedidos..." />}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost}`}
                disabled={selectedIds.length === 0 || optimizing}
                onClick={handleOptimize}
              >
                {optimizing ? "Gerando..." : "Gerar rota"}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => router.push("/entregas/novo")}
              >
                + Novo pedido
              </button>
            </div>
          </div>
          <div className={styles.right}>
            <div className={styles.user}>
              <div className={styles.avatar}>{avatarLetter}</div>
              <div className={styles.info}>
                <strong>{displayName}</strong>
                <small>Administrador</small>
              </div>
              <ThemeToggle className={`${styles.btn} ${styles.ghost} ${styles.sm}`} />
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        {error && <p className={styles.muted}>{error}</p>}
        {!error && info && <p className={styles.muted}>{info}</p>}
        {savingRouteId && (
          <div className={styles["quick-actions"]}>
            <span className={styles.muted}>Rota criada #{savingRouteId}</span>
          </div>
        )}

        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "2fr 1fr", alignItems: "start", marginBottom: 8 }}>
          <SelectedOrdersMap
            pedidos={selectedOrders.map((p) => ({
              id: p.id,
              cliente: (p as any).cliente,
              nf: p.nf,
              cidade: p.cidade,
              latitude: (p as any).latitude,
              longitude: (p as any).longitude,
              peso_total: p._pesoTotal,
              volume_total: p._volumeTotal,
            }))}
          />

          <section className={styles.card} style={{ height: "100%" }}>
            <div className={styles["card-head"]}>
              <h3>Resumo dos selecionados</h3>
            </div>
            {selectedOrders.length === 0 && <p className={styles.muted}>Selecione pedidos na tabela.</p>}
            {selectedOrders.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selectedOrders.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "12px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--panel-muted, rgba(255,255,255,0.02))",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <strong>#{p.id}</strong> - {p.cliente ?? "-"}
                      </div>
                      <span className={styles.muted}>{p.cidade ?? "-"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6, fontSize: 13 }}>
                      <span>NF: {p.nf ?? "-"}</span>
                      <span>Itens: {p._totalItens ?? 0}</span>
                      <span>Peso: {p._pesoTotal ?? "-"}</span>
                      <span>Volume: {p._volumeTotal ?? "-"}</span>
                      <span>
                        Status:{" "}
                        {p.rota !== null && typeof p.rota !== "undefined" ? (
                          <span className={`${styles.badge} ${styles.ok}`}>Rota gerada</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.warn}`}>Pendente</span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <OrdersTable
          pedidos={pedidosWithTotals}
          selectedIds={selectedIds}
          onToggleSelect={(id, checked) =>
            setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((p) => p !== id)))
          }
          onToggleSelectAll={(checked) => setSelectedIds(checked ? pedidosWithTotals.map((p) => p.id) : [])}
          onEdit={(id) => router.push(`/entregas/${id}/editar`)}
          onDelete={handleDelete}
          deletingId={deletingId}
          loading={loading}
          formatDateBR={formatDateBR}
        />

        <div
          className={styles["quick-actions"]}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}
        >
          <span className={styles.muted}>
            Página {currentPage} de {totalPages} ({totalCount} registros)
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
              disabled={!canPrev || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Anterior
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
              disabled={!canNext || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Próxima
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
