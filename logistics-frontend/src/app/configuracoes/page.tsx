"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "../inicio/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

const roleBadge = (isAdmin?: boolean) => (isAdmin ? `${styles.badge} ${styles.ok}` : `${styles.badge}`);

type AdminUser = {
  id: number;
  name: string;
  email: string;
  is_superuser?: boolean;
};

const parseError = (raw: string, fallback: string, status?: number) => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.detail) return parsed.detail as string;
    const first = parsed && Object.keys(parsed)[0];
    if (first) {
      const value = (parsed as any)[first];
      if (Array.isArray(value)) return String(value[0]);
      if (typeof value === "string") return value;
    }
  } catch {
    if (raw.trim().startsWith("<")) {
      return `${fallback} (status ${status ?? "desconhecido"}).`;
    }
  }
  return raw || fallback;
};

export default function UsuariosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    const loadUsers = async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const resp = await fetch("/api/proxy/usuarios", { cache: "no-store", credentials: "include" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseError(raw, "Não foi possível carregar os usuários.", resp.status));
        const parsed = raw ? JSON.parse(raw) : [];
        let list: AdminUser[] = [];
        if (Array.isArray(parsed)) list = parsed;
        else if (Array.isArray(parsed?.data)) list = parsed.data;
        else if (Array.isArray(parsed?.results)) list = parsed.results;
        if (!active) return;
        setUsers(list);
      } catch (err) {
        if (!active) return;
        setUsers([]);
        setError(err instanceof Error ? err.message : "Falha ao carregar usuários.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadUsers();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logomarca Caminhão" />
        </div>
        <nav>
          <Link href="/inicio">Início</Link>
          <Link href="/rotas">Rotas</Link>
          <Link href="/pedidos">Pedidos</Link>
          <Link href="/produtos">Produtos</Link>
          <Link className={styles.active} aria-current="page" href="/configuracoes">
            Usuários
          </Link>
        </nav>
      </aside>

      <main className={styles.content}>
        {loading && <LoadingOverlay message="Carregando usuários..." />}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => router.push("/configuracoes/usuarios/novo")}
              >
                + Novo usuário
              </button>
            </div>
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

        <section className={`${styles.card} ${styles.table}`}>
          <div className={styles["card-head"]}>
            <h3>Usuários cadastrados</h3>
          </div>
          {error && <p className={styles.muted}>{error}</p>}
          {!error && message && <p className={styles.muted}>{message}</p>}
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4}>Carregando usuários...</td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={4}>Nenhum usuário encontrado.</td>
                </tr>
              )}
              {!loading &&
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={roleBadge(user.is_superuser)}>
                        {user.is_superuser ? "Administrador" : "Padrão"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                          onClick={() =>
                            router.push(
                              `/configuracoes/usuarios/${user.id}/editar?name=${encodeURIComponent(
                                user.name || ""
                              )}&email=${encodeURIComponent(user.email || "")}&admin=${
                                user.is_superuser ? "1" : "0"
                              }`
                            )
                          }
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                          disabled={deletingId === user.id}
                          onClick={async () => {
                            if (!confirm(`Excluir o usuário "${user.name}"?`)) return;
                            setError(null);
                            setMessage(null);
                            setDeletingId(user.id);
                            try {
                              const resp = await fetch(`/api/proxy/usuarios/${user.id}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              const text = await resp.text();
                              if (!resp.ok) {
                                throw new Error(parseError(text, "Falha ao excluir usuário.", resp.status));
                              }
                              let successMsg = "Usuário excluído com sucesso.";
                              try {
                                const parsed = text ? JSON.parse(text) : null;
                                if (parsed?.detail) successMsg = parsed.detail as string;
                              } catch {
                                // keep default
                              }
                              setUsers((prev) => prev.filter((u) => u.id !== user.id));
                              setMessage(successMsg);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Erro ao excluir usuário.");
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                        >
                          {deletingId === user.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
