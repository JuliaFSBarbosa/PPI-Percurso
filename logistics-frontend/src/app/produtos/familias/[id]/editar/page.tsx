"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "../../../../inicio/styles.module.css";

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
      return `${fallback} (status ${status ?? "desconhecido"}). Confira os logs do backend.`;
    }
  }
  return raw || fallback;
};

export default function EditarFamiliaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuario").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  const [form, setForm] = useState({ nome: "", descricao: "", ativo: true });
  const [errors, setErrors] = useState<{ nome?: string }>({});
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    let active = true;
    const loadFamilia = async () => {
      setLoading(true);
      try {
        const resp = await fetch(`/api/proxy/familias/${id}`);
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseError(raw, "Falha ao carregar familia.", resp.status));
        const json = JSON.parse(raw) as Familia | API<APIGetFamiliaResponse>;
        let familia: Familia | null = null;
        if (typeof (json as API<APIGetFamiliaResponse>).success === "boolean") {
          const api = json as API<APIGetFamiliaResponse>;
          if (!api.success || !api.data) {
            throw new Error(api.detail || "Familia não encontrada.");
          }
          familia = api.data;
        } else {
          familia = json as Familia;
        }
        if (!active) return;
        setForm({
          nome: familia?.nome ?? "",
          descricao: familia?.descricao ?? "",
          ativo: familia?.ativo ?? true,
        });
        setReady(true);
      } catch (err) {
        if (!active) return;
        setMessage(err instanceof Error ? err.message : "Nao foi possivel carregar a familia.");
        setReady(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadFamilia();
    return () => {
      active = false;
    };
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!form.nome.trim()) {
      setErrors({ nome: "Informe um nome." });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
      };
      const resp = await fetch(`/api/proxy/familias/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(parseError(text, "Falha ao atualizar familia.", resp.status));
      }
      setMessage("Familia atualizada com sucesso.");
      setTimeout(() => router.push("/produtos"), 1200);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro inesperado ao atualizar.");
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
          <Link className={styles.active} aria-current="page" href="/produtos">
            Produtos
          </Link>
          <Link href="/configuracoes">Usuarios</Link>
        </nav>
      </aside>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <h2>Editar familia</h2>
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
          {!ready ? (
            <p className={styles.muted}>Carregando dados da familia...</p>
          ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="nome">Nome</label>
              <input
                id="nome"
                className={styles.input}
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                aria-invalid={!!errors.nome}
                disabled={loading}
              />
              {errors.nome && <small className={styles.muted}>{errors.nome}</small>}
            </div>
            <div className={styles.field}>
              <label htmlFor="descricao">Descricao</label>
              <textarea
                id="descricao"
                className={styles.input}
                value={form.descricao}
                onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className={`${styles.field} ${styles.inlineField}`}>
              <label htmlFor="ativo">Ativo</label>
              <input
                id="ativo"
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                disabled={loading}
              />
            </div>
            {message && <p className={styles.muted}>{message}</p>}
            <div className={styles["quick-actions"]}>
              <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={submitting || loading}>
                {submitting ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
          )}
        </section>
      </main>
    </div>
  );
}

