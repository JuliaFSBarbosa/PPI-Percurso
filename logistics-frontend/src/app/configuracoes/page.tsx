/*
  Página: Configurações
  Objetivo: consolidar formulários de Perfil, Senha e Cadastro de novo usuário.
  - Perfil atualiza nome e sincroniza sessão (NextAuth)
  - Senha altera credencial do usuário no backend
  - Cadastro cria usuário via endpoint de signup
*/
"use client";

import Link from "next/link";
import { Inter as InterFont } from "next/font/google";
import { useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { z } from "zod";
import styles from "../minha-tela/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

const profileSchema = z.object({
  name: z.string().min(2, "Informe um nome válido."),
});

const passwordSchema = z
  .object({
    password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

const newUserSchema = z.object({
  name: z.string().min(2, "Informe um nome válido."),
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

export default function ConfiguracoesPage() {
  const { data: session, update } = useSession();
  const displayName = useMemo(() => (session?.user?.name || session?.user?.email || "Usuário").toString(), [session?.user?.name, session?.user?.email]);
  const avatarLetter = useMemo(() => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"), [displayName]);

  const [active, setActive] = useState<"perfil" | "senha" | "novo">("perfil");

  const [profile, setProfile] = useState({ name: session?.user?.name || "", email: (session?.user?.email || "") as string });
  const [profileErrors, setProfileErrors] = useState<{ name?: string }>({});
  const [profileMsg, setProfileMsg] = useState<string>("");

  const [pwd, setPwd] = useState({ password: "", confirm: "" });
  const [pwdErrors, setPwdErrors] = useState<{ password?: string; confirm?: string }>({});
  const [pwdMsg, setPwdMsg] = useState<string>("");

  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [newUserErrors, setNewUserErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [newUserMsg, setNewUserMsg] = useState<string>("");

  // Usamos proxy interno do Next para evitar CORS
  const apiBase = ""; // vazio porque chamaremos /api/proxy/* local

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    setProfileErrors({});
    const res = profileSchema.safeParse(profile);
    if (!res.success) {
      const next: typeof profileErrors = {};
      for (const issue of res.error.issues) {
        const f = issue.path[0] as keyof typeof next;
        next[f] = issue.message;
      }
      setProfileErrors(next);
      return;
    }
    try {
      const resp = await fetch(`/api/proxy/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name }),
      });
      if (!resp.ok) {
        setProfileMsg("Não foi possível atualizar (backend pode não ter o endpoint /me).");
        return;
      }
      // Atualiza sessão no cliente para refletir o novo nome no header
      try {
        // @ts-ignore - next-auth update aceita parcial
        await update({ user: { ...session?.user, name: profile.name } });
      } catch {}
      setProfileMsg("Dados atualizados com sucesso.");
    } catch (err) {
      setProfileMsg("Falha de rede ao atualizar.");
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg("");
    setPwdErrors({});
    const res = passwordSchema.safeParse(pwd);
    if (!res.success) {
      const next: typeof pwdErrors = {};
      for (const issue of res.error.issues) {
        const f = issue.path[0] as keyof typeof next;
        next[f] = issue.message;
      }
      setPwdErrors(next);
      return;
    }
    try {
      const resp = await fetch(`/api/proxy/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: res.data.password }),
      });
      if (!resp.ok) {
        setPwdMsg("Não foi possível alterar a senha (endpoint /me ausente?).");
        return;
      }
      setPwdMsg("Senha alterada com sucesso.");
      setPwd({ password: "", confirm: "" });
    } catch (err) {
      setPwdMsg("Falha de rede ao alterar senha.");
    }
  }

  async function handleNewUserSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNewUserMsg("");
    setNewUserErrors({});
    const res = newUserSchema.safeParse(newUser);
    if (!res.success) {
      const next: typeof newUserErrors = {};
      for (const issue of res.error.issues) {
        const f = issue.path[0] as keyof typeof next;
        next[f] = issue.message;
      }
      setNewUserErrors(next);
      return;
    }
    try {
      const resp = await fetch(`/api/proxy/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(res.data),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        setNewUserMsg(`Erro ao cadastrar: ${txt || resp.status}`);
        return;
      }
      setNewUserMsg("Usuário cadastrado com sucesso.");
      setNewUser({ name: "", email: "", password: "" });
    } catch (err) {
      setNewUserMsg("Falha de rede ao cadastrar.");
    }
  }

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
          <Link href="/clientes">Clientes</Link>
          <Link className={styles.active} aria-current="page" href="/configuracoes">Configurações</Link>
        </nav>
      </aside>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.left}><h2>Configurações</h2></div>
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

        <section className={styles.cards3}>
          <div className={styles.card}>
            <div className={styles["card-head"]}><h3>Perfil</h3></div>
            <form className={styles.form} onSubmit={handleProfileSubmit} noValidate>
              <div className={styles.field}>
                <label>Nome</label>
                <input className={styles.input} type="text" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} aria-invalid={!!profileErrors.name} aria-describedby={profileErrors.name ? "profile-name-error" : undefined} />
                {profileErrors.name && <small id="profile-name-error" className={styles.hint}>{profileErrors.name}</small>}
              </div>
              <div className={styles.field}>
                <label>E-mail</label>
                <input className={styles.input} type="email" value={profile.email} disabled />
              </div>
              <div className={styles["quick-actions"]}>
                <button type="submit" className={`${styles.btn} ${styles.primary}`}>Salvar alterações</button>
              </div>
              {profileMsg && <p className={styles.hint}>{profileMsg}</p>}
            </form>
          </div>

          <div className={styles.card}>
            <div className={styles["card-head"]}><h3>Senha</h3></div>
            <form className={styles.form} onSubmit={handlePasswordSubmit} noValidate>
              <div className={styles.field}>
                <label>Nova senha</label>
                <input className={styles.input} type="password" value={pwd.password} onChange={(e) => setPwd((p) => ({ ...p, password: e.target.value }))} aria-invalid={!!pwdErrors.password} aria-describedby={pwdErrors.password ? "pwd-pass-error" : undefined} />
                {pwdErrors.password && <small id="pwd-pass-error" className={styles.hint}>{pwdErrors.password}</small>}
              </div>
              <div className={styles.field}>
                <label>Confirmar nova senha</label>
                <input className={styles.input} type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} aria-invalid={!!pwdErrors.confirm} aria-describedby={pwdErrors.confirm ? "pwd-confirm-error" : undefined} />
                {pwdErrors.confirm && <small id="pwd-confirm-error" className={styles.hint}>{pwdErrors.confirm}</small>}
              </div>
              <div className={styles["quick-actions"]}>
                <button type="submit" className={`${styles.btn} ${styles.primary}`}>Alterar senha</button>
              </div>
              {pwdMsg && <p className={styles.hint}>{pwdMsg}</p>}
            </form>
          </div>

          <div className={styles.card}>
            <div className={styles["card-head"]}><h3>Cadastrar novo usuário</h3></div>
            <form className={styles.form} onSubmit={handleNewUserSubmit} noValidate>
              <div className={styles.field}>
                <label>Nome</label>
                <input className={styles.input} type="text" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} aria-invalid={!!newUserErrors.name} aria-describedby={newUserErrors.name ? "new-name-error" : undefined} />
                {newUserErrors.name && <small id="new-name-error" className={styles.hint}>{newUserErrors.name}</small>}
              </div>
              <div className={styles.field}>
                <label>E-mail</label>
                <input className={styles.input} type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} aria-invalid={!!newUserErrors.email} aria-describedby={newUserErrors.email ? "new-email-error" : undefined} />
                {newUserErrors.email && <small id="new-email-error" className={styles.hint}>{newUserErrors.email}</small>}
              </div>
              <div className={styles.field}>
                <label>Senha</label>
                <input className={styles.input} type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} aria-invalid={!!newUserErrors.password} aria-describedby={newUserErrors.password ? "new-pass-error" : undefined} />
                {newUserErrors.password && <small id="new-pass-error" className={styles.hint}>{newUserErrors.password}</small>}
              </div>
              <div className={styles["quick-actions"]}>
                <button type="submit" className={`${styles.btn} ${styles.primary}`}>Cadastrar</button>
              </div>
              {newUserMsg && <p className={styles.hint}>{newUserMsg}</p>}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
