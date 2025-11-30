"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "../../../inicio/styles.module.css";

// Importação dinâmica do seletor de mapa
const MapLocationPicker = dynamic(
  () => import("@/components/MapLocationPicker").then((m) => m.MapLocationPicker),
  { ssr: false }
);

const inter = InterFont({ subsets: ["latin"] });

type PedidoItem = { produtoId: string; quantidade: string };

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
      return `${fallback} (status ${status ?? "desconhecido"}). Verifique logs.`;
    }
  }
  return raw || fallback;
};

export default function EditarPedidoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuário").toString(),
    [session?.user?.name, session?.user?.email]
  );

  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  const [form, setForm] = useState({
    nf: "",
    cliente: "",
    dtpedido: "",
    observacao: "",
    latitude: "",
    longitude: "",
  });

  const [itens, setItens] = useState<PedidoItem[]>([{ produtoId: "", quantidade: "" }]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [loadingPedido, setLoadingPedido] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // mostrar/ocultar mapa
  const [showMap, setShowMap] = useState(false);

  // atualiza latitude/longitude ao clicar no mapa
  const handleLocationSelect = (coords: { latitude: number; longitude: number }) => {
    setForm((prev) => ({
      ...prev,
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
    }));
  };

  // ------------ CARREGA PRODUTOS ------------------
  useEffect(() => {
    let active = true;
    const loadProdutos = async () => {
      setLoadingProdutos(true);
      try {
        const resp = await fetch("/api/proxy/produtos", { cache: "no-store" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseError(raw, "Falha ao carregar produtos.", resp.status));

        const data = JSON.parse(raw) as API<APIGetProdutosResponse>;
        if (!data.success) throw new Error(data.detail || "Erro ao buscar produtos.");

        if (active) setProdutos(data.data?.results ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar produtos.");
      } finally {
        if (active) setLoadingProdutos(false);
      }
    };
    loadProdutos();
    return () => {
      active = false;
    };
  }, []);

  // ---------- CARREGA PEDIDO EXISTENTE ----------
  useEffect(() => {
    const id = params.id;
    if (!id) return;
    let active = true;

    const loadPedido = async () => {
      setLoadingPedido(true);
      try {
        const resp = await fetch(`/api/proxy/pedidos/${id}`, { cache: "no-store" });
        const raw = await resp.text();

        if (!resp.ok) throw new Error(parseError(raw, "Falha ao carregar pedido.", resp.status));

        const parsed = raw ? (JSON.parse(raw) as Pedido | API<APIGetPedidoResponse>) : null;
        let data: Pedido | null = null;

        if (parsed && typeof (parsed as API<APIGetPedidoResponse>).success === "boolean") {
          const api = parsed as API<APIGetPedidoResponse>;
          if (!api.success || !api.data) throw new Error(api.detail || "Pedido não encontrado.");
          data = api.data;
        } else {
          data = parsed as Pedido;
        }

        if (!data) throw new Error("Pedido não encontrado.");

        if (!active) return;

        setForm({
          nf: data.nf ? String(data.nf) : "",
          dtpedido: data.dtpedido ? data.dtpedido.slice(0, 10) : "",
          observacao: data.observacao ?? "",
          latitude: data.latitude !== null ? String(data.latitude) : "",
          longitude: data.longitude !== null ? String(data.longitude) : "",
        });

        setItens(
          data.itens?.length
            ? data.itens.map((it) => ({
                produtoId: String(it.produto.id),
                quantidade: String(it.quantidade),
              }))
            : [{ produtoId: "", quantidade: "" }]
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar o pedido.");
      } finally {
        if (active) setLoadingPedido(false);
      }
    };

    loadPedido();
    return () => {
      active = false;
    };
  }, [params.id]);

  // ------------ ADICIONAR/REMOVER ITENS ----------------
  const addItem = () => setItens((prev) => [...prev, { produtoId: "", quantidade: "" }]);
  const removeItem = (idx: number) => setItens((prev) => prev.filter((_, i) => i !== idx));
  const handleItemChange = (idx: number, field: keyof PedidoItem, value: string) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  // ------------ SALVAR FORMULÁRIO ----------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const sanitizeNumber = (val: string) => {
      const n = Number(val.replace(",", "."));
      return Number.isNaN(n) ? null : n;
    };

    if (!form.nf.trim() || Number.isNaN(Number(form.nf))) {
      setError("Informe a NF.");
      return;
    }
    if (!form.cliente.trim()) {
      setError("Informe o cliente.");
      return;
    }

    if (!form.dtpedido.trim()) {
      setError("Informe a data do pedido.");
      return;
    }

    const itensValidos = itens.filter((i) => i.produtoId && Number(i.quantidade) > 0);
    if (itensValidos.length === 0) {
      setError("Inclua ao menos um item com quantidade.");
      return;
    }

    const latNum = sanitizeNumber(form.latitude);
    const lngNum = sanitizeNumber(form.longitude);
    if (latNum === null || lngNum === null) {
      setError("Informe latitude e longitude válidas.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nf: Number(form.nf),
        cliente: form.cliente.trim(),
        dtpedido: form.dtpedido,
        observacao: form.observacao || null,
        latitude: latNum,
        longitude: lngNum,
        itens: itensValidos.map((i) => ({
          produto_id: Number(i.produtoId),
          quantidade: Number(i.quantidade),
        })),
      };

      const resp = await fetch(`/api/proxy/pedidos/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();

      if (!resp.ok) throw new Error(parseError(text, "Falha ao atualizar pedido.", resp.status));

      try {
        const parsed = JSON.parse(text) as API<unknown>;
        if (typeof parsed.success === "boolean" && !parsed.success) {
          throw new Error(parsed.detail || "Falha ao atualizar pedido.");
        }
      } catch {}

      router.push("/entregas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const loading = loadingPedido || loadingProdutos;

  // ---------------------- RENDER ---------------------
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
          <div>
            <h2>Editar pedido</h2>
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

        <section className={styles.card}>
          <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} onClick={() => router.back()}>
            Voltar
          </button>

          {!loading ? (
            <form className={styles.form} onSubmit={handleSubmit}>

              <div className={styles.field}>
                <label htmlFor="nf">NF</label>
                <input
                  id="nf"
                  className={styles.input}
                  value={form.nf}
                  onChange={(e) => setForm((prev) => ({ ...prev, nf: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="cliente">Cliente</label>
                <input
                  id="cliente"
                  className={styles.input}
                  value={form.cliente}
                  onChange={(e) => setForm((prev) => ({ ...prev, cliente: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="dtpedido">Data do pedido</label>
                <input
                  id="dtpedido"
                  type="date"
                  className={styles.input}
                  value={form.dtpedido}
                  onChange={(e) => setForm((prev) => ({ ...prev, dtpedido: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="observacao">Observação</label>
                <textarea
                  id="observacao"
                  className={styles.input}
                  value={form.observacao}
                  onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
                />
              </div>

              {/* ---------- CAMPOS DE LATITUDE/LONGITUDE COM BOTÃO DE MAPA ---------- */}
              <div className={styles.cards3}>
                <div className={styles.field}>
                  <label htmlFor="lat">Latitude</label>
                  <input
                    id="lat"
                    className={styles.input}
                    value={form.latitude}
                    onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="lng">Longitude</label>
                  <input
                    id="lng"
                    className={styles.input}
                    value={form.longitude}
                    onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                  />
                </div>

                <div className={styles.field}>
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                    onClick={() => setShowMap(!showMap)}
                  >
                    {showMap ? "Fechar mapa" : "Selecionar no mapa"}
                  </button>
                </div>
              </div>

              {showMap && (
                <div style={{ marginTop: 16, marginBottom: 16 }}>
                  <MapLocationPicker
                    initialCoords={{
                      latitude: Number(form.latitude) || -27.5969,
                      longitude: Number(form.longitude) || -53.5495,
                    }}
                    onLocationSelect={handleLocationSelect}
                  />
                </div>
              )}

              {/* ---------- ITENS ---------- */}
              <h4>Itens</h4>
              {itens.map((item, idx) => (
                <div key={idx} className={styles.cards3}>
                  <div className={styles.field}>
                    <label>Produto</label>
                    <select
                      className={styles.input}
                      value={item.produtoId}
                      onChange={(e) => handleItemChange(idx, "produtoId", e.target.value)}
                      disabled={loadingProdutos}
                    >
                      <option value="">Selecione</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label>Quantidade</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(e) => handleItemChange(idx, "quantidade", e.target.value)}
                    />
                  </div>

                  <div className={styles.field}>
                    <label>&nbsp;</label>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                      onClick={() => removeItem(idx)}
                      disabled={itens.length === 1}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}

              <div className={styles["quick-actions"]}>
                <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={addItem}>
                  + Adicionar item
                </button>
              </div>

              {error && <p className={styles.muted}>{error}</p>}

              <div className={styles["quick-actions"]}>
                <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={submitting}>
                  {submitting ? "Salvando..." : "Salvar"}
                </button>
              </div>

            </form>
          ) : (
            <p className={styles.muted}>Carregando pedido...</p>
          )}
        </section>
      </main>
    </div>
  );
}
