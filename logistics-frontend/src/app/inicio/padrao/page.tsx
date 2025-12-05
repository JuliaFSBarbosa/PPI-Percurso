"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import DefaultRoutesMap from "@/components/rotas/DefaultRoutesMap";
import { statusLabels } from "@/constants/labels";
import { parseApiError } from "@/lib/apiError";
import styles from "../styles.module.css";

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
  rotasGeradas: number;
  rotasEmExecucao: number;
  rotasFinalizadas: number;
};

export default function InicioPadraoPage() {
  const { data: session } = useSession();
  const [dataFiltro, setDataFiltro] = useState(todayLocalISO());
  const [rotasHoje, setRotasHoje] = useState<Rota[]>([]);
  const [rotasDetalhadas, setRotasDetalhadas] = useState<Record<number, Rota>>({});
  const [kpis, setKpis] = useState<KPIState>({
    rotasGeradas: 0,
    rotasEmExecucao: 0,
    rotasFinalizadas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuário").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const roleLabel = session?.user?.is_superuser ? "Administrador" : session?.user?.profile?.name || "Usuário padrão";
  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  const fetchRotaDetail = useCallback(async (rotaId: number): Promise<Rota | null> => {
    try {
      const resp = await fetch(`/api/proxy/rotas/${rotaId}`, { cache: "no-store" });
      const raw = await resp.text();
      if (!resp.ok) return null;
      const data = JSON.parse(raw) as API<APIGetRotaResponse>;
      if (!data.success || !data.data) return null;
      return data.data;
    } catch {
      return null;
    }
  }, []);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    setStatusFeedback(null);
    try {
      const resp = await fetch("/api/proxy/rotas?limit=500", { cache: "no-store" });
      const raw = await resp.text();
      if (!resp.ok) throw new Error(parseApiError(raw, "Falha ao carregar rotas.", resp.status));
      const parsed = JSON.parse(raw) as API<APIGetRotasResponse>;
      if (!parsed.success) throw new Error(parsed.detail || "Não foi possível obter rotas.");
      const results = parsed.data?.results ?? [];
      const dataSelecionada = dataFiltro || todayLocalISO();
      const doDia = results.filter(
        (rota) => normalizeDateToISO((rota as any).data_rota ?? rota.data_rota) === dataSelecionada
      );
      setRotasHoje(doDia);
      setKpis({
        rotasGeradas: doDia.length,
        rotasEmExecucao: doDia.filter((rota) => rota.status === "EM_EXECUCAO").length,
        rotasFinalizadas: doDia.filter((rota) => rota.status === "CONCLUIDA").length,
      });
      const detalhes = await Promise.all(
        doDia.map(async (rota) => {
          const detalhe = await fetchRotaDetail(rota.id);
          return detalhe ? { id: rota.id, detalhe } : null;
        })
      );
      const map: Record<number, Rota> = {};
      detalhes.forEach((item) => {
        if (item) map[item.id] = item.detalhe;
      });
      setRotasDetalhadas(map);
      if (doDia.length === 0) {
        setStatusFeedback("Nenhuma rota cadastrada para a data selecionada.");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado ao carregar rotas.");
      setRotasHoje([]);
      setRotasDetalhadas({});
    } finally {
      setLoading(false);
    }
  }, [dataFiltro, fetchRotaDetail]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const rotasParaMapa = rotasHoje.map((rota) => rotasDetalhadas[rota.id] ?? rota);

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <AppSidebar active="inicio" />

      <main className={styles.content}>
        {loading && <LoadingOverlay message="Carregando rotas do dia..." />}
        {erro && <div className={styles.alert}>{erro}</div>}
        <header className={styles.topbar}>
          <div>
            <h2>Visão das rotas</h2>
            <small className={styles.muted}>Acompanhe o andamento das rotas planejadas.</small>
          </div>
          <div className={styles.right}>
            <div className={styles.user}>
              <Link
                href="/configuracoes/perfil"
                className={styles.avatar}
                aria-label="Ir para meu cadastro"
                title="Ir para meu cadastro"
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
            <span>Dia das rotas</span>
            <input
              id="data-rotas"
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
            {loading ? "Atualizando..." : "Atualizar painel"}
          </button>
        </div>

        <section className={styles.kpis}>
          <div className={`${styles.card} ${styles.kpi}`}>
            <h3>Rotas geradas</h3>
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
                <h3>Rotas do dia {formatDateBR(dataFiltro)}</h3>
                <small>{rotasHoje.length} rota(s) encontradas</small>
              </div>
            </div>
            {statusFeedback && <p className={styles.muted}>{statusFeedback}</p>}
            {!statusFeedback && rotasHoje.length === 0 && <p className={styles.muted}>Nenhuma rota para esta data.</p>}
            {rotasHoje.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Data</th>
                    <th>Pedidos</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rotasHoje.map((rota) => (
                    <tr key={rota.id}>
                      <td>{rota.id}</td>
                      <td>{formatDateBR(rota.data_rota)}</td>
                      <td>{rota.total_pedidos ?? (rota as any).total_pedidos ?? "-"}</td>
                      <td>
                        <span className={styles.badge}>{statusLabels[rota.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </section>
     </main>
   </div>
 );
}
