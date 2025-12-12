// logistics-frontend/src/app/entregas/novo/page.tsx (ATUALIZADO)
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import dynamic from "next/dynamic";
import styles from "../../inicio/styles.module.css";
import { extractMessage, parseApiError } from "@/lib/apiError";
import { AppSidebar } from "@/components/navigation/AppSidebar";

// Importa o componente do mapa dinamicamente (client-side only)
const MapLocationPicker = dynamic(
  () => import("@/components/MapLocationPicker").then((mod) => ({ default: mod.MapLocationPicker })),
  { ssr: false, loading: () => <div>Carregando mapa...</div> }
);

const inter = InterFont({ subsets: ["latin"] });

type PedidoItem = { produtoId: string; quantidade: string };
type CreatePedidoPayload = {
  nf: number;
  cliente: string;
  cidade: string;
  dtpedido: string;
  observacao: string | null;
  latitude: number;
  longitude: number;
  itens: { produto_id: number; quantidade: number }[];
};

type SplitSuggestion = {
  message: string;
  grupos: PedidoRestricaoGrupoSugestao[];
  conflitos: string[];
};

const safeJsonParse = <T,>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const normalizeToArray = <T,>(value: unknown): T[] => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeToArray<T>(entry as unknown));
  }
  return [value as T];
};

const hasSplitMarker = (obj: Record<string, unknown>): boolean => {
  const codeList = normalizeToArray<string>(obj.code);
  if (codeList.includes("familias_incompativeis")) return true;
  const errorList = normalizeToArray<string>(obj.error);
  if (errorList.includes("familias_incompativeis")) return true;
  if (normalizeToArray<boolean>(obj.pode_dividir).includes(true)) return true;
  return false;
};

const findSplitPayload = (value: unknown): any | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findSplitPayload(entry);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (hasSplitMarker(obj)) {
      return obj;
    }
    for (const key of Object.keys(obj)) {
      const found = findSplitPayload(obj[key]);
      if (found) return found;
    }
  }
  return null;
};

const parseSplitSuggestion = (raw: any): SplitSuggestion | null => {
  if (!raw) return null;
  const payload = findSplitPayload(raw);
  if (!payload) return null;
  const message =
    normalizeToArray<string>(
      payload.detail ?? raw.detail ?? payload.message ?? raw.message ?? payload.non_field_errors ?? raw.non_field_errors
    )[0] ?? "Pedido possui produtos de famílias incompatíveis. Divida os itens para prosseguir.";
  const conflitos = normalizeToArray<string>(payload.conflitos ?? raw.conflitos);
  const grupos = normalizeToArray<PedidoRestricaoGrupoSugestao>(payload.grupos ?? raw.grupos);
  return {
    message,
    conflitos,
    grupos,
  };
};

export default function NovoPedidoPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuário").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const roleLabel = session?.user?.is_superuser ? "Administrador" : session?.user?.profile?.name || "Usuário padrão";
  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  const [form, setForm] = useState({
    nf: "",
    cliente: "",
    cidade: "",
    dtpedido: "",
    observacao: "",
    latitude: "",
    longitude: "",
  });
  const [itens, setItens] = useState<PedidoItem[]>([{ produtoId: "", quantidade: "" }]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [splitSuggestion, setSplitSuggestion] = useState<SplitSuggestion | null>(null);
  const [lastPayload, setLastPayload] = useState<CreatePedidoPayload | null>(null);
  const [splitting, setSplitting] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingProdutos(true);
      setError(null);
      try {
        const resp = await fetch("/api/proxy/produtos", { cache: "no-store" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseApiError(raw, "Falha ao carregar produtos.", resp.status));
        const data = JSON.parse(raw) as API<APIGetProdutosResponse>;
        if (!data.success) throw new Error(data.detail || "Erro ao buscar produtos.");
        if (!active) return;
        setProdutos(data.data?.results ?? []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar produtos.");
      } finally {
        if (active) setLoadingProdutos(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const addItem = () => setItens((prev) => [...prev, { produtoId: "", quantidade: "" }]);
  const removeItem = (idx: number) => setItens((prev) => prev.filter((_, i) => i !== idx));

  const handleItemChange = (idx: number, field: keyof PedidoItem, value: string) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const handleLocationSelect = (coords: { latitude: number; longitude: number }) => {
    setForm((prev) => ({
      ...prev,
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
    }));
  };

  const handleDividirPedido = async () => {
    if (!lastPayload) return;
    setError(null);
    setSplitting(true);
    try {
      const resp = await fetch("/api/proxy/pedidos/dividir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastPayload),
      });
      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(parseApiError(text, "Não foi possível dividir o pedido.", resp.status));
      }
      const parsed = text ? safeJsonParse<APIDividirPedidoResponse>(text) : null;
      if (parsed && parsed.dividido === false) {
        throw new Error(parsed.mensagem || "Falha ao dividir o pedido.");
      }
      router.push("/pedidos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao dividir o pedido.");
    } finally {
      setSplitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSplitSuggestion(null);
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
    if (!form.cidade.trim()) {
      setError("Informe a cidade.");
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
      setError("Informe latitude e longitude válidas (use ponto ou vírgula, ou selecione no mapa).");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreatePedidoPayload = {
        nf: Number(form.nf),
        cliente: form.cliente.trim(),
        cidade: form.cidade.trim(),
        dtpedido: form.dtpedido,
        observacao: form.observacao || null,
        latitude: latNum,
        longitude: lngNum,
        itens: itensValidos.map((i) => ({
          produto_id: Number(i.produtoId),
          quantidade: Number(i.quantidade),
        })),
      };
      setLastPayload(payload);
      const resp = await fetch("/api/proxy/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      if (!resp.ok) {
        const parsedError = safeJsonParse<any>(text);
        if (resp.status === 400 && parsedError) {
          const suggestion = parseSplitSuggestion(parsedError);
          if (suggestion) {
            setSplitSuggestion(suggestion);
            setError(suggestion.message);
            return;
          }
        }
        throw new Error(parseApiError(text, "Falha ao cadastrar pedido.", resp.status));
      }
      if (text) {
        try {
          const parsed = JSON.parse(text) as API<unknown>;
          if (typeof parsed.success === "boolean" && !parsed.success) {
            const friendly =
              extractMessage((parsed as any).detail) ??
              extractMessage((parsed as any).data) ??
              "Falha ao cadastrar pedido.";
            throw new Error(friendly);
          }
        } catch {
          /* se não for JSON, apenas segue adiante */
        }
      }
      router.push("/pedidos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <AppSidebar active="pedidos" />
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <h2>Novo pedido</h2>
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

        <section className={styles.card}>
          <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} onClick={() => router.back()}>
            Voltar
          </button>
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
              <label htmlFor="cidade">Cidade</label>
              <input
                id="cidade"
                className={styles.input}
                value={form.cidade}
                onChange={(e) => setForm((prev) => ({ ...prev, cidade: e.target.value }))}
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

            <h4> Localização de Entrega</h4>
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
                  className={`${styles.btn} ${styles.ghost}`}
                  onClick={() => setShowMap(!showMap)}
                >
                  {showMap ? " Ocultar Mapa" : " Selecionar no Mapa"}
                </button>
              </div>
            </div>

            {showMap && (
              <div style={{ marginTop: "16px", marginBottom: "16px" }}>
                <MapLocationPicker
                  initialCoords={
                    form.latitude && form.longitude
                      ? { latitude: Number(form.latitude), longitude: Number(form.longitude) }
                      : undefined
                  }
                  onLocationSelect={handleLocationSelect}
                />
              </div>
            )}

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
            {splitSuggestion && (
              <div className={styles.splitAlert} role="alert">
                <div>
                  <strong>{splitSuggestion.message}</strong>
                  {splitSuggestion.conflitos.length > 0 && (
                    <p className={styles.splitDetails}>
                      Conflitos: {splitSuggestion.conflitos.join(", ")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.primary}`}
                  onClick={handleDividirPedido}
                  disabled={!lastPayload || splitting}
                >
                  {splitting ? "Dividindo..." : "Dividir pedido"}
                </button>
              </div>
            )}
            <div className={styles["quick-actions"]}>
              <button
                type="submit"
                className={`${styles.btn} ${styles.primary}`}
                disabled={submitting || splitting}
              >
                {submitting ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
