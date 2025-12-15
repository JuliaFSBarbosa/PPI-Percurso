"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "../../../inicio/styles.module.css";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { ProfileQuickCreate } from "@/components/usuarios/ProfileQuickCreate";
import { useProfileOptions } from "@/hooks/useProfileOptions";

const inter = InterFont({ subsets: ["latin"] });

const formatError = (raw: string, fallback: string) => {
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
  } catch {}
  return raw || fallback;
};

export default function NovoUsuárioPage() {
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

  const { profiles, loading: loadingProfiles, error: profilesError, addProfile } = useProfileOptions();
  const [form, setForm] = useState({ name: "", email: "", password: "", is_superuser: false, profileId: "" });
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; profileId?: string }>({});
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const selectedProfile = profiles.find((profile) => String(profile.id) === form.profileId);
  const isDefaultProfileSelected = !!selectedProfile?.is_default;
  const canToggleAdmin = !!session?.user?.is_superuser && !isDefaultProfileSelected;

  useEffect(() => {
    if (loadingProfiles || !profiles.length || form.profileId) return;
    const defaultProfile = profiles.find((profile) => profile.is_default) ?? profiles[0];
    if (defaultProfile) {
      setForm((prev) => ({ ...prev, profileId: String(defaultProfile.id) }));
    }
  }, [loadingProfiles, profiles, form.profileId]);

  useEffect(() => {
    if (isDefaultProfileSelected && form.is_superuser) {
      setForm((prev) => ({ ...prev, is_superuser: false }));
    }
  }, [isDefaultProfileSelected, form.is_superuser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const nextErrors: typeof errors = {};
    if (!form.name.trim()) nextErrors.name = "Informe o nome.";
    if (!form.email.trim()) nextErrors.email = "Informe o email.";
    if (!form.password || form.password.length < 6) nextErrors.password = "Senha deve ter 6 caracteres.";
    if (!form.is_superuser && !form.profileId) nextErrors.profileId = "Selecione um perfil.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        is_superuser: form.is_superuser,
      };
      if (form.profileId) payload.profile_id = Number(form.profileId);
      const resp = await fetch("/api/proxy/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(formatError(text, "Falha ao cadastrar Usuário."));
      }
      setMessage("Usuário criado com sucesso.");
      const defaultProfile = profiles.find((profile) => profile.is_default) ?? profiles[0];
      setForm({
        name: "",
        email: "",
        password: "",
        is_superuser: false,
        profileId: defaultProfile ? String(defaultProfile.id) : "",
      });
      setTimeout(() => router.push("/configuracoes"), 1200);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro inesperado ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <AppSidebar active="usuarios" />
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <h2>Novo Usuário</h2>
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
          <div className={styles.backButtonGroup}>
            <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} onClick={() => router.back()}>
              Voltar
            </button>
          </div>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                className={styles.input}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                aria-invalid={!!errors.name}
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
              />
              {errors.email && <small className={styles.muted}>{errors.email}</small>}
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                className={styles.input}
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                aria-invalid={!!errors.password}
              />
              {errors.password && <small className={styles.muted}>{errors.password}</small>}
            </div>
            <div className={styles.field}>
              <label htmlFor="profile">Perfil</label>
              <select
                id="profile"
                className={styles.input}
                value={form.profileId}
                disabled={loadingProfiles || form.is_superuser}
                onChange={(e) => setForm((prev) => ({ ...prev, profileId: e.target.value }))}
              >
                <option value="">Selecione um perfil</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              {form.is_superuser && (
                <small className={styles.muted}>Administradores têm acesso total às telas.</small>
              )}
              {loadingProfiles && <small className={styles.muted}>Carregando perfis...</small>}
              {!loadingProfiles && profilesError && <small className={styles.muted}>{profilesError}</small>}
              {errors.profileId && <small className={styles.muted}>{errors.profileId}</small>}
            </div>
            <ProfileQuickCreate
              onCreated={(profile) => {
                addProfile(profile);
                setForm((prev) => ({ ...prev, profileId: String(profile.id) }));
              }}
            />
            {canToggleAdmin && (
              <div className={styles.field}>
                <div className={styles.inlineField}>
                  <input
                    id="is_superuser"
                    type="checkbox"
                    checked={form.is_superuser}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_superuser: e.target.checked }))}
                  />
                  <label htmlFor="is_superuser">Administrador do Sistema</label>
                </div>
              </div>
            )}
            {isDefaultProfileSelected && (
              <small className={styles.muted}>O perfil padrão possui permissões limitadas e não pode ser administrador.</small>
            )}
            {message && <p className={styles.muted}>{message}</p>}
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
