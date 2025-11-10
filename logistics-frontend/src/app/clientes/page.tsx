/*
  Página: Clientes
  Objetivo: tela visual para clientes (placeholder), com sidebar/topbar e botão Sair.
*/
"use client";

import Link from "next/link";
import { Inter as InterFont } from "next/font/google";
import { useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import styles from "../minha-tela/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

export default function ClientesPage() {
  const { data: session } = useSession();
  const displayName = useMemo(() => (session?.user?.name || session?.user?.email || "Usuário").toString(), [session?.user?.name, session?.user?.email]);
  const avatarLetter = useMemo(() => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"), [displayName]);

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logomarca Caminhão" />
        </div>
        <nav>
          <Link href="/minha-tela">Início</Link>
          <Link href="/rotas">Rotas</Link>
          <Link href="/entregas">Entregas</Link>
          <Link href="/motoristas">Motoristas</Link>
          <Link className={styles.active} aria-current="page" href="/clientes">Clientes</Link>
          <Link href="/configuracoes">Configurações</Link>
        </nav>
      </aside>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.left}><h2>Clientes</h2></div>
          <div className={styles.right}>
            <div className={styles.user}>
              <div className={styles.avatar}>{avatarLetter}</div>
              <div className={styles.info}>
                <strong>{displayName}</strong>
                <small>Administrador</small>
              </div>
              <button type="button" className={`${styles.btn} ${styles.ghost} ${styles.sm}`} onClick={() => signOut({ callbackUrl: "/" })}>Sair</button>
            </div>
          </div>
        </header>
        <section className={styles.grid}>
          <div className={styles.card}>
            <h3>Lista de Clientes (visual)</h3>
            <p className={styles.muted}>Conteúdo placeholder para a página de Clientes.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
