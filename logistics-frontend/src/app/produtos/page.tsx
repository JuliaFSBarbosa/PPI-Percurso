"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "../inicio/styles.module.css";
import { AppSidebar } from "@/components/navigation/AppSidebar";

const inter = InterFont({ subsets: ["latin"] });
const PAGE_SIZE = 20;

const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatWeight = (value?: number | string | null) => {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "-";
  return `${decimalFormatter.format(num)} kg`;
};

const formatVolume = (value?: number | null) => {
  if (value === null || typeof value === "undefined") return "-";
  return `${decimalFormatter.format(value)} m3`;
};

const statusBadge = (ativo: boolean) =>
  ativo ? `${styles.badge} ${styles.ok}` : `${styles.badge} ${styles.late}`;

const restrictionStatusBadge = (ativo: boolean) =>
  ativo ? `${styles.badge} ${styles.ok}` : `${styles.badge} ${styles.late}`;

export default function ProdutosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [restricoes, setRestricoes] = useState<RestricaoFamilia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingRestrictionId, setDeletingRestrictionId] = useState<number | null>(null);
  const [togglingRestrictionId, setTogglingRestrictionId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [savingRestriction, setSavingRestriction] = useState(false);
  const [restricaoMensagem, setRestricaoMensagem] = useState<string | null>(null);
  const [restricaoErro, setRestricaoErro] = useState<string | null>(null);
  const [restricaoForm, setRestricaoForm] = useState({
    familiaA: "",
    familiaB: "",
    motivo: "",
  });

  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuário").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const roleLabel = session?.user?.is_superuser ? "Administrador" : session?.user?.profile?.name || "Usuário padrão";

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
        const [prodResp, famResp, restResp] = await Promise.all([
          fetch(`/api/proxy/produtos?limit=${PAGE_SIZE}&offset=${offset}`, { cache: "no-store" }),
          fetch("/api/proxy/familias", { cache: "no-store" }),
          fetch("/api/proxy/restricoes-familias", { cache: "no-store" }),
        ]);
        if (!prodResp.ok) throw new Error("Não foi possível carregar os produtos.");
        if (!famResp.ok) throw new Error("Não foi possível carregar as famílias.");
        if (!restResp.ok) throw new Error("Não foi possível carregar as restrições.");
        const prodJson = (await prodResp.json()) as API<APIGetProdutosResponse>;
        const famJson = (await famResp.json()) as API<APIGetFamiliasResponse>;
        const restJson = (await restResp.json()) as API<APIGetRestricoesFamiliasResponse>;
        if (!prodJson.success) throw new Error(prodJson.detail || "Erro ao buscar produtos.");
        if (!famJson.success) throw new Error(famJson.detail || "Erro ao buscar famílias.");
        if (!restJson.success) throw new Error(restJson.detail || "Erro ao buscar restrições.");
        if (!active) return;
        const productsData = prodJson.data?.results ?? [];
        const familiesData = famJson.data?.results ?? [];
        const restrictionsData = restJson.data?.results ?? [];
        setProdutos(productsData);
        setFamilias(familiesData);
        setRestricoes(restrictionsData);
        setTotalCount(prodJson.data?.count ?? 0);
      } catch (err) {
        if (!active) return;
        setProdutos([]);
        setFamilias([]);
        setRestricoes([]);
        setError(err instanceof Error ? err.message : "Falha ao carregar dados.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [offset]);

  const resetRestrictionFeedback = () => {
    setRestricaoErro(null);
    setRestricaoMensagem(null);
  };

  const existeRestricao = (familiaA: number, familiaB: number) =>
    restricoes.some(
      (r) =>
        (r.familia_origem.id === familiaA && r.familia_restrita.id === familiaB) ||
        (r.familia_origem.id === familiaB && r.familia_restrita.id === familiaA)
    );

  const refreshRestricoesLista = async () => {
    try {
      const resp = await fetch("/api/proxy/restricoes-familias", { cache: "no-store" });
      const restJson = (await resp.json()) as API<APIGetRestricoesFamiliasResponse>;
      if (!resp.ok || !restJson.success || !restJson.data) {
        throw new Error(restJson.detail || "Falha ao carregar restrições.");
      }
      const lista = restJson.data.results ?? [];
      setRestricoes(lista);
      return lista;
    } catch (err) {
      console.error("Falha ao atualizar lista de restrições:", err);
      return null;
    }
  };

  const handleSubmitRestricao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetRestrictionFeedback();
    const familiaAId = Number(restricaoForm.familiaA);
    const familiaBId = Number(restricaoForm.familiaB);
    if (!familiaAId || !familiaBId) {
      setRestricaoErro("Selecione as duas famílias antes de salvar.");
      return;
    }
    if (familiaAId === familiaBId) {
      setRestricaoErro("Não é possível criar restrição com a mesma família.");
      return;
    }
    if (existeRestricao(familiaAId, familiaBId)) {
      setRestricaoErro("Essa restrição já existe.");
      return;
    }
    setSavingRestriction(true);
    try {
      const resp = await fetch("/api/proxy/restricoes-familias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familia_origem_id: familiaAId,
          familia_restrita_id: familiaBId,
          motivo: restricaoForm.motivo || null,
        }),
      });
      const data = (await resp.json()) as API<RestricaoFamilia>;
      if (!resp.ok || !data.success || !data.data) {
        throw new Error(data.detail || "Falha ao salvar restrição.");
      }
      setRestricoes((prev) => [data.data as RestricaoFamilia, ...prev]);
      setRestricaoForm({ familiaA: "", familiaB: "", motivo: "" });
      setRestricaoMensagem("Restrição criada com sucesso.");
    } catch (err) {
      setRestricaoErro(err instanceof Error ? err.message : "Erro ao salvar restrição.");
    } finally {
      setSavingRestriction(false);
    }
  };

  const handleDeleteRestricao = async (restricao: RestricaoFamilia) => {
    if (!confirm(`Remover a restrição entre "${restricao.familia_origem.nome}" e "${restricao.familia_restrita.nome}"?`)) {
      return;
    }
    resetRestrictionFeedback();
    setDeletingRestrictionId(restricao.id);
    try {
      const resp = await fetch(`/api/proxy/restricoes-familias/${restricao.id}`, {
        method: "DELETE",
      });
      if (!resp.ok) {
        let detail = "Falha ao excluir restrição.";
        try {
          const data = (await resp.json()) as API<unknown>;
          if (data && typeof data === "object" && "detail" in data && data.detail) {
            detail = String(data.detail);
          }
        } catch {
          // ignore parse errors
        }
        if (resp.status === 404) {
          setRestricoes((prev) => prev.filter((item) => item.id !== restricao.id));
          setRestricaoMensagem("Restrição já havia sido removida.");
          return;
        }
        throw new Error(detail);
      }
      setRestricoes((prev) => prev.filter((item) => item.id !== restricao.id));
      setRestricaoMensagem("Restrição excluída com sucesso.");
    } catch (err) {
      const atualizadas = await refreshRestricoesLista();
      if (atualizadas && !atualizadas.some((item) => item.id === restricao.id)) {
        setRestricaoMensagem("Restrição excluída com sucesso.");
      } else {
        setRestricaoErro(err instanceof Error ? err.message : "Erro ao excluir restrição.");
      }
    } finally {
      setDeletingRestrictionId(null);
    }
  };

  const handleToggleRestricao = async (restricao: RestricaoFamilia) => {
    resetRestrictionFeedback();
    const novoStatus = !restricao.ativo;
    setTogglingRestrictionId(restricao.id);
    try {
      const resp = await fetch(`/api/proxy/restricoes-familias/${restricao.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: novoStatus }),
      });
      const data = (await resp.json()) as API<RestricaoFamilia>;
      if (!resp.ok || !data.success || !data.data) {
        throw new Error(data.detail || "Falha ao atualizar restrição.");
      }
      setRestricoes((prev) => prev.map((item) => (item.id === restricao.id ? (data.data as RestricaoFamilia) : item)));
      setRestricaoMensagem(novoStatus ? "Restrição ativada." : "Restrição desativada.");
    } catch (err) {
      setRestricaoErro(err instanceof Error ? err.message : "Erro ao atualizar restrição.");
    } finally {
      setTogglingRestrictionId(null);
    }
  };

  const formatDate = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleDateString("pt-BR");
    } catch (e) {
      return "-";
    }
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE) || 1);
  const canPrev = offset > 0;
  const canNext = offset + produtos.length < totalCount;

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <AppSidebar active="produtos" />

      <main className={styles.content}>
        {loading && <LoadingOverlay message="Carregando produtos..." />}
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
            <Link
              href="/configuracoes/perfil"
              className={styles.avatar}
              aria-label="Ir para usuários"
              title="Ir para usuários"
            >
              {avatarLetter}
            </Link>
            <div className={styles.info}>
              <strong>{displayName}</strong>
              <small>{roleLabel}</small>
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
                        <div className={`${styles.actionsRow} ${styles.actionsInline}`}>
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

          <div className={styles.tableFooter}>
            <span className={styles.muted}>
              Página {currentPage} de {totalPages} ({totalCount} registros)
            </span>
            <div className={styles.paginationActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                disabled={!canPrev || loading}
                aria-label="Página anterior"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                &lt;
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                disabled={!canNext || loading}
                aria-label="Próxima página"
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                &gt;
              </button>
            </div>
          </div>
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
                    <div className={`${styles.familyActions} ${styles.actionsInline}`}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                        onClick={() => router.push(`/produtos/familias/${family.id}/editar`)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                        onClick={async () => {
                          if (!confirm(`Excluir a família "${family.nome}"?`)) return;
                          try {
                            const resp = await fetch(`/api/proxy/familias/${family.id}`, {
                              method: "DELETE",
                            });
                            if (!resp.ok) {
                              const text = await resp.text();
                              throw new Error(text || "Falha ao excluir família.");
                            }
                            setFamilias((prev) => prev.filter((f) => f.id !== family.id));
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Erro ao excluir família.");
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>

          <div className={styles.card}>
            <div className={styles["card-head"]}>
              <h3>Restrições entre famílias</h3>
            </div>
            <form className={`${styles.form} ${styles.restrictionsForm}`} onSubmit={handleSubmitRestricao}>
              <div className={styles.restrictionsRow}>
                <div className={styles.field}>
                  <label htmlFor="familiaA">Família A</label>
                  <select
                    id="familiaA"
                    className={styles.input}
                    value={restricaoForm.familiaA}
                    onChange={(event) => setRestricaoForm((prev) => ({ ...prev, familiaA: event.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {familias.map((familia) => (
                      <option key={`origem-${familia.id}`} value={familia.id}>
                        {familia.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="familiaB">Família B</label>
                  <select
                    id="familiaB"
                    className={styles.input}
                    value={restricaoForm.familiaB}
                    onChange={(event) => setRestricaoForm((prev) => ({ ...prev, familiaB: event.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {familias.map((familia) => (
                      <option key={`destino-${familia.id}`} value={familia.id}>
                        {familia.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="motivo">Motivo (opcional)</label>
                <textarea
                  id="motivo"
                  className={styles.input}
                  rows={3}
                  placeholder="Ex.: Lei interna, risco químico, etc."
                  value={restricaoForm.motivo}
                  onChange={(event) => setRestricaoForm((prev) => ({ ...prev, motivo: event.target.value }))}
                />
              </div>
              <div className={styles.restrictionsActions}>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.primary}`}
                  disabled={savingRestriction}
                >
                  {savingRestriction ? "Salvando restrição..." : "Salvar restrição"}
                </button>
              </div>
            </form>
            {(restricaoMensagem || restricaoErro) && (
              <div className={styles.restrictionsFeedback}>
                {restricaoMensagem && <div className={styles.alertSuccess}>{restricaoMensagem}</div>}
                {restricaoErro && <div className={styles.alert}>{restricaoErro}</div>}
              </div>
            )}

            <div className={styles["card-head"]} style={{ marginTop: 16 }}>
              <h4>Restrições ativas</h4>
            </div>
            <table className={styles.restrictionsTable}>
              <thead>
                <tr>
                  <th>Criada em</th>
                  <th>Família A</th>
                  <th>Família B</th>
                  <th>Motivo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6}>Carregando restrições...</td>
                  </tr>
                )}
                {!loading && restricoes.length === 0 && (
                  <tr>
                    <td colSpan={6}>Nenhuma restrição cadastrada.</td>
                  </tr>
                )}
                {!loading &&
                  restricoes.map((restricao) => (
                    <tr key={restricao.id}>
                      <td>{formatDate(restricao.created_at)}</td>
                      <td>{restricao.familia_origem.nome}</td>
                      <td>{restricao.familia_restrita.nome}</td>
                      <td>{restricao.motivo || "-"}</td>
                      <td>
                        <span className={restrictionStatusBadge(restricao.ativo)}>
                          {restricao.ativo ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td>
                        <div className={`${styles.actionsRow} ${styles.actionsInline}`}>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                            disabled={togglingRestrictionId === restricao.id}
                            onClick={() => handleToggleRestricao(restricao)}
                          >
                            {togglingRestrictionId === restricao.id
                              ? restricao.ativo
                                ? "Desativando..."
                                : "Ativando..."
                              : restricao.ativo
                              ? "Desativar"
                              : "Ativar"}
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                            disabled={deletingRestrictionId === restricao.id}
                            onClick={() => handleDeleteRestricao(restricao)}
                          >
                            {deletingRestrictionId === restricao.id ? "Removendo..." : "Excluir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
