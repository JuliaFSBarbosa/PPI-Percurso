"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import styles from "../inicio/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });
const PAGE_SIZE = 20;

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

  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuário").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      setSelectedIds([]);
      try {
        const resp = await fetch(`/api/proxy/pedidos?limit=${PAGE_SIZE}&offset=${offset}`, { cache: "no-store" });
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

        if (!active) return;
        setPedidos(lista);
      } catch (err) {
        if (!active) return;
        setPedidos([]);
        setError(err instanceof Error ? err.message : "Falha ao carregar pedidos.");
        setInfo(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [offset]);

  const pedidosWithTotals = useMemo(() => {
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

      return { ...pedido, _totalItens: totalItens, _pesoTotal: pesoTotal, _volumeTotal: volumeTotal };
    });
  }, [pedidos]);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE) || 1);
  const canPrev = offset > 0;
  const canNext = offset + pedidos.length < totalCount;

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logomarca Caminhao" />
        </div>
        <nav>
          <Link href="/inicio">Inicio</Link>
          <Link href="/rotas">Rotas</Link>
          <Link className={styles.active} aria-current="page" href="/entregas">
            Pedidos
          </Link>
          <Link href="/produtos">Produtos</Link>
          <Link href="/configuracoes">Usuarios</Link>
        </nav>
      </aside>

      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost}`}
                disabled={selectedIds.length === 0}
                onClick={() => {
                  setError(null);
                  setInfo(
                    selectedIds.length > 1
                      ? `Geração de rotas simulada para ${selectedIds.length} pedidos.`
                      : `Geração de rota simulada para o pedido ${selectedIds[0]}.`
                  );
                }}
              >
                Gerar rota
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

        <section className={`${styles.card} ${styles.table}`}>
          <div className={styles["card-head"]}>
            <h3>Pedidos cadastrados</h3>
          </div>
          {error && <p className={styles.muted}>{error}</p>}
          {!error && info && <p className={styles.muted}>{info}</p>}
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos os pedidos"
                    disabled={loading || pedidos.length === 0}
                    checked={!loading && pedidos.length > 0 && selectedIds.length === pedidos.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? pedidos.map((p) => p.id) : [])}
                  />
                </th>
                <th>ID</th>
                <th>NF</th>
                <th>Data</th>
                <th>Itens</th>
                <th>Peso total</th>
                <th>Volume total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7}>Carregando pedidos...</td>
                </tr>
              )}
              {!loading && pedidos.length === 0 && (
                <tr>
                  <td colSpan={7}>Nenhum pedido cadastrado.</td>
                </tr>
              )}
              {!loading &&
                pedidosWithTotals.map((pedido) => (
                  <tr key={pedido.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar pedido ${pedido.id}`}
                        checked={selectedIds.includes(pedido.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, pedido.id] : prev.filter((id) => id !== pedido.id)
                          )
                        }
                      />
                    </td>
                    <td>{pedido.id}</td>
                    <td>{pedido.nf}</td>
                    <td>{pedido.dtpedido}</td>
                    <td>{pedido._totalItens ?? 0}</td>
                    <td>{pedido._pesoTotal ?? "-"}</td>
                    <td>{pedido._volumeTotal ?? "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                          onClick={() => router.push(`/entregas/${pedido.id}/editar`)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                          disabled={deletingId === pedido.id}
                          onClick={async () => {
                            if (!confirm(`Excluir o pedido ${pedido.id}?`)) return;
                            setError(null);
                            setInfo(null);
                            setDeletingId(pedido.id);
                            try {
                              const resp = await fetch(`/api/proxy/pedidos/${pedido.id}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              const text = await resp.text();
                              if (!resp.ok) {
                                throw new Error(parseError(text, "Falha ao excluir pedido.", resp.status));
                              }
                              setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
                              setSelectedIds((prev) => prev.filter((id) => id !== pedido.id));
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Erro ao excluir pedido.");
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                        >
                          {deletingId === pedido.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div
            className={styles["quick-actions"]}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
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
        </section>
      </main>
    </div>
  );
}
