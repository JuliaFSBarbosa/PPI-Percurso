"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import styles from "../inicio/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

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
        const resp = await fetch("/api/proxy/pedidos", { cache: "no-store" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseError(raw, "Não foi possível carregar os pedidos.", resp.status));
        const data = JSON.parse(raw) as API<APIGetPedidosResponse>;
        if (!data.success) throw new Error(data.detail || "Erro ao buscar pedidos.");
        if (!active) return;
        setPedidos(data.data?.results ?? []);
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
  }, []);

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
                pedidos.map((pedido) => (
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
                    <td>{pedido.total_itens ?? pedido.itens?.length ?? 0}</td>
                    <td>{pedido.peso_total ?? "-"}</td>
                    <td>{pedido.volume_total ?? "-"}</td>
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
        </section>
      </main>
    </div>
  );
}
