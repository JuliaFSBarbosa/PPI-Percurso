"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "../../../inicio/styles.module.css";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { ScreenId } from "@/constants/screens";
import { fetchProfileScreens, saveProfile, ScreenDefinitionDTO } from "@/lib/profile-client";

const inter = InterFont({ subsets: ["latin"] });

export default function NovoPerfilPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [screens, setScreens] = useState<ScreenDefinitionDTO[]>([]);
  const [form, setForm] = useState<{ name: string; permissions: ScreenId[] }>({
    name: "",
    permissions: [],
  });
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
    const loadScreens = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProfileScreens();
        if (!active) return;
        setScreens(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar telas disponíveis.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadScreens();
    return () => {
      active = false;
    };
  }, []);

  const togglePermission = (screenId: ScreenId) => {
    setForm((prev) => {
      const exists = prev.permissions.includes(screenId);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((permission) => permission !== screenId)
          : [...prev.permissions, screenId],
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!form.name.trim()) {
      setError("Informe o nome do perfil.");
      return;
    }
    setSubmitting(true);
    try {
      await saveProfile({ name: form.name.trim(), permissions: form.permissions });
      setMessage("Perfil criado com sucesso.");
      setTimeout(() => router.push("/configuracoes/perfis"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar perfil.");
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
            <h2>Novo perfil</h2>
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
              <label htmlFor="nome">Nome do perfil</label>
              <input
                id="nome"
                className={styles.input}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                aria-invalid={!form.name.trim() && !!error}
              />
            </div>

            <div className={styles.field}>
              <label>Telas liberadas</label>
              {loading && <p className={styles.muted}>Carregando telas permitidas...</p>}
              {!loading && screens.length === 0 && (
                <p className={styles.muted}>
                  Nenhuma tela disponível. Verifique a configuração do backend.
                </p>
              )}
              {!loading && screens.length > 0 && (
                <div className={styles.cards3}>
                  {screens.map((screen) => (
                    <label key={screen.id} className={styles.inlineField}>
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(screen.id)}
                        onChange={() => togglePermission(screen.id)}
                      />
                      {screen.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error && <p className={styles.muted}>{error}</p>}
            {message && <p className={styles.muted}>{message}</p>}

            <div className={styles.pageActions}>
              <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar perfil"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
