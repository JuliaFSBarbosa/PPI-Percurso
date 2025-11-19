"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import styles from "./styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

export default function InícioPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const displayName = useMemo(() => {
    const raw = (session?.user?.name || session?.user?.email || "Usuário").toString();
    return raw;
  }, [session?.user?.name, session?.user?.email]);

  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logomarca Caminhão" />
        </div>
        <nav>
          <Link className={styles.active} aria-current="page" href="/inicio">
            Início
          </Link>
          <Link href="/rotas">Rotas</Link>
          <Link href="/entregas">Pedidos</Link>
          <Link href="/produtos">Produtos</Link>
          <Link href="/configuracoes">Usuários</Link>
        </nav>
      </aside>

      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => router.push("/nova-rota")}
              >
                + Nova Rota
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost}`}
                onClick={() => router.push("/entregas/novo")}
              >
                + Novo Pedido
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
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                onClick={() => signOut({ callbackUrl: "/" })}
                aria-label="Sair"
                title="Sair"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <section className={styles.kpis}>
          <div className={`${styles.card} ${styles.kpi}`}>
            <h3>Pedidos Hoje</h3>
            <div className={styles.value}>12</div>
          </div>
          <div className={`${styles.card} ${styles.kpi}`}>
            <h3>Em Rota</h3>
            <div className={styles.value}>5</div>
          </div>
          <div className={`${styles.card} ${styles.kpi} ${styles.warn}`}>
            <h3>Atrasadas</h3>
            <div className={styles.value}>9</div>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={`${styles.card} ${styles.table}`}>
            <div className={styles["card-head"]}>
              <h3>Pedidos de hoje</h3>
              <Link className={`${styles.btn} ${styles.ghost} ${styles.sm}`} href="#">
                Ver tudo
              </Link>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Endereco</th>
                  <th>Motorista</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>10234</td>
                  <td>Coop. Verde Campo</td>
                  <td>Interior de FW - Linha 21</td>
                  <td>Maria S.</td>
                  <td>
                    <span className={`${styles.badge} ${styles.ok}`}>Em rota</span>
                  </td>
                </tr>
                <tr>
                  <td>10235</td>
                  <td>Faz. Boa Esperanca</td>
                  <td>Seberi - KM 12</td>
                  <td>Joao P.</td>
                  <td>
                    <span className={`${styles.badge} ${styles.late}`}>Atrasada</span>
                  </td>
                </tr>
                <tr>
                  <td>10236</td>
                  <td>Granja Sao Jose</td>
                  <td>Taquarucu do Sul</td>
                  <td>Claudia A.</td>
                  <td>
                    <span className={`${styles.badge} ${styles.ok}`}>Em rota</span>
                  </td>
                </tr>
                <tr>
                  <td>10237</td>
                  <td>Agro RS</td>
                  <td>FW - Linha 14</td>
                  <td>Pedro N.</td>
                  <td>
                    <span className={`${styles.badge} ${styles.done}`}>Entregue</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={`${styles.card} ${styles.map}`}>
            <div className={styles["card-head"]}>
              <h3>Mapa (placeholder)</h3>
              <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`}>
                Abrir mapa
              </button>
            </div>
            <div className={styles["map-box"]}>
              <div className={styles.pin} style={{ top: "18%", left: "35%" }} />
              <div className={styles.pin} style={{ top: "42%", left: "58%" }} />
              <div className={styles.pin} style={{ top: "60%", left: "28%" }} />
              <div className={`${styles.pin} ${styles.late}`} style={{ top: "70%", left: "65%" }} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

