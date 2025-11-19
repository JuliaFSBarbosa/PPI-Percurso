"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
    if (raw.trim().startsWith("<")) {
      return `${fallback} (status ${status ?? "desconhecido"}).`;
    }
  }
  return raw || fallback;
};

const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
};

const formatWeight = (value?: number) => {
  if (typeof value !== "number") return "-";
  return `${decimalFormatter.format(value)} kg`;
};

const formatPercent = (value?: number) => {
  if (typeof value !== "number") return "-";
  return `${Math.round(value)}%`;
};

const statusBadge = (status: RotaStatus) => {
  switch (status) {
    case "PLANEJADA":
      return `${styles.badge} ${styles.warn}`;
    case "EM_EXECUCAO":
      return `${styles.badge} ${styles.ok}`;
    case "CONCLUIDA":
      return `${styles.badge} ${styles.done}`;
    default:
      return styles.badge;
  }
};

export default function RotasPage() {
  const { data: session } = useSession();
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
      try {
        const resp = await fetch("/api/proxy/rotas", { cache: "no-store" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseError(raw, "Não foi possível carregar as rotas.", resp.status));
        const data = JSON.parse(raw) as API<APIGetRotasResponse>;
        if (!data.success) throw new Error(data.detail || "Erro ao buscar rotas.");
        if (!active) return;
        setRotas(data.data?.results ?? []);
      } catch (err) {
        if (!active) return;
        setRotas([]);
        setError(err instanceof Error ? err.message : "Falha ao carregar rotas.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logomarca Caminhǜo" />
        </div>
        <nav>
          <Link href="/inicio">Início</Link>
          <Link className={styles.active} aria-current="page" href="/rotas">
            Rotas
          </Link>
          <Link href="/entregas">Pedidos</Link>
          <Link href="/produtos">Produtos</Link>
          <Link href="/configuracoes">Usuários</Link>
        </nav>
      </aside>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => setReloadKey((prev) => prev + 1)}
                disabled={loading}
              >
                Atualizar
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
            <h3>Rotas cadastradas</h3>
          </div>
          {error && <p className={styles.muted}>{error}</p>}
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Data</th>
                <th>Pedidos</th>
                <th>Volume</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8}>Carregando rotas...</td>
                </tr>
              )}
              {!loading && rotas.length === 0 && (
                <tr>
                  <td colSpan={8}>Nenhuma rota cadastrada.</td>
                </tr>
              )}
              {!loading &&
                rotas.map((rota) => (
                  <tr key={rota.id}>
                    <td>{rota.id}</td>
                    <td>{formatDate(rota.data_rota)}</td>
                    <td>{formatWeight(rota.capacidade_max)}</td>
                    <td>{rota.total_pedidos ?? rota.pedidos?.length ?? 0}</td>
                    <td>{rota.pedidos_entregues ?? 0}</td>
                    <td>{formatWeight(rota.peso_total_pedidos)}</td>
                    <td>
                      <span className={statusBadge(rota.status)}>{rota.status}</span>
                    </td>
                    <td>{formatPercent(rota.percentual_entrega)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
