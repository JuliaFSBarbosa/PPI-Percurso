"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import styles from "../../inicio/styles.module.css";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { parseApiError } from "@/lib/apiError";

const inter = InterFont({ subsets: ["latin"] });

export default function PerfilPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuário").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const roleLabel = session?.user?.is_superuser ? "Administrador" : session?.user?.profile?.name || "Usuário padrão";
  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  useEffect(() => {
    let active = true;
    const loadMe = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch("/api/proxy/me", { cache: "no-store", credentials: "include" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseApiError(raw, "Falha ao carregar seu cadastro.", resp.status));
        const data = raw ? JSON.parse(raw) : null;
        const me = data?.data ?? data;
        if (!active) return;
        setForm({
          name: me?.name ?? "",
          email: me?.email ?? "",
          password: "",
        });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar seu cadastro.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMe();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setError("Informe nome e email.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
      };
      if (form.password) payload.password = form.password;
      const resp = await fetch("/api/proxy/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const raw = await resp.text();
      if (!resp.ok) {
        throw new Error(parseApiError(raw, "Falha ao atualizar seus dados.", resp.status));
      }
      setMessage("Dados atualizados com sucesso.");
      await update({
        user: {
          name: form.name.trim(),
          email: form.email.trim(),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <AppSidebar active="usuarios" />
      <main className={styles.content}>
        {loading && <LoadingOverlay message="Carregando seu cadastro..." />}
        <header className={styles.topbar}>
          <div>
            <h2>Minha conta</h2>
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
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <section className={`${styles.card} ${styles.profileCard}`}>
          <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} onClick={() => router.back()}>
            Voltar
          </button>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                className={styles.input}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className={styles.input}
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Nova senha (opcional)</label>
              <input
                id="password"
                type="password"
                className={styles.input}
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="********"
              />
            </div>
            {error && <p className={styles.muted}>{error}</p>}
            {message && <p className={styles.muted}>{message}</p>}
            <div className={styles["quick-actions"]}>
              <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
