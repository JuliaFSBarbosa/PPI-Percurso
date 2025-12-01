"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { SelectedOrdersMap } from "@/components/pedidos/SelectedOrdersMap";
import styles from "./styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const todayLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const normalizeDateToISO = (value: any) => {
  if (!value) return "";
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const asString = String(value).trim();
  const iso = asString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = asString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const parsed = new Date(asString);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return "";
};

const formatDateBR = (value: any) => {
  const iso = normalizeDateToISO(value);
  if (!iso) return value || "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

type KPIState = {
  pedidosHoje: number;
  disponiveisRota: number;
  rotasGeradasHoje: number;
};

export default function InicioPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [pedidosHoje, setPedidosHoje] = useState<Pedido[]>([]);
  const [kpis, setKpis] = useState<KPIState>({
    pedidosHoje: 0,
    disponiveisRota: 0,
    rotasGeradasHoje: 0,
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const raw = (session?.user?.name || session?.user?.email || "Usuário").toString();
    return raw;
  }, [session?.user?.name, session?.user?.email]);

  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  useEffect(() => {
    const hoje = todayLocalISO();

    const fetchJson = async <T,>(url: string, fallbackError: string): Promise<T> => {
      const resp = await fetch(url, { cache: "no-store" });
      const text = await resp.text();
      if (!resp.ok) throw new Error(text || fallbackError);
      const data = JSON.parse(text);
      if (!data?.success) throw new Error(data?.detail || fallbackError);
      return data.data as T;
    };

    const load = async () => {
      setLoading(true);
      setErro(null);
      try {
        // Puxamos um lote generoso e filtramos no client para garantir coerência
        const [pedidosResp, rotasHojeResp] = await Promise.all([
          fetchJson<APIGetPedidosResponse>("/api/proxy/pedidos?limit=500", "Falha ao carregar pedidos."),
          fetchJson<APIGetRotasResponse>(
            `/api/proxy/rotas?data_inicio=${hoje}&data_fim=${hoje}&limit=500`,
            "Falha ao carregar rotas do dia."
          ),
        ]);

        const pedidosLista = pedidosResp?.results ?? [];
        const pedidosHojeLista = pedidosLista.filter((p: any) => normalizeDateToISO(p.dtpedido) === hoje);

        // Conteúdo real
        const pedidosDisponiveis = pedidosLista.filter((p: any) => {
          const rotas = Array.isArray((p as any).rotas) ? (p as any).rotas : [];
          return rotas.length === 0;
        });
        const rotasHoje = rotasHojeResp?.results ?? [];

        setPedidosHoje(pedidosHojeLista as Pedido[]);
        setKpis({
          pedidosHoje: pedidosHojeLista.length,
          disponiveisRota: pedidosDisponiveis.length,
          rotasGeradasHoje: rotasHojeResp?.count ?? rotasHoje.length,
        });
      } catch (e: any) {
        setErro(e.message || "Não foi possível carregar os dados iniciais.");
        setPedidosHoje([]);
        setKpis({ pedidosHoje: 0, disponiveisRota: 0, rotasGeradasHoje: 0 });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const totalItens = (pedido: Pedido) =>
    (pedido as any)._totalItens ??
    (Array.isArray((pedido as any).itens)
      ? (pedido as any).itens.reduce(
          (sum: number, it: any) => sum + Number(it.quantidade || 0),
          0
        )
      : 0);

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logomarca Caminhão" />
        </div>
        <nav>
          <Link className={styles.active} aria-current="page" href="/inicio">
            Início
          </Link>
          <Link href="/rotas">Rotas</Link>
          <Link href="/pedidos">Pedidos</Link>
          <Link href="/produtos">Produtos</Link>
          <Link href="/configuracoes">Usuários</Link>
        </nav>
      </aside>

      <main className={styles.content}>
        {loading && <LoadingOverlay message="Carregando dados do dia..." />}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => router.push("/pedidos")}
              >
                Ver pedidos
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost}`}
                onClick={() => router.push("/entregas/novo")}
              >
                + Novo Pedido
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
                aria-label="Sair"
                title="Sair"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <section className={styles.kpis}>
          <div className={`${styles.card} ${styles.kpi}`}>
            <h3>Pedidos hoje</h3>
            <div className={styles.value}>{kpis.pedidosHoje}</div>
          </div>
          <div className={`${styles.card} ${styles.kpi}`}>
            <h3>Pedidos sem rota</h3>
            <div className={styles.value}>{kpis.disponiveisRota}</div>
          </div>
          <div className={`${styles.card} ${styles.kpi}`}>
            <h3>Rotas geradas hoje</h3>
            <div className={styles.value}>{kpis.rotasGeradasHoje}</div>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={`${styles.card} ${styles.table}`}>
            <div className={styles["card-head"]}>
              <h3>Pedidos de hoje</h3>
              <Link className={`${styles.btn} ${styles.ghost} ${styles.sm}`} href="/pedidos">
                Ver pedidos
              </Link>
            </div>
            {erro && <p className={styles.muted}>{erro}</p>}
            {!erro && loading && <p>Carregando pedidos de hoje...</p>}
            {!erro && !loading && pedidosHoje.length === 0 && <p>Nenhum pedido para hoje.</p>}
            {!erro && !loading && pedidosHoje.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>NF</th>
                    <th>Cliente</th>
                    <th>Data</th>
                    <th>Itens</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosHoje.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.nf}</td>
                      <td>{(p as any).cliente ?? "-"}</td>
                      <td>{formatDateBR(p.dtpedido)}</td>
                      <td>{totalItens(p)}</td>
                      <td>
                        {Array.isArray((p as any).rotas) && (p as any).rotas.length > 0 ? (
                          <span className={`${styles.badge} ${styles.ok}`}>Rota gerada</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.warn}`}>Pendente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={`${styles.card} ${styles.map}`}>
            <div className={styles["card-head"]}>
              <h3>Mapa dos pedidos de hoje</h3>
              <Link className={`${styles.btn} ${styles.ghost} ${styles.sm}`} href="/pedidos">
                Ver pedidos
              </Link>
            </div>
            <SelectedOrdersMap
              pedidos={pedidosHoje.map((p) => ({
                id: p.id,
                cliente: (p as any).cliente,
                nf: (p as any).nf,
                cidade:
                  (p as any).cidade ??
                  (p as any).endereco_cidade ??
                  (p as any).endereco ??
                  (p as any).endereco_resumido,
                latitude: (p as any).latitude,
                longitude: (p as any).longitude,
                peso_total: (p as any)._pesoTotal ?? (p as any).peso_total,
                volume_total: (p as any)._volumeTotal ?? (p as any).volume_total,
              }))}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
