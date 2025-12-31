"use client";
/*
  Página: Login
*/
import { Inter } from "next/font/google";
import styles from "./page.module.css";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { loginSchema } from "@/schemas/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "next-themes";

const inter = Inter({ subsets: ["latin"] });

export default function Login() {
  const [errors, setErrors] = useState<{ email?: string; password?: string; auth?: string }>({});
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
      callbackUrl: "/inicio",
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? (theme === "system" ? resolvedTheme ?? "light" : theme ?? "light") : "light";
  const backgroundImage = activeTheme === "dark" ? "/login_escuro.png" : "/login_claro.png";
  const isDarkCard = activeTheme === "dark";
  const themeClass = isDarkCard ? styles.darkTheme : styles.lightTheme;
  const backgroundStyle = mounted ? { backgroundImage: `url(${backgroundImage})` } : undefined;

  return (
    <div className={`${styles.wrapper} ${inter.className}`} style={backgroundStyle}>
      <div
        className={`${styles.glassCard} ${isDarkCard ? styles.darkCard : styles.lightCard} ${themeClass}`}
      >
        <div className={styles.toggleWrapper}>
          <ThemeToggle className={styles.themeBtn} />
        </div>
          <div className={styles.logoSection}>
            <div className={styles.logoWrap}>
              <img src="/logo_percurso.png" alt="Logo Percurso" style={{ width: "clamp(160px, 20vw, 220px)", height: "auto" }} />
            </div>
          </div>
        <h1 className={styles.title}>Iniciar sessão</h1>
        <p className={styles.subtitle}>Preencha suas informações para acessar o sistema.</p>
        <form onSubmit={handleSubmit} noValidate className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <small className={styles.error}>{errors.email}</small>}
          </div>
          <div className={styles.field}>
            <label htmlFor="pass">Senha</label>
            <input
              id="pass"
              name="password"
              type="password"
              placeholder="********"
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password && <small className={styles.error}>{errors.password}</small>}
          </div>
          {errors.auth && <p className={styles.authError}>{errors.auth}</p>}
          <div className={styles.cta}>
            <button type="submit" className={`${styles.btn} ${styles.primary}`}>
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
