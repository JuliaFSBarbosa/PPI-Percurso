"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import styles from "../../../../inicio/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

type AdminUser = {
  id: number;
  name: string;
  email: string;
  is_superuser?: boolean;
};

const formatError = (raw: string, fallback: string, status?: number) => {
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
      return `${fallback} (status ${status ?? "desconhecido"}). Verifique os logs.`;
    }
  }
  return raw || fallback;
};

export default function EditarUsuarioPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuario").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    is_superuser: false,
  });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const badgeClass = (isAdmin?: boolean) =>
    isAdmin ? `${styles.badge} ${styles.ok}` : `${styles.badge}`;

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    let active = true;
    const loadUser = async () => {
      setLoading(true);
      try {
        const resp = await fetch(`/api/proxy/usuarios/${id}`, { credentials: "include" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(formatError(raw, "Falha ao carregar usuario.", resp.status));
        const parsed = raw ? JSON.parse(raw) : null;
        const data =
          parsed && typeof parsed === "object" && "success" in parsed
            ? (parsed.success ? parsed.data : null)
            : parsed;
        if (!data) throw new Error("Usuario não encontrado.");
        if (!active) return;
        setForm({
          name: data.name ?? "",
          email: data.email ?? "",
          password: "",
          is_superuser: !!data.is_superuser,
        });
        setReady(true);
      } catch (err) {
        if (!active) return;
        setMessage(err instanceof Error ? err.message : "Não foi possível carregar o usuario.");
        setReady(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadUser();
    return () => {
      active = false;
    };
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const nextErrors: typeof errors = {};
    if (!form.name.trim()) nextErrors.name = "Informe o nome.";
    if (!form.email.trim()) nextErrors.email = "Informe o email.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        is_superuser: form.is_superuser,
      };
      if (form.password) payload.password = form.password;
      const resp = await fetch(`/api/proxy/usuarios/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(formatError(text, "Falha ao atualizar usuário.", resp.status));
      }
      setMessage("Usuário atualizado com sucesso.");
      setTimeout(() => router.push("/configuracoes"), 1200);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro inesperado ao salvar.");
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
          <Link href="/entregas">Pedidos</Link>
          <Link href="/produtos">Produtos</Link>
          <Link className={styles.active} aria-current="page" href="/configuracoes">
            Usuarios
          </Link>
        </nav>
      </aside>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <h2>Editar usuário</h2>
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

        <section className={styles.card}>
          <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} onClick={() => router.back()}>
            Voltar
          </button>
          {!ready ? (
            <p className={styles.muted}>Carregando dados do usuario...</p>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.userSummary}>
                <div>
                  <strong>{form.name || searchParams.get("name") || "Usuário"}</strong>
                  <span>{form.email || searchParams.get("email") || "Email não informado"}</span>
                </div>
                <span className={badgeClass(form.is_superuser)}>
                  {form.is_superuser || searchParams.get("admin") === "1" ? "Administrador" : "Padrão"}
                </span>
              </div>
              <div className={styles.field}>
                <label htmlFor="name">Nome</label>
                <input
                  id="name"
                  className={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  aria-invalid={!!errors.name}
                  disabled={loading}
                />
                {errors.name && <small className={styles.muted}>{errors.name}</small>}
              </div>
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  aria-invalid={!!errors.email}
                  disabled={loading}
                />
                {errors.email && <small className={styles.muted}>{errors.email}</small>}
              </div>
              <div className={styles.field}>
                <label htmlFor="password">Nova senha (opcional)</label>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  disabled={loading}
                />
              </div>
              <div className={`${styles.field} ${styles.inlineField}`}>
                <label htmlFor="is_superuser">Administrador</label>
                <input
                  id="is_superuser"
                  type="checkbox"
                  checked={form.is_superuser}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_superuser: e.target.checked }))}
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
