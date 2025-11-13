"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import styles from "../inicio/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

const roleBadge = (isAdmin?: boolean) =>
  isAdmin ? `${styles.badge} ${styles.ok}` : `${styles.badge}`;

type AdminUser = {
  id: number;
  name: string;
  email: string;
  is_superuser?: boolean;
};

export default function UsuariosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuario").toString(),
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
      try {
        const resp = await fetch("/api/proxy/usuarios", { cache: "no-store", credentials: "include" });
        const raw = await resp.text();
        if (!resp.ok) {
          throw new Error(raw || "Nao foi possivel carregar os usuarios.");
        }
        const parsed = raw ? JSON.parse(raw) : [];
        let list: AdminUser[] = [];
        if (Array.isArray(parsed)) {
          list = parsed;
        } else if (Array.isArray(parsed?.data)) {
          list = parsed.data;
        } else if (Array.isArray(parsed?.results)) {
          list = parsed.results;
        }
        if (!active) return;
        setUsers(list);
      } catch (err) {
        if (!active) return;
        setUsers([]);
        setError(err instanceof Error ? err.message : "Falha ao carregar usuarios.");
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
          <img src="/caminhao.png" alt="Logomarca Caminhao" />
        </div>
        <nav>
          <Link href="/inicio">Inicio</Link>
          <Link href="/rotas">Rotas</Link>
          <Link href="/entregas">Entregas</Link>
          <Link href="/motoristas">Motoristas</Link>
          <Link href="/produtos">Produtos</Link>
          <Link href="/clientes">Clientes</Link>
          <Link className={styles.active} aria-current="page" href="/configuracoes">
            Usuarios
          </Link>
        </nav>
      </aside>

      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.left}>
            <h2>Usuarios</h2>
          </div>
          <div className={styles.right}>
            <div className={styles.pageActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => router.push("/configuracoes/usuarios/novo")}
              >
                + Novo usuario
              </button>
            </div>
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

        <section className={`${styles.card} ${styles.table}`}>
          <div className={styles["card-head"]}>
            <h3>Usuarios cadastrados</h3>
          </div>
          {error && <p className={styles.muted}>{error}</p>}
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4}>Carregando usuarios...</td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={4}>Nenhum usuario encontrado.</td>
                </tr>
              )}
              {!loading &&
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={roleBadge(user.is_superuser)}>
                        {user.is_superuser ? "Administrador" : "Padrao"}
                      </span>
                    </td>
                    <td>
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
