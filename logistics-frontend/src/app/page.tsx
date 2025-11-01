"use client";
import Link from "next/link";
import { Inter } from "next/font/google";
import styles from "./page.module.css";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { loginSchema } from "@/schemas/auth";

const inter = Inter({ subsets: ["latin"] });

export default function Login() {
  const [errors, setErrors] = useState<{ email?: string; password?: string; auth?: string }>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const form = e.currentTarget;
    const emailEl = form.querySelector<HTMLInputElement>("#email");
    const passEl = form.querySelector<HTMLInputElement>("#pass");
    const email = emailEl?.value ?? "";
    const password = passEl?.value ?? "";

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/minha-tela",
    });
    if (res?.error) {
      setErrors({ auth: "Email e/ou senha inválidos." });
      return;
    }
    if (res?.ok && res.url) {
      window.location.href = res.url;
    }
  };

  useEffect(() => {
    const emailEl = document.getElementById("email") as HTMLInputElement | null;
    const passEl = document.getElementById("pass") as HTMLInputElement | null;

    const onEmail = () => {
      const value = emailEl?.value ?? "";
      const ok = loginSchema.shape.email.safeParse(value).success;
      setErrors((p) => ({ ...p, email: ok ? undefined : "Email inválido" }));
    };
    const onPass = () => {
      const value = passEl?.value ?? "";
      const ok = loginSchema.shape.password.safeParse(value).success;
      setErrors((p) => ({ ...p, password: ok ? undefined : "Senha deve ter pelo menos 8 caracteres." }));
    };

    emailEl?.addEventListener("input", onEmail);
    emailEl?.addEventListener("blur", onEmail);
    passEl?.addEventListener("input", onPass);
    passEl?.addEventListener("blur", onPass);
    return () => {
      emailEl?.removeEventListener("input", onEmail);
      emailEl?.removeEventListener("blur", onEmail);
      passEl?.removeEventListener("input", onPass);
      passEl?.removeEventListener("blur", onPass);
    };
  }, []);

  return (
    <div className={`${styles.wrapper} ${inter.className}`}>
      <div className={styles.frame}>
        <div className={styles.left}>
          <div className={styles.panel}>
            <form onSubmit={handleSubmit} noValidate>
              <h1 className={styles.title}>Iniciar sessão</h1>
              <div className={styles.row}>
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" placeholder="seu@email.com" />
                {errors.email && <small className={styles.error}>{errors.email}</small>}
              </div>
              <div className={styles.row}>
                <label htmlFor="pass">Senha</label>
                <input id="pass" name="password" type="password" placeholder="********" />
                {errors.password && <small className={styles.error}>{errors.password}</small>}
              </div>
              {errors.auth && <div className={styles.error}>{errors.auth}</div>}
              <div className={styles.cta}>
                <button type="submit" className={`${styles.btn} ${styles.primary}`}>Entrar</button>
                <Link className={styles.btn} href="#">Esqueci minha senha</Link>
              </div>
            </form>
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
