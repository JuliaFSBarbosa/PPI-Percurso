"use client";
import Link from "next/link";
import { Inter } from "next/font/google";
import styles from "./page.module.css";
import { z } from "zod";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

const inter = Inter({ subsets: ["latin"] });

const loginSchema = z.object({
  cpf: z
    .string()
    .refine((v) => v.replace(/\D/g, "").length === 11, {
      message: "Informe um CPF válido (11 dígitos).",
    }),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

export default function Login() {
  const [errors, setErrors] = useState<{ cpf?: string; password?: string }>({});

  // UI is driven by React state; aria-* is updated via effects/submit.

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const cpfInput = document.getElementById("user") as HTMLInputElement | null;
    const passInput = document.getElementById("pass") as HTMLInputElement | null;
    // clear aria from previous run
    if (cpfInput) {
      cpfInput.setAttribute("aria-invalid", "false");
      cpfInput.removeAttribute("aria-describedby");
    }
    if (passInput) {
      passInput.setAttribute("aria-invalid", "false");
      passInput.removeAttribute("aria-describedby");
    }

    const form = e.currentTarget;
    const cpfEl = (form.elements.namedItem("email") ||
      form.elements.namedItem("username") ||
      form.querySelector("#user")) as HTMLInputElement | null;
    const passwordEl = (form.elements.namedItem("password") ||
      form.querySelector("#pass")) as HTMLInputElement | null;

    const cpf = cpfEl?.value ?? "";
    const password = passwordEl?.value ?? "";

    const result = loginSchema.safeParse({ cpf, password });
    if (!result.success) {
      const next: typeof errors = {} as any;
      for (const issue of result.error.issues) {
        if (issue.path[0] === "cpf") next.cpf = issue.message;
        if (issue.path[0] === "password") next.password = issue.message;
      }
      setErrors(next);
      if (next.cpf && cpfInput) {
        cpfInput.setAttribute("aria-invalid", "true");
        cpfInput.setAttribute("aria-describedby", "cpf-error");
      }
      if (next.password && passInput) {
        passInput.setAttribute("aria-invalid", "true");
        passInput.setAttribute("aria-describedby", "password-error");
      }
      return;
    }

    await signIn("credentials", {
      email: cpf, // mapeia CPF para o campo esperado pela credencial existente
      password,
      redirect: true,
      callbackUrl: "/minha-tela",
    });
  };

  useEffect(() => {
    const cpfInput = document.getElementById("user") as HTMLInputElement | null;
    const passInput = document.getElementById("pass") as HTMLInputElement | null;

    const validateCpf = () => {
      const value = cpfInput?.value ?? "";
      const res = loginSchema.shape.cpf.safeParse(value);
      setErrors((prev) => ({ ...prev, cpf: res.success ? undefined : "Informe um CPF válido (11 dígitos)." }));
      if (cpfInput) {
        if (res.success) {
          cpfInput.setAttribute("aria-invalid", "false");
          cpfInput.removeAttribute("aria-describedby");
        } else {
          cpfInput.setAttribute("aria-invalid", "true");
          cpfInput.setAttribute("aria-describedby", "cpf-error");
        }
      }
    };

    const validatePass = () => {
      const value = passInput?.value ?? "";
      const res = loginSchema.shape.password.safeParse(value);
      setErrors((prev) => ({ ...prev, password: res.success ? undefined : "A senha precisa ter pelo menos 6 caracteres." }));
      if (passInput) {
        if (res.success) {
          passInput.setAttribute("aria-invalid", "false");
          passInput.removeAttribute("aria-describedby");
          const n = document.getElementById("password-error");
          if (n) n.textContent = "";
        } else {
          passInput.setAttribute("aria-invalid", "true");
          passInput.setAttribute("aria-describedby", "password-error");
        }
      }
    };

    if (cpfInput) {
      cpfInput.addEventListener("input", validateCpf);
      cpfInput.addEventListener("blur", validateCpf);
    }
    if (passInput) {
      passInput.addEventListener("input", validatePass);
      passInput.addEventListener("blur", validatePass);
    }

    return () => {
      if (cpfInput) {
        cpfInput.removeEventListener("input", validateCpf);
        cpfInput.removeEventListener("blur", validateCpf);
      }
      if (passInput) {
        passInput.removeEventListener("input", validatePass);
        passInput.removeEventListener("blur", validatePass);
      }
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
              <label htmlFor="user">CPF</label>
              <input id="user" type="text" placeholder="01223456789" aria-invalid={!!errors.cpf} aria-describedby={errors.cpf ? "cpf-error" : undefined} />
              {errors.cpf && <small id="cpf-error">{errors.cpf}</small>}
            </div>
            <div className={styles.row}>
              <label htmlFor="pass">Senha</label>
              <input id="pass" type="password" placeholder="********" aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} />
            {errors.password && <small id="password-error">{errors.password}</small>}
            </div>
            <div className={styles.cta}>
              <button type="submit" className={`${styles.btn} ${styles.primary}`}>
                Entrar
              </button>
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

