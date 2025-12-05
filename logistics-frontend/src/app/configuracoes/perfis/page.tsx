"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "../../inicio/styles.module.css";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { parseApiError } from "@/lib/apiError";
import { APP_SCREENS } from "@/constants/screens";

const inter = InterFont({ subsets: ["latin"] });

export default function PerfisPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    const loadProfiles = async () => {
      setLoading(true);
      setError(null);
      setFeedback(null);
      try {
        const resp = await fetch("/api/proxy/perfis", { cache: "no-store", credentials: "include" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseApiError(raw, "Falha ao carregar perfis.", resp.status));
        const parsed = raw ? JSON.parse(raw) : [];
        let list: UserProfile[] = [];
        if (Array.isArray(parsed)) list = parsed;
        else if (Array.isArray(parsed?.data)) list = parsed.data;
        if (!active) return;
        setProfiles(list);
      } catch (err) {
        if (!active) return;
        setProfiles([]);
        setError(err instanceof Error ? err.message : "Não foi possível carregar os perfis.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadProfiles();
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (profile: UserProfile) => {
    if (!confirm(`Excluir o perfil "${profile.name}"?`)) return;
    setDeletingId(profile.id);
    setError(null);
    setFeedback(null);
    try {
      const resp = await fetch(`/api/proxy/perfis/${profile.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const raw = await resp.text();
      if (!resp.ok) throw new Error(parseApiError(raw, "Falha ao excluir perfil.", resp.status));
      setProfiles((prev) => prev.filter((item) => item.id !== profile.id));
      let detail = "Perfil removido com sucesso.";
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.detail) detail = parsed.detail as string;
      } catch {
        // ignore
      }
      setFeedback(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir perfil.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <AppSidebar active="usuarios" />
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => router.push("/configuracoes/perfis/novo")}
              >
                + Novo perfil
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost}`}
                onClick={() => router.push("/configuracoes")}
              >
                Voltar para usuários
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
            <div>
              <h3>Perfis cadastrados</h3>
              <small>Controle quais telas cada perfil pode acessar.</small>
            </div>
          </div>
          {error && <p className={styles.muted}>{error}</p>}
          {!error && feedback && <p className={styles.muted}>{feedback}</p>}
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telas permitidas</th>
                <th>Padrão</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4}>Carregando perfis...</td>
                </tr>
              )}
              {!loading && profiles.length === 0 && (
                <tr>
                  <td colSpan={4}>Nenhum perfil cadastrado.</td>
                </tr>
              )}
              {!loading &&
                profiles.map((profile) => {
                  const permittedScreens =
                    profile.permissions?.map(
                      (permission) =>
                        APP_SCREENS.find((screen) => screen.id === permission)?.label ?? permission
                    ) ?? [];
                  return (
                    <tr key={profile.id}>
                      <td>{profile.name}</td>
                      <td>
                        {permittedScreens.length ? (
                          permittedScreens.join(", ")
                        ) : (
                          <span className={styles.muted}>Sem telas atribuídas</span>
                        )}
                      </td>
                      <td>{profile.is_default ? "Sim" : "Não"}</td>
                      <td>
                        <div className={`${styles.actionsRow} ${styles.actionsInline}`}>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                            onClick={() => router.push(`/configuracoes/perfis/${profile.id}/editar`)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                            disabled={profile.is_default || deletingId === profile.id}
                            onClick={() => handleDelete(profile)}
                          >
                            {deletingId === profile.id ? "Removendo..." : "Excluir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
