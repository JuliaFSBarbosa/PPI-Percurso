"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { SelectedOrdersMap } from "@/components/pedidos/SelectedOrdersMap";
import { statusLabels } from "@/constants/labels";
import { AppSidebar } from "@/components/navigation/AppSidebar";
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
  pedidosParaEntrega: number;
  rotasGeradas: number;
  rotasEmExecucao: number;
  rotasFinalizadas: number;
};

export default function InicioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const deniedAccess = searchParams?.get("acesso") === "negado";
  const isDefaultProfile = !!session?.user?.profile?.is_default;

  const [pedidosHoje, setPedidosHoje] = useState<Pedido[]>([]);
  const [kpis, setKpis] = useState<KPIState>({
    pedidosParaEntrega: 0,
    rotasGeradas: 0,
    rotasEmExecucao: 0,
    rotasFinalizadas: 0,
  });
  const [dataFiltro, setDataFiltro] = useState(todayLocalISO());
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const raw = (session?.user?.name || session?.user?.email || "Usuário").toString();
    return raw;
  }, [session?.user?.name, session?.user?.email]);
  const roleLabel = session?.user?.is_superuser ? "Administrador" : session?.user?.profile?.name || "Usuário padrão";

  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  const carregarDados = useCallback(async () => {
    const dataConsulta = dataFiltro || todayLocalISO();

    const fetchJson = async <T,>(url: string, fallbackError: string): Promise<T> => {
      const resp = await fetch(url, { cache: "no-store" });
      const text = await resp.text();
      if (!resp.ok) throw new Error(text || fallbackError);
      const data = JSON.parse(text);
      if (!data?.success) throw new Error(data?.detail || fallbackError);
      return data.data as T;
    };

    setLoading(true);
    setErro(null);
    try {
      const [pedidosResp, resumoResp] = await Promise.all([
        fetchJson<APIGetPedidosResponse>("/api/proxy/pedidos?limit=500", "Falha ao carregar pedidos."),
        fetchJson<APIGetDashboardResumoResponse>(
          `/api/proxy/dashboard/resumo?data=${dataConsulta}`,
          "Falha ao carregar indicadores."
        ),
      ]);

      const pedidosLista = pedidosResp?.results ?? [];
      const pedidosDia = pedidosLista.filter((p: any) => normalizeDateToISO(p.dtpedido) === dataConsulta);

      setPedidosHoje(pedidosDia as Pedido[]);
      setKpis({
        pedidosParaEntrega: resumoResp?.pedidos_pendentes ?? 0,
        rotasGeradas: resumoResp?.rotas_geradas ?? 0,
        rotasEmExecucao: resumoResp?.rotas_em_execucao ?? 0,
        rotasFinalizadas: resumoResp?.rotas_finalizadas ?? 0,
      });
    } catch (e: any) {
      setErro(e.message || "Não foi possível carregar os dados iniciais.");
      setPedidosHoje([]);
      setKpis({ pedidosParaEntrega: 0, rotasGeradas: 0, rotasEmExecucao: 0, rotasFinalizadas: 0 });
    } finally {
      setLoading(false);
    }
  }, [dataFiltro]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const totalItens = (pedido: Pedido) =>
    (pedido as any)._totalItens ??
    (Array.isArray((pedido as any).itens)
      ? (pedido as any).itens.reduce(
          (sum: number, it: any) => sum + Number(it.quantidade || 0),
          0
        )
      : 0);

  const statusInfoPedido = (pedido: Pedido) => {
    const rotasAssociadas = Array.isArray((pedido as any).rotas) ? (pedido as any).rotas : [];
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
    } else if (typeof (pedido as any).rota !== "undefined" && (pedido as any).rota !== null) {
      badgeClass = `${styles.badge} ${styles.done}`;
      badgeText = "Rota vinculada";
    }

    return { badgeClass, badgeText };
  };

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <AppSidebar active="inicio" />

      <main className={styles.content}>
        {loading && <LoadingOverlay message="Carregando dados do dia..." />}
        {deniedAccess && (
          <div className={styles.alert}>Acesso não permitido para a tela solicitada.</div>
        )}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            {!isDefaultProfile && (
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
            )}
          </div>
          <div className={styles.right}>
            <div className={styles.user}>
              <Link
                href="/configuracoes/perfil"
                className={styles.avatar}
                aria-label="Ir para usuários"
                title="Ir para usuários"
              >
                {avatarLetter}
              </Link>
              <div className={styles.info}>
                <strong>{displayName}</strong>
                <small>{roleLabel}</small>
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

        <div className={styles.filtersRow}>
          <label className={styles.dateField}>
            <span>Data do dia</span>
            <input
              id="data-filtro"
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className={styles.dateInput}
            />
          </label>
          <button
            type="button"
            className={`${styles.btn} ${styles.primary}`}
            onClick={carregarDados}
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Atualizar mural"}
          </button>
        </div>

        <section className={styles.kpis}>
          <div className={`${styles.card} ${styles.kpi}`}>
            <h3>Pedidos a serem entregues</h3>
            <div className={styles.value}>{kpis.pedidosParaEntrega}</div>
          </div>
          <div className={`${styles.card} ${styles.kpi}`}>
          <h3>Rotas</h3>
            <div className={styles.value}>{kpis.rotasGeradas}</div>
          </div>
          <div className={`${styles.card} ${styles.kpi}`}>
            <h3>Rotas em andamento</h3>
            <div className={styles.value}>{kpis.rotasEmExecucao}</div>
          </div>
          <div className={`${styles.card} ${styles.kpi}`}>
            <h3>Rotas finalizadas</h3>
            <div className={styles.value}>{kpis.rotasFinalizadas}</div>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={`${styles.card} ${styles.table}`}>
            <div className={styles["card-head"]}>
              <div>
                <h3>Pedidos do dia {formatDateBR(dataFiltro)}</h3>
                <small>{pedidosHoje.length} pedido(s) encontrados</small>
              </div>
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
                  {pedidosHoje.map((p) => {
                    const { badgeClass, badgeText } = statusInfoPedido(p);
                    return (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td>{p.nf}</td>
                        <td>{(p as any).cliente ?? "-"}</td>
                        <td>{formatDateBR(p.dtpedido)}</td>
                        <td>{totalItens(p)}</td>
                        <td>
                          <span className={badgeClass}>{badgeText}</span>
                        </td>
                      </tr>
                    );
                  })}
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
