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

// Monta link para Google Maps com origem fixa e múltiplas paradas
const buildMapsLink = (coords: { latitude: number; longitude: number }[]) => {
  if (!coords || coords.length === 0) return null;

  // ponto de partida padrão (ajuste conforme necessário)
  const depositoLat = -27.3585648;
  const depositoLng = -53.3996933;

  const origin = `${depositoLat},${depositoLng}`;
  const destination = `${coords[coords.length - 1].latitude},${coords[coords.length - 1].longitude}`;
  const waypoints = coords.slice(0, -1).map((c) => `${c.latitude},${c.longitude}`).join("|");

  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("origin", origin);
  params.set("destination", destination);
  if (waypoints) params.set("waypoints", waypoints);
  params.set("travelmode", "driving");

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export default function RotasPage() {
  const { data: session } = useSession();
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [rotaDetails, setRotaDetails] = useState<Record<number, Rota>>({});
  const [optimizedCoords, setOptimizedCoords] = useState<Record<number, { latitude: number; longitude: number }[]>>({});
  const [modalPedidos, setModalPedidos] = useState<{ rotaId: number; pedidos: RotaPedido[] } | null>(null);
  const [loadingPedidosId, setLoadingPedidosId] = useState<number | null>(null);
  const [loadingMapsId, setLoadingMapsId] = useState<number | null>(null); 

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
        const resp = await fetch("/api/proxy/rotas?limit=500", { cache: "no-store" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseError(raw, "Não foi possível carregar as rotas.", resp.status));
        const data = JSON.parse(raw) as API<APIGetRotasResponse>;
        if (!data.success) throw new Error(data.detail || "Erro ao buscar rotas.");
        if (!active) return;
        const results = data.data?.results ?? [];
        setRotas(results);
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

  // carrega detalhes e otimiza ordem
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (rotas.length === 0) {
        setRotaDetails({});
        setOptimizedCoords({});
        return;
      }
      try {
        const detailList = await Promise.all(
          rotas.map(async (r) => {
            try {
              const dResp = await fetch(`/api/proxy/rotas/${r.id}`, { cache: "no-store" });
              const txt = await dResp.text();
              if (!dResp.ok) return null;
              const parsed = JSON.parse(txt) as API<APIGetRotaResponse>;
              if (!parsed.success || !parsed.data) return null;
              return parsed.data;
            } catch {
              return null;
            }
          })
        );
        const detailMap: Record<number, Rota> = {};
        detailList.forEach((d) => {
          if (d?.id) detailMap[d.id] = d;
        });
        if (!active) return;
        setRotaDetails(detailMap);

        // otimiza ordem chamando backend de otimização
        const optEntries = await Promise.all(
          Object.values(detailMap).map(async (d) => {
            const pedidosIds = Array.isArray(d.pedidos) ? d.pedidos.map((p) => p.pedido.id) : [];
            if (pedidosIds.length < 2) return { id: d.id, coords: null as any };
            try {
              const payload = {
                pedidos_ids: pedidosIds,
                deposito: { latitude: -27.3585648, longitude: -53.3996933 },
              };
              const resp = await fetch("/api/proxy/otimizar-rota-genetico", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const txt = await resp.text();
              const data = JSON.parse(txt);
              const ordemIdx: number[] = data?.resultado?.rota_otimizada ?? [];
              const pedidosOrdenados =
                ordemIdx.length > 0
                  ? ordemIdx
                      .map((idx) => d.pedidos?.[idx])
                      .filter(Boolean)
                      .map((p) => {
                        const lat = typeof p!.pedido.latitude === "string" ? parseFloat(p!.pedido.latitude) : p!.pedido.latitude;
                        const lng = typeof p!.pedido.longitude === "string" ? parseFloat(p!.pedido.longitude) : p!.pedido.longitude;
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                        return { latitude: lat, longitude: lng };
                      })
                      .filter(Boolean)
                  : null;
              return { id: d.id, coords: pedidosOrdenados };
            } catch {
              return { id: d.id, coords: null as any };
            }
          })
        );
        const optMap: Record<number, { latitude: number; longitude: number }[]> = {};
        optEntries.forEach((e) => {
          if (e.id && e.coords && e.coords.length > 0) optMap[e.id] = e.coords;
        });
        if (active) setOptimizedCoords(optMap);
      } catch {
        /* ignore */
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [rotas]);

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
                <th>Total pedidos</th>
                <th>Peso total</th>
                <th>Mapa</th>
                <th>Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6}>Carregando rotas...</td>
                </tr>
              )}
              {!loading && rotas.length === 0 && (
                <tr>
                  <td colSpan={6}>Nenhuma rota cadastrada.</td>
                </tr>
              )}
              {!loading &&
                rotas.map((rota) => (
                  <tr key={rota.id}>
                    <td>{rota.id}</td>
                    <td>{formatDate(rota.data_rota)}</td>
                    <td>{rota.total_pedidos ?? rota.pedidos?.length ?? 0}</td>
                    <td>{formatWeight(rota.peso_total_pedidos)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                          onClick={async () => {
                            setLoadingMapsId(rota.id);
                            try {
                              let det = rotaDetails[rota.id];
                              if (!det) {
                                const fetched = await fetchRotaDetail(rota.id);
                                det = fetched;
                              }
                              const pedidos = Array.isArray(det?.pedidos) ? [...det.pedidos] : [];
                              pedidos.sort((a, b) => (a.ordem_entrega || 0) - (b.ordem_entrega || 0));
                              let coords = optimizedCoords[rota.id];
                              if (!coords) {
                                const opt = await optimizeCoords(rota.id, det!);
                                coords = opt || pedidos
                                  .map((p) => {
                                    const lat = typeof p.pedido.latitude === "string" ? parseFloat(p.pedido.latitude) : p.pedido.latitude;
                                    const lng = typeof p.pedido.longitude === "string" ? parseFloat(p.pedido.longitude) : p.pedido.longitude;
                                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                                    return { latitude: lat, longitude: lng };
                                  })
                                  .filter(Boolean) as { latitude: number; longitude: number }[];
                                if (coords && coords.length > 0) {
                                  setOptimizedCoords((prev) => ({ ...prev, [rota.id]: coords! }));
                                }
                              }
                              if (coords && coords.length > 0) {
                                const link = buildMapsLink(coords);
                                if (link) window.open(link, "_blank", "noopener,noreferrer");
                              }
                            } finally {
                              setLoadingMapsId(null);
                            }
                          }}
                          disabled={loadingMapsId === rota.id}
                        >
                          {loadingMapsId === rota.id ? "Abrindo..." : "Abrir no Maps"}
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                        onClick={() => {
                          setLoadingPedidosId(rota.id);
                          const run = async () => {
                            try {
                              let det = rotaDetails[rota.id];
                              if (!det) {
                                det = await fetchRotaDetail(rota.id);
                              }
                              const pedidos = Array.isArray(det?.pedidos) ? [...det.pedidos] : [];
                              pedidos.sort((a, b) => (a.ordem_entrega || 0) - (b.ordem_entrega || 0));
                              setModalPedidos({ rotaId: rota.id, pedidos });
                            } finally {
                              setLoadingPedidosId(null);
                            }
                          };
                          run();
                        }}
                        disabled={loadingPedidosId === rota.id}
                      >
                        {loadingPedidosId === rota.id ? "Carregando..." : "Visualizar pedidos"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {modalPedidos && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2000,
              }}
              onClick={() => setModalPedidos(null)}
            >
              <div
                className={styles.card}
                style={{
                  maxWidth: "520px",
                  width: "90%",
                  maxHeight: "70vh",
                  overflow: "auto",
                  padding: "16px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Pedidos da rota #{modalPedidos.rotaId}</strong>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                    onClick={() => setModalPedidos(null)}
                  >
                    Fechar
                  </button>
                </div>
                {modalPedidos.pedidos.length === 0 && <p className={styles.muted}>Nenhum pedido carregado.</p>}
                {modalPedidos.pedidos.length > 0 && (
                  <ul style={{ marginTop: 12, paddingLeft: 16, display: "grid", gap: 8 }}>
                    {modalPedidos.pedidos.map((p) => (
                      <li key={p.pedido.id}>
                        <div>
                          <strong>Pedido {p.pedido.id}</strong> — NF {p.pedido.nf} — Cliente: {p.pedido.cliente ?? "-"}
                        </div>
                        <div className={styles.muted}>
                          Lat: {p.pedido.latitude}, Lng: {p.pedido.longitude}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
