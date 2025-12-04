"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "../../inicio/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

const extractErrorMessage = (raw: string, fallback: string, status?: number) => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.detail) return parsed.detail as string;
    const firstKey = parsed && Object.keys(parsed)[0];
    if (firstKey) {
      const val = parsed[firstKey];
      if (Array.isArray(val)) return String(val[0]);
      if (typeof val === "string") return val;
    }
    if (typeof parsed === "string") return parsed;
  } catch {
    const trimmed = raw.trim();
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
      return `${fallback} (status ${status ?? "desconhecido"}). Verifique os logs do backend.`;
    }
  }
  return raw || fallback;
};

export default function NovoProdutoPage() {
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

  const [form, setForm] = useState({ nome: "", peso: "", volume: "", familiaId: "", ativo: true });
  const [errors, setErrors] = useState<{ nome?: string; peso?: string; familiaId?: string }>({});
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [loadingFamilias, setLoadingFamilias] = useState(true);
  const [familiasError, setFamiliasError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const disabledSelect = loadingFamilias || !!familiasError;

  useEffect(() => {
    let active = true;
    const loadFamilies = async () => {
      setLoadingFamilias(true);
      setFamiliasError(null);
      try {
        const resp = await fetch("/api/proxy/familias", {
          cache: "no-store",
          credentials: "include",
        });
        const raw = await resp.text();
        if (!resp.ok) {
          throw new Error(
            extractErrorMessage(raw, "Falha ao carregar familias.", resp.status)
          );
        }
        if (!raw) throw new Error("Resposta vazia do backend de familias.");
        const data = JSON.parse(raw) as API<APIGetFamiliasResponse>;
        if (!data.success) throw new Error(data.detail || "Erro na API de familias.");
        if (!active) return;
        setFamilias(data.data?.results ?? []);
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Nao foi possivel buscar familias.";
        setFamiliasError(msg);
      } finally {
        if (active) setLoadingFamilias(false);
      }
    };
    loadFamilies();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setFamiliasError(null);
    const nextErrors: typeof errors = {};
    if (!form.nome.trim()) nextErrors.nome = "Informe o nome.";
    const pesoNum = Number(form.peso);
    if (!form.peso || Number.isNaN(pesoNum) || pesoNum <= 0) nextErrors.peso = "Peso invalido.";
    if (!form.familiaId) nextErrors.familiaId = "Selecione uma familia.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const familiaId = Number(form.familiaId);
      const payload: Record<string, unknown> = {
        nome: form.nome.trim(),
        peso: pesoNum,
        familia_id: familiaId,
        ativo: form.ativo,
      };
      if (form.volume) {
        payload.volume = Number(form.volume);
      }
      const resp = await fetch("/api/proxy/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(
          extractErrorMessage(text, "Falha ao cadastrar produto.", resp.status)
        );
      }
      setMessage("Produto cadastrado com sucesso.");
      setForm({ nome: "", peso: "", volume: "", familiaId: "", ativo: true });
      setTimeout(() => router.push("/produtos"), 1200);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro inesperado ao cadastrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logomarca Caminhao" />
        </div>
        <nav>
          <Link href="/inicio">Inicio</Link>
          <Link href="/rotas">Rotas</Link>
          <Link href="/pedidos">Pedidos</Link>
          <Link className={styles.active} aria-current="page" href="/produtos">Produtos</Link>
          <Link href="/configuracoes">Usuarios</Link>
        </nav>
      </aside>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <h2>Novo produto</h2>
          </div>
          <div className={styles.right}>
            <div className={styles.user}>
            <Link
              href="/configuracoes"
              className={styles.avatar}
              aria-label="Ir para usuários"
              title="Ir para usuários"
            >
              {avatarLetter}
            </Link>
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
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="nome">Nome</label>
              <input
                id="nome"
                className={styles.input}
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                aria-invalid={!!errors.nome}
              />
              {errors.nome && <small className={styles.muted}>{errors.nome}</small>}
            </div>
            <div className={styles.field}>
              <label htmlFor="peso">Peso (kg)</label>
              <input
                id="peso"
                type="number"
                step="0.01"
                className={styles.input}
                value={form.peso}
                onChange={(e) => setForm((prev) => ({ ...prev, peso: e.target.value }))}
                aria-invalid={!!errors.peso}
              />
              {errors.peso && <small className={styles.muted}>{errors.peso}</small>}
            </div>
            <div className={styles.field}>
              <label htmlFor="volume">Volume (m3) - opcional</label>
              <input
                id="volume"
                type="number"
                step="0.01"
                className={styles.input}
                value={form.volume}
                onChange={(e) => setForm((prev) => ({ ...prev, volume: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="familia">Família</label>
              <select
                id="familia"
                className={styles.input}
                value={form.familiaId}
                onChange={(e) => setForm((prev) => ({ ...prev, familiaId: e.target.value }))}
                aria-invalid={!!errors.familiaId}
                disabled={disabledSelect}
              >
                <option value="">Selecione</option>
                {familias.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.nome}
                  </option>
                ))}
              </select>
              {errors.familiaId && <small className={styles.muted}>{errors.familiaId}</small>}
            </div>
            <div className={`${styles.field} ${styles.inlineField}`}>
              <label htmlFor="ativo">Ativo</label>
              <input
                id="ativo"
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                disabled={disabledSelect}
              />
            </div>
            {familiasError && <p className={styles.muted}>{familiasError}</p>}
            {message && !familiasError && <p className={styles.muted}>{message}</p>}
            <div className={styles["quick-actions"]}>
              <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
