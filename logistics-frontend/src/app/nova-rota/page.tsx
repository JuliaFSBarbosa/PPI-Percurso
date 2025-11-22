"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import styles from "../inicio/styles.module.css";

// Carregar visualizador de mapa dinamicamente
const RouteMapViewer = dynamic(
  () => import("@/components/RouteMapViewer").then((mod) => mod.default),
  { ssr: false }
);
interface Pedido {
  id: number;
  nf: number;
  latitude: number;
  longitude: number;
  endereco?: string;
}

export default function NovaRotaPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuário").toString(),
    [session]
  );

  const avatarLetter = displayName.trim()[0]?.toUpperCase() ?? "U";

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [rota, setRota] = useState<any>(null);
  const [carregandoPedidos, setCarregandoPedidos] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Coordenadas do depósito — AJUSTE PARA SUA CIDADE
  const [deposito] = useState({
  latitude: -27.5969,        // ← AJUSTAR
  longitude: -53.5495,       // ← AJUSTAR
  endereco: "Sede - Frederico Westphalen, RS", // ← AJUSTAR
});

  useEffect(() => {
    const loadPedidos = async () => {
      try {
        const resp = await fetch("/api/proxy/pedidos?disponivel_para_rota=true");
        const text = await resp.text();
        const data = JSON.parse(text);

        if (data.success) {
          setPedidos(data.data.results || []);
        } else {
          throw new Error(data.detail || "Erro ao carregar pedidos.");
        }
      } catch (e) {
        setErro("Não foi possível carregar pedidos.");
      } finally {
        setCarregandoPedidos(false);
      }
    };

    loadPedidos();
  }, []);

  const toggleSelecionar = (id: number) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const otimizarRota = async () => {
    if (selecionados.length < 2) {
      setErro("Selecione ao menos dois pedidos para otimizar.");
      return;
    }

    setErro(null);
    setProcessando(true);

    try {
      const payload = {
        pedidos_ids: selecionados,
        deposito: {
          latitude: deposito.latitude,
          longitude: deposito.longitude,
        },
      };

      const resp = await fetch("/api/proxy/otimizar-rota-genetico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      const data = JSON.parse(text);

      if (!data.success) throw new Error(data.detail || "Erro ao otimizar rota.");

      setRota(data.data);
    } catch (e: any) {
      setErro(e.message || "Erro ao processar rota.");
    } finally {
      setProcessando(false);
    }
  };

  const salvarRota = async () => {
    if (!rota) return;

    try {
      const payload = {
        sequencia: rota.sequencia,
        distancia_total: rota.distancia_total,
      };

      const resp = await fetch("/api/proxy/rotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) throw new Error("Erro ao salvar rota.");

      router.push("/rotas");
    } catch (e: any) {
      setErro(e.message);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logo" />
        </div>
        <nav>
          <Link href="/inicio">Início</Link>
          <Link className={styles.active} href="/nova-rota">
            Nova Rota
          </Link>
          <Link href="/entregas">Pedidos</Link>
          <Link href="/produtos">Produtos</Link>
          <Link href="/configuracoes">Usuários</Link>
        </nav>
      </aside>

      {/* Conteúdo */}
      <main className={styles.content}>
        <header className={styles.topbar}>
          <h2>Nova Rota</h2>

          <div className={styles.user}>
            <div className={styles.avatar}>{avatarLetter}</div>
            <div>
              <strong>{displayName}</strong>
              <small>Administrador</small>
            </div>
            <button
              className={`${styles.btn} ${styles.ghost}`}
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sair
            </button>
          </div>
        </header>

        <section className={styles.card}>
          <h3>Selecione os pedidos para otimizar</h3>

          {carregandoPedidos ? (
            <p>Carregando pedidos...</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th></th>
                    <th>ID</th>
                    <th>NF</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selecionados.includes(p.id)}
                          onChange={() => toggleSelecionar(p.id)}
                        />
                      </td>
                      <td>{p.id}</td>
                      <td>{p.nf}</td>
                      <td>{p.latitude}</td>
                      <td>{p.longitude}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles["quick-actions"]}>
            <button
              className={`${styles.btn} ${styles.primary}`}
              onClick={otimizarRota}
              disabled={processando}
            >
              {processando ? "Processando..." : "🔍 Otimizar Rota (AG)"}
            </button>
          </div>

          {erro && <p className={styles.muted}>{erro}</p>}

          {rota && (
            <div>
              <h3>Resultado da Rota</h3>
              <p>
                <strong>Distância total:</strong> {rota.distancia_total.toFixed(2)} km
              </p>

              <RouteMapViewer
                pontos={[
                  { ...deposito, label: "Depósito" },
                  ...rota.pontos_mapa.map((p: any, i: number) => ({
                    latitude: p.latitude,
                    longitude: p.longitude,
                    label: `Parada ${i + 1}`,
                  })),
                ]}
              />

              <div className={styles["quick-actions"]}>
                <button
                  className={`${styles.btn} ${styles.primary}`}
                  onClick={salvarRota}
                >
                  💾 Salvar Rota
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
