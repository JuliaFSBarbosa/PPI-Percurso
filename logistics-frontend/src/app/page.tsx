import Link from "next/link";
import { Inter } from "next/font/google";
import styles from "./page.module.css";

const inter = Inter({ subsets: ["latin"] });

export default function Login() {
  return (
    <div className={`${styles.wrapper} ${inter.className}`}>
      <div className={styles.frame}>
        <div className={styles.left}>
          <div className={styles.panel}>
            <h1 className={styles.title}>Iniciar sessão</h1>
            <div className={styles.row}>
              <label htmlFor="user">CPF</label>
              <input id="user" type="text" placeholder="01223456789" />
            </div>
            <div className={styles.row}>
              <label htmlFor="pass">Senha</label>
              <input id="pass" type="password" placeholder="••••••••" />
            </div>
            <div className={styles.cta}>
              <Link className={`${styles.btn} ${styles.primary}`} href="/minha-tela">
                Entrar
              </Link>
              <Link className={styles.btn} href="#">Esqueci minha senha</Link>
            </div>
          </div>
        </div>
        <div className={styles.right}>
          <div className={styles.logoWrap}>
            <img src="/logo.png" alt="Logo Percurso" />
          </div>
        </div>
      </div>
    </div>
  );
}

