"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "../../../inicio/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

export default function NovaFamiliaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuario").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  const [form, setForm] = useState({ nome: "", descricao: "", ativo: true });
  const [errors, setErrors] = useState<{ nome?: string }>({});
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!form.nome.trim()) {
      setErrors({ nome: "Informe um nome." });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const resp = await fetch("/api/proxy/familias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          ativo: form.ativo,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Falha ao cadastrar.");
      }
      setMessage("Familia criada com sucesso.");
      setForm({ nome: "", descricao: "", ativo: true });
      setTimeout(() => router.push("/produtos"), 1200);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/caminhao.png" alt="Logomarca Caminhao" />
        </div>
        <nav>
          <Link href="/inicio">Inicio</Link>
          <Link href="/rotas">Rotas</Link>
          <Link href="/entregas">Pedidos</Link>
          <Link className={styles.active} aria-current="page" href="/produtos">Produtos</Link>
          <Link href="/configuracoes">Usuarios</Link>
        </nav>
      </aside>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <h2>Nova familia</h2>
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

        <section className={styles.card}>
          <button className={`${styles.btn} ${styles.ghost} ${styles.sm}`} onClick={() => router.back()}>
            Voltar
          </button>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="nome">Nome</label>
              <input
                id="nome"
                className={styles.input}
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                aria-invalid={!!errors.nome}
              />
              {errors.nome && <small className={styles.muted}>{errors.nome}</small>}
            </div>
            <div className={styles.field}>
              <label htmlFor="descricao">Descricao</label>
              <textarea
                id="descricao"
                className={styles.input}
                value={form.descricao}
                onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
              />
            </div>
            <div className={`${styles.field} ${styles.inlineField}`}>
              <label htmlFor="ativo">Ativo</label>
              <input
                id="ativo"
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
              />
            </div>
            {message && <p className={styles.muted}>{message}</p>}
            <div className={styles["quick-actions"]}>
              <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

