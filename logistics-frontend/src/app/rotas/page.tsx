"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, ChangeEvent, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import styles from "../inicio/styles.module.css";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import RouteMapViewer from "@/components/RouteMapViewer";
import { parseApiError } from "@/lib/apiError";
import { statusLabels } from "@/constants/labels";
const inter = InterFont({ subsets: ["latin"] });
const defaultDeposito = { latitude: -27.3586, longitude: -53.3958 };
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
      return `${styles.badge} ${styles.late}`;
    case "EM_EXECUCAO":
      return `${styles.badge} ${styles.statusInfo}`;
    case "CONCLUIDA":
      return `${styles.badge} ${styles.done}`;
    default:
      return styles.badge;
  }
};
// Monta link para Google Maps com origem selecionada e multiplas paradas
const buildMapsLink = (
  coords: { latitude: number; longitude: number }[],
  deposito: { latitude: number; longitude: number } = defaultDeposito
) => {
  if (!coords || coords.length === 0) return null;
  const lat = Number(deposito?.latitude);
  const lng = Number(deposito?.longitude);
  const origin =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat},${lng}`
      : `${defaultDeposito.latitude},${defaultDeposito.longitude}`;
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const roleLabel = session?.user?.is_superuser ? "Administrador" : session?.user?.profile?.name || "Usuário padrão";
  const deniedAccess = searchParams?.get("acesso") === "negado";
  const isDefaultProfile = !!session?.user?.profile?.is_default;
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [rotaDetails, setRotaDetails] = useState<Record<number, Rota>>({});
  const [modalPedidos, setModalPedidos] = useState<{ rotaId: number; pedidos: RotaPedido[] } | null>(null);
  const [loadingPedidosId, setLoadingPedidosId] = useState<number | null>(null);
  const [loadingMapsId, setLoadingMapsId] = useState<number | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<number | null>(null);
  const [optimizedCoords, setOptimizedCoords] = useState<Record<number, { latitude: number; longitude: number }[]>>({});
  const [snapshotCoords, setSnapshotCoords] = useState<{ latitude: number; longitude: number; label?: string }[] | null>(
    null
  );
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [editingRota, setEditingRota] = useState<{ id: number; data_rota: string; capacidade_max: number } | null>(null);
  const [editingErrors, setEditingErrors] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingRotaId, setDeletingRotaId] = useState<number | null>(null);
  const snapshotRef = useRef<HTMLDivElement | null>(null);
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const ensureHtml2Canvas = async () => {
    if (typeof window === "undefined") return null;
    if ((window as any).html2canvas) return (window as any).html2canvas;
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById("html2canvas-js") as HTMLScriptElement | null;
      if (existing) {
        existing.onload = () => resolve();
        existing.onerror = () => reject(new Error("Falha ao carregar html2canvas"));
        return;
      }
      const script = document.createElement("script");
      script.id = "html2canvas-js";
      script.src = "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Falha ao carregar html2canvas"));
      document.body.appendChild(script);
    });
    return (window as any).html2canvas || null;
  };
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
        if (!resp.ok) throw new Error(parseApiError(raw, "Não foi possível carregar as rotas.", resp.status));
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
  const fetchRotaDetail = async (rotaId: number): Promise<Rota | null> => {
    try {
      const dResp = await fetch(`/api/proxy/rotas/${rotaId}`, { cache: "no-store" });
      const txt = await dResp.text();
      if (!dResp.ok) return null;
      const parsed = JSON.parse(txt) as API<APIGetRotaResponse>;
      if (!parsed.success || !parsed.data) return null;
      setRotaDetails((prev) => ({ ...prev, [rotaId]: parsed.data }));
      return parsed.data;
    } catch {
      return null;
    }
  };
  const capturarMapa = async (coords: { latitude: number; longitude: number; label?: string }[]) => {
    if (!coords || coords.length === 0) return null;
    setSnapshotCoords(coords);
    await sleep(800); // tempo para o Leaflet carregar tiles
    const html2canvas = await ensureHtml2Canvas();
    if (!html2canvas || !snapshotRef.current) return null;
    try {
      const canvas = await html2canvas(snapshotRef.current, { useCORS: true, scale: 2 });
      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl.startsWith("data:image/png;base64,")) return null;
      return dataUrl.replace("data:image/png;base64,", "");
    } catch (err) {
      console.warn("Falha ao capturar mapa para o PDF", err);
      return null;
    }
  };

  const buildCoordsFromRota = (rota: Rota): { latitude: number; longitude: number }[] => {
    const pedidos = Array.isArray(rota?.pedidos) ? [...rota.pedidos] : [];
    pedidos.sort((a, b) => (a.ordem_entrega || 0) - (b.ordem_entrega || 0));
    return pedidos
      .map((p) => {
        const lat = typeof p.pedido.latitude === "string" ? parseFloat(p.pedido.latitude) : p.pedido.latitude;
        const lng = typeof p.pedido.longitude === "string" ? parseFloat(p.pedido.longitude) : p.pedido.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { latitude: lat, longitude: lng };
      })
      .filter(Boolean) as { latitude: number; longitude: number }[];
  };

  const ensureCoords = async (rotaId: number): Promise<{ latitude: number; longitude: number }[] | null> => {
    let det = rotaDetails[rotaId];
    if (!det) {
      det = await fetchRotaDetail(rotaId);
    }
    if (!det) return null;
    const coords = buildCoordsFromRota(det);
    setOptimizedCoords((prev) => ({ ...prev, [rotaId]: coords }));
    return coords;
  };

  const abrirEdicao = async (rotaId: number) => {
    let rotaInfo = rotas.find((r) => r.id === rotaId);
    if (!rotaInfo) {
      rotaInfo = await fetchRotaDetail(rotaId);
    }
    if (!rotaInfo) return;
    const data = rotaInfo.data_rota || rotaInfo.created_at || new Date().toISOString();
    const dataIso = data.slice(0, 10);
    setEditingErrors(null);
    setEditingRota({ id: rotaInfo.id, data_rota: dataIso, capacidade_max: Number(rotaInfo.capacidade_max) || 0 });
  };

  const salvarEdicao = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingRota) return;
    setSavingEdit(true);
    setEditingErrors(null);
    try {
      const rotaOriginal = rotas.find((r) => r.id === editingRota.id);
      const resp = await fetch(`/api/proxy/rotas/${editingRota.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_rota: editingRota.data_rota,
          capacidade_max: editingRota.capacidade_max,
          status: rotaOriginal?.status ?? "PLANEJADA",
        }),
      });
      const raw = await resp.text();
      if (!resp.ok) throw new Error(parseApiError(raw, "Falha ao atualizar rota.", resp.status));
      const data = JSON.parse(raw) as API<APIGetRotaResponse>;
      if (!data.success || !data.data) throw new Error(data.detail || "Erro ao atualizar rota.");
      setRotas((prev) => prev.map((rota) => (rota.id === data.data!.id ? { ...rota, ...data.data! } : rota)));
      setRotaDetails((prev) => ({ ...prev, [data.data!.id]: data.data as Rota }));
      setStatusFeedback(`Rota #${data.data!.id} atualizada.`);
      setEditingRota(null);
    } catch (err) {
      setEditingErrors(err instanceof Error ? err.message : "Não foi possível salvar a rota.");
    } finally {
      setSavingEdit(false);
    }
  };

  const excluirRota = async (rotaId: number) => {
    if (!confirm(`Deseja excluir a rota #${rotaId}?`)) return;
    setDeletingRotaId(rotaId);
    setStatusFeedback(null);
    try {
      const resp = await fetch(`/api/proxy/rotas/${rotaId}`, {
        method: "DELETE",
      });
      const raw = await resp.text();
      if (!resp.ok) throw new Error(parseApiError(raw, "Erro ao excluir rota.", resp.status));
      setRotas((prev) => prev.filter((rota) => rota.id !== rotaId));
      setStatusFeedback(`Rota #${rotaId} excluída.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a rota.");
    } finally {
      setDeletingRotaId(null);
    }
  };

  const rotaParam = searchParams?.get("rota");
  useEffect(() => {
    if (rotaParam) {
      const numero = Number(rotaParam);
      setStatusFeedback(
        Number.isFinite(numero) ? `Rota #${numero} criada com sucesso.` : `Nova rota criada: ${rotaParam}.`
      );
    }
  }, [rotaParam]);

  const atualizarStatusRota = async (rotaId: number, novoStatus: RotaStatus) => {
    setStatusUpdatingId(rotaId);
    setStatusFeedback(null);
    try {
      const resp = await fetch(`/api/proxy/rotas/${rotaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      const raw = await resp.text();
      if (!resp.ok) throw new Error(parseApiError(raw, "Não foi possível atualizar o status da rota.", resp.status));
      const data = JSON.parse(raw) as API<APIGetRotaResponse>;
      if (!data.success || !data.data) throw new Error(data.detail || "Erro ao atualizar status da rota.");
      setRotas((prev) => prev.map((rota) => (rota.id === rotaId ? { ...rota, ...data.data } : rota)));
      setRotaDetails((prev) => ({ ...prev, [rotaId]: data.data as Rota }));
      setStatusFeedback(`Rota #${rotaId} marcada como ${statusLabels[data.data.status] ?? data.data.status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar status da rota.");
    } finally {
      setStatusUpdatingId(null);
    }
  };
  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <AppSidebar active="rotas" />
      <main className={styles.content}>
        {loading && <LoadingOverlay message="Carregando rotas..." />}
        {deniedAccess && (
          <div className={styles.alert}>Acesso não permitido para a tela solicitada.</div>
        )}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageActions}>
              {!isDefaultProfile && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.ghost}`}
                  onClick={() => router.push("/pedidos")}
                >
                  Selecionar pedidos
                </button>
              )}
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
          {!error && statusFeedback && <p className={styles.muted}>{statusFeedback}</p>}
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Data</th>
                <th>Total pedidos</th>
                <th>Peso total</th>
                <th>Status</th>
                <th>Mapa</th>
                <th>Relatório</th>
                <th>Pedidos</th>
                <th>Gerenciar</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9}>Carregando rotas...</td>
                </tr>
              )}
              {!loading && rotas.length === 0 && (
                <tr>
                  <td colSpan={9}>Nenhuma rota cadastrada.</td>
                </tr>
              )}
              {!loading &&
                rotas.map((rota) => (
                  <tr key={rota.id}>
                    <td>{rota.id}</td>
                    <td>{formatDate(rota.created_at || rota.data_rota)}</td>
                    <td>{rota.total_pedidos ?? rota.pedidos?.length ?? 0}</td>
                    <td>{formatWeight(rota.peso_total_pedidos)}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span className={statusBadge(rota.status)}>{statusLabels[rota.status] ?? rota.status}</span>
                        {rota.status === "PLANEJADA" && (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                            onClick={() => atualizarStatusRota(rota.id, "EM_EXECUCAO")}
                            disabled={statusUpdatingId === rota.id}
                          >
                            {statusUpdatingId === rota.id ? "Atualizando..." : "Iniciar rota"}
                          </button>
                        )}
                        {rota.status === "EM_EXECUCAO" && (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                            onClick={() => atualizarStatusRota(rota.id, "CONCLUIDA")}
                            disabled={statusUpdatingId === rota.id}
                          >
                            {statusUpdatingId === rota.id ? "Atualizando..." : "Finalizar rota"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={`${styles.actionsRow} ${styles.actionsInline}`}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                          onClick={async () => {
                            setLoadingMapsId(rota.id);
                            try {
                              let det = rotaDetails[rota.id];
                              let coords = optimizedCoords[rota.id];
                              if (!coords) {
                                coords = await ensureCoords(rota.id);
                              }
                              if (coords && coords.length > 0) {
                                const link = buildMapsLink(coords, defaultDeposito);
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
                      <div className={`${styles.actionsRow} ${styles.actionsInline}`}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                          onClick={async () => {
                          setLoadingPdfId(rota.id);
                          try {
                            let det = rotaDetails[rota.id] || (await fetchRotaDetail(rota.id));
                            if (!det) throw new Error("Rota nao encontrada");
                            const coords = buildCoordsFromRota(det).map((c, idx) => ({
                              ...c,
                              label: `#${idx + 1}`,
                            }));
                            const depositoPayload = defaultDeposito;
                            const coordsForMap =
                              coords.length > 0 ? [{ ...depositoPayload, label: "Dep" }, ...coords] : coords;
                            let mapImageBase64: string | null = null;
                            if (coordsForMap.length > 0) {
                              mapImageBase64 = await capturarMapa(coordsForMap);
                            }
                            const payload: any = { rota_id: rota.id, deposito: depositoPayload };
                            if (mapImageBase64) payload.map_image_base64 = mapImageBase64;
                            const resp = await fetch("/api/proxy/rotas/relatorio-pdf", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(payload),
                            });
                            const contentType = resp.headers.get("content-type") || "";
                            if (!resp.ok || !contentType.includes("pdf")) {
                              const raw = await resp.text();
                              throw new Error(parseApiError(raw, "Falha ao gerar PDF da rota.", resp.status));
                            }
                            const blob = await resp.blob();
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `relatorio_rota_${rota.id}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Nao foi possivel baixar o relatorio.");
                          } finally {
                            setLoadingPdfId(null);
                          }
                        }}
                          disabled={loadingPdfId === rota.id}
                        >
                          {loadingPdfId === rota.id ? "Gerando..." : "Baixar PDF"}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className={`${styles.actionsRow} ${styles.actionsInline}`}>
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
                      </div>
                    </td>
                    <td>
                      <div className={styles.actionsRow}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                          onClick={() => abrirEdicao(rota.id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                          onClick={() => excluirRota(rota.id)}
                          disabled={deletingRotaId === rota.id}
                        >
                          {deletingRotaId === rota.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
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
          {editingRota && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2100,
              }}
              onClick={() => !savingEdit && setEditingRota(null)}
            >
              <form
                onSubmit={salvarEdicao}
                className={styles.card}
                style={{ maxWidth: 420, width: "92%", display: "flex", flexDirection: "column", gap: 12 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles["card-head"]}>
                  <strong>Editar rota #{editingRota.id}</strong>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                    onClick={() => setEditingRota(null)}
                    disabled={savingEdit}
                  >
                    Fechar
                  </button>
                </div>
                {editingErrors && <p className={styles.muted}>{editingErrors}</p>}
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Data da rota</span>
                  <input
                    type="date"
                    value={editingRota.data_rota}
                    onChange={(e) =>
                      setEditingRota((prev) => (prev ? { ...prev, data_rota: e.target.value } : prev))
                    }
                    className={styles.input}
                    required
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Capacidade máxima</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRota.capacidade_max}
                    onChange={(e) =>
                      setEditingRota((prev) =>
                        prev ? { ...prev, capacidade_max: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className={styles.input}
                    required
                  />
                </label>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                    onClick={() => setEditingRota(null)}
                    disabled={savingEdit}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={`${styles.btn} ${styles.primary} ${styles.sm}`}
                    disabled={savingEdit}
                  >
                    {savingEdit ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
        {/* Container oculto para renderizar o mapa a ser capturado para o PDF */}
        <div
          ref={snapshotRef}
          style={{ position: "absolute", left: "-9999px", top: 0, width: "600px", height: "400px" }}
          aria-hidden
        >
          {snapshotCoords && snapshotCoords.length > 0 && <RouteMapViewer pontos={snapshotCoords} />}
        </div>
      </main>
    </div>
  );
}
