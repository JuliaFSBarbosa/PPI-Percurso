"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import styles from "../inicio/styles.module.css";

const inter = InterFont({ subsets: ["latin"] });

const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatWeight = (value?: number) => {
  if (typeof value !== "number") return "-";
  return `${decimalFormatter.format(value)} kg`;
};

const formatVolume = (value?: number | null) => {
  if (value === null || typeof value === "undefined") return "-";
  return `${decimalFormatter.format(value)} m3`;
};

const statusBadge = (ativo: boolean) =>
  ativo ? `${styles.badge} ${styles.ok}` : `${styles.badge} ${styles.late}`;

export default function ProdutosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [prodResp, famResp] = await Promise.all([
          fetch("/api/proxy/produtos", { cache: "no-store" }),
          fetch("/api/proxy/familias", { cache: "no-store" }),
        ]);
        if (!prodResp.ok) throw new Error("Não foi possível carregar os produtos.");
        if (!famResp.ok) throw new Error("Não foi possível carregar as famílias.");
        const prodJson = (await prodResp.json()) as API<APIGetProdutosResponse>;
        const famJson = (await famResp.json()) as API<APIGetFamiliasResponse>;
        if (!prodJson.success) throw new Error(prodJson.detail || "Erro ao buscar produtos.");
        if (!famJson.success) throw new Error(famJson.detail || "Erro ao buscar famílias.");
        if (!active) return;
        const productsData = prodJson.data?.results ?? [];
        const familiesData = famJson.data?.results ?? [];
        setProdutos(productsData);
        setFamilias(familiesData);
      } catch (err) {
        if (!active) return;
        setProdutos([]);
        setFamilias([]);
        setError(err instanceof Error ? err.message : "Falha ao carregar dados.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
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
          <Link href="/entregas">Pedidos</Link>
          <Link className={styles.active} aria-current="page" href="/produtos">
            Produtos
          </Link>
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
                onClick={() => router.push("/produtos/novo")}
              >
                + Novo produto
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost}`}
                onClick={() => router.push("/produtos/familias/novo")}
              >
                + Nova família
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
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <section className={styles.grid}>
          <div className={`${styles.card} ${styles.table}`}>
            <div className={styles["card-head"]}>
              <h3>Produtos cadastrados</h3>
            </div>
            {error && <p className={styles.muted}>{error}</p>}
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto</th>
                  <th>Família</th>
                  <th>Peso</th>
                  <th>Volume</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7}>Carregando produtos...</td>
                  </tr>
                )}
                {!loading && produtos.length === 0 && (
                  <tr>
                    <td colSpan={7}>Nenhum produto cadastrado.</td>
                  </tr>
                )}
                {!loading &&
                  produtos.map((product) => (
                    <tr key={product.id}>
                      <td>{product.id}</td>
                      <td>
                        <div className={styles.productName}>
                          <strong>{product.nome}</strong>
                        </div>
                      </td>
                      <td>{product.familia?.nome ?? "-"}</td>
                      <td>{formatWeight(product.peso)}</td>
                      <td>{formatVolume(product.volume)}</td>
                      <td>
                        <span className={statusBadge(product.ativo)}>
                          {product.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                            onClick={() => router.push(`/produtos/${product.id}/editar`)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                            disabled={deletingId === product.id}
                            onClick={async () => {
                              if (!confirm(`Excluir o produto "${product.nome}"?`)) return;
                              setError(null);
                              setDeletingId(product.id);
                              try {
                                const resp = await fetch(`/api/proxy/produtos/${product.id}`, {
                                  method: "DELETE",
                                });
                                if (!resp.ok) {
                                  const text = await resp.text();
                                  throw new Error(text || "Falha ao excluir produto.");
                                }
                                setProdutos((prev) => prev.filter((p) => p.id !== product.id));
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Erro ao excluir produto.");
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                          >
                            {deletingId === product.id ? "Excluindo..." : "Excluir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className={styles.card}>
            <div className={styles["card-head"]}>
              <h3>Famílias</h3>
            </div>
            <ul className={styles.familyList}>
              {loading && <li className={styles.familyItem}>Carregando famílias...</li>}
              {!loading && familias.length === 0 && (
                <li className={styles.familyItem}>
                  <span className={styles.familyName}>Nenhuma família cadastrada.</span>
                </li>
              )}
              {!loading &&
                familias.map((family) => (
                  <li key={family.id} className={styles.familyItem}>
                    <div className={styles.familyName}>
                      <strong>{family.nome}</strong>
                      <span>{family.descricao ?? "Sem descrição"}</span>
                    </div>
                    <div className={styles.familyActions}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                        onClick={() => router.push(`/produtos/familias/${family.id}/editar`)}
                      >
                        Editar
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

