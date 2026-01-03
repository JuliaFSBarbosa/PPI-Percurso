"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Inter as InterFont } from "next/font/google";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { SelectedOrdersMap } from "@/components/pedidos/SelectedOrdersMap";
import { OrdersTable } from "@/components/pedidos/OrdersTable";
import styles from "../inicio/styles.module.css";
import { parseApiError } from "@/lib/apiError";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { statusLabels } from "@/constants/labels";

const inter = InterFont({ subsets: ["latin"] });
const API_PAGE_SIZE = 200;
const DISPLAY_PAGE_SIZE = 3;
const defaultDeposito = { latitude: -27.3586, longitude: -53.3958 };
const RAIO_OPTIONS = [3, 5, 8, 10, 12, 15, 20];
const MapLocationPicker = dynamic(
  () => import("@/components/MapLocationPicker").then((mod) => ({ default: mod.MapLocationPicker })),
  { ssr: false, loading: () => <div>Carregando mapa...</div> }
);

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const buildFamiliaPairKey = (a: number, b: number) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
  return a < b ? `${a}:${b}` : `${b}:${a}`;
};
const extractFamiliesFromPedido = (pedido: any): number[] => {
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  const familias = new Set<number>();
  itens.forEach((item: any) => {
    const familiaId = Number(
      item?.familia_id ?? item?.familia?.id ?? item?.produto?.familia_id ?? item?.produto?.familia?.id
    );
    if (Number.isFinite(familiaId)) familias.add(familiaId);
  });
  return Array.from(familias);
};
const formatDateBR = (value: any) => {
  if (!value) return "-";
  const asString = String(value).trim();
  const iso = asString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = asString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  const d = new Date(asString);
  if (!Number.isNaN(d.getTime())) {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  return asString;
};

const parseDateTimeToTimestamp = (value: any) => {
  if (!value) return Number.NaN;
  const parsed = new Date(value);
  const ts = parsed.getTime();
  if (!Number.isNaN(ts)) return ts;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? Number.NaN : numeric;
};

const normalizeId = (value: number | string | null | undefined) => Number(value ?? 0);

const parsePedidoDateToTimestamp = (value: any): number | null => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const asString = String(value).trim();
  const iso = asString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const parsed = new Date(`${iso[1]}-${iso[2]}-${iso[3]}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  const br = asString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const parsed = new Date(`${br[3]}-${br[2]}-${br[1]}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  const parsed = new Date(asString);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

type PedidoEnriquecido = Pedido & {
  _totalItens?: number;
  _pesoTotal?: number;
  _volumeTotal?: number;
  cidade?: string;
  rota?: number | null;
};
type SortKey =
  | "id"
  | "nf"
  | "cliente"
  | "cidade"
  | "data"
  | "itens"
  | "peso"
  | "volume"
  | "status";
type SortDirection = "asc" | "desc";
const isPedidoEntregue = (pedido: any) => {
  const rotas = Array.isArray((pedido as any).rotas) ? (pedido as any).rotas : [];
  if (rotas.length === 0) return false;
  return rotas.every((rota: any) => rota.status === "CONCLUIDA");
};

const isPedidoEmRotaAtiva = (pedido: any) => {
  const rotas = Array.isArray((pedido as any).rotas) ? (pedido as any).rotas : [];
  if (rotas.length > 0) {
    return rotas.some((rota: any) => rota.status !== "CONCLUIDA");
  }
  const rotaDireta = (pedido as any).rota;
  return typeof rotaDireta !== "undefined" && rotaDireta !== null;
};

const getPedidoStatusInfo = (pedido: PedidoEnriquecido) => {
  const rotas = Array.isArray((pedido as any).rotas) ? (pedido as any).rotas : [];
  const possuiResumoRota = pedido.rota !== null && typeof pedido.rota !== "undefined";
  if (rotas.length > 0) {
    const todasConcluidas = rotas.every((rota: any) => rota.status === "CONCLUIDA");
    const algumaExecucao = rotas.some((rota: any) => rota.status === "EM_EXECUCAO");
    if (todasConcluidas) return { label: statusLabels.CONCLUIDA, rank: 3 };
    if (algumaExecucao) return { label: statusLabels.EM_EXECUCAO, rank: 2 };
    return { label: statusLabels.PLANEJADA, rank: 1 };
  }
  if (possuiResumoRota) return { label: "Rota vinculada", rank: 4 };
  return { label: "Pendente", rank: 0 };
};

export default function PedidosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [displayPage, setDisplayPage] = useState(1);
  const [nextApiOffset, setNextApiOffset] = useState(0);
  const [savingRouteId, setSavingRouteId] = useState<number | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [depositoCoords, setDepositoCoords] = useState(defaultDeposito);
  const [showDepositoMap, setShowDepositoMap] = useState(false);
  const selectionSectionRef = useRef<HTMLDivElement | null>(null);
  const [basePedidoId, setBasePedidoId] = useState<number | null>(null);
const [raioKm, setRaioKm] = useState(RAIO_OPTIONS[0]);
const [aplicandoRaio, setAplicandoRaio] = useState(false);
const [raioErro, setRaioErro] = useState<string | null>(null);
  const [raioInfo, setRaioInfo] = useState<string | null>(null);
const [loadingMore, setLoadingMore] = useState(false);
const [restricoesFamilias, setRestricoesFamilias] = useState<RestricaoFamilia[]>([]);
const [carregandoRestricoes, setCarregandoRestricoes] = useState(false);
const [restricoesErro, setRestricoesErro] = useState<string | null>(null);
const [familiaAlert, setFamiliaAlert] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleDepositoChange = (field: "latitude" | "longitude") => (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || raw === null) return;
    const value = Number(raw);
    setDepositoCoords((prev) => {
      if (!Number.isFinite(value)) return prev;
      return { ...prev, [field]: value };
    });
  };

  const aplicarRaio = async () => {
    if (!basePedidoId) {
      setRaioErro("Selecione um pedido base.");
      return;
    }
    setAplicandoRaio(true);
    setRaioErro(null);
    setRaioInfo(null);
    try {
      const resp = await fetch(
        `/api/proxy/pedidos?pedido_base=${basePedidoId}&raio_km=${raioKm}&limit=500`,
        { cache: "no-store" }
      );
      const raw = await resp.text();
      if (!resp.ok) throw new Error(parseApiError(raw, "Falha ao buscar pedidos pelo raio.", resp.status));
      const data = JSON.parse(raw) as API<APIGetPedidosResponse>;
      if (!data.success) throw new Error(data.detail || "Erro ao aplicar raio.");
      const proximos = data.data?.results ?? [];
      const proximosValidos = proximos.filter((pedido: any) => !isPedidoEntregue(pedido) && !isPedidoEmRotaAtiva(pedido));
      if (proximosValidos.length === 0) {
        setRaioInfo(`Nenhum pedido elegível encontrado em ${raioKm} km do pedido ${basePedidoId}.`);
        return;
      }
      setPedidos((prev) => {
        const map = new Map<number, Pedido>();
        prev.forEach((pedido) => map.set(normalizeId(pedido.id), pedido));
        proximosValidos.forEach((pedido: any) => {
          const idNorm = normalizeId(pedido.id);
          if (Number.isFinite(idNorm)) {
            map.set(idNorm, { ...pedido, id: idNorm } as Pedido);
          }
        });
        return Array.from(map.values());
      });
      const familiasExtras = new Map<number, number[]>();
      const listaAtual = [...selectedIds];
      const idsAdicionados: number[] = [];
      const rejeitadosRestricao: number[] = [];

      const conflitosDetectados: string[] = [];
      proximosValidos.forEach((pedido: any) => {
        const idNorm = normalizeId(pedido.id);
        if (!Number.isFinite(idNorm)) return;
        const familiasPedido = extractFamiliesFromPedido(pedido);
        familiasExtras.set(idNorm, familiasPedido);
        const conflito = encontrarConflitoComLista(familiasPedido, listaAtual, familiasExtras);
        if (conflito !== null) {
          rejeitadosRestricao.push(idNorm);
          conflitosDetectados.push(
            buildConflictMessage(idNorm, conflito.pedidoId, familiasPedido, conflito.familias)
          );
          return;
        }
        listaAtual.push(idNorm);
        idsAdicionados.push(idNorm);
      });

      const selecionadosAtualizados = Array.from(new Set(listaAtual));
      setSelectedIds(selecionadosAtualizados);
      setRaioInfo(
        `Encontrados ${proximosValidos.length} pedidos em até ${raioKm} km do pedido ${basePedidoId}. Adicionados ${idsAdicionados.length}.`
      );
      if (rejeitadosRestricao.length > 0) {
        setFamiliaAlert(
          conflitosDetectados.length > 0
            ? conflitosDetectados.join(" ")
            : `Ignoramos os pedidos ${rejeitadosRestricao.join(", ")} porque conflitam com outras notas selecionadas.`
        );
      } else {
        setFamiliaAlert(null);
      }
    } catch (err) {
      setRaioErro(err instanceof Error ? err.message : "Não foi possível aplicar o raio.");
    } finally {
      setAplicandoRaio(false);
    }
  };

  const displayName = useMemo(
    () => (session?.user?.name || session?.user?.email || "Usuário").toString(),
    [session?.user?.name, session?.user?.email]
  );
  const roleLabel = session?.user?.is_superuser ? "Administrador" : session?.user?.profile?.name || "Usuário padrão";
  const avatarLetter = useMemo(
    () => (displayName.trim()[0] ? displayName.trim()[0].toUpperCase() : "U"),
    [displayName]
  );

  const loadPedidos = async (currentOffset: number, replace = false): Promise<number> => {
    if (replace) {
      setLoading(true);
      setError(null);
      setInfo(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const resp = await fetch(`/api/proxy/pedidos?limit=${API_PAGE_SIZE}&offset=${currentOffset}`, {
        cache: "no-store",
      });
      const raw = await resp.text();
      if (!resp.ok) throw new Error(parseApiError(raw, "Não foi possível carregar os pedidos.", resp.status));
      const data = JSON.parse(raw) as API<APIGetPedidosResponse>;
      if (!data.success) throw new Error(data.detail || "Erro ao buscar pedidos.");
      setTotalCount(data.data?.count ?? 0);
      let lista = data.data?.results ?? [];

      const pedidosSemItens = lista.filter(
        (p) =>
          !Array.isArray((p as any).itens) ||
          ((p as any).itens?.length ?? 0) === 0 ||
          (p as any).total_itens === 0 ||
          (p as any).total_itens === null ||
          typeof (p as any).total_itens === "undefined"
      );

      if (pedidosSemItens.length > 0) {
        const detalhes = await Promise.all(
          pedidosSemItens.map(async (p) => {
            try {
              const r = await fetch(`/api/proxy/pedidos/${p.id}`, { cache: "no-store" });
              const txt = await r.text();
              if (!r.ok) return null;
              const parsed = JSON.parse(txt) as API<APIGetPedidoResponse>;
              if (!parsed.success || !parsed.data) return null;
              return parsed.data;
            } catch {
              return null;
            }
          })
        );

        lista = lista.map((p) => {
          const det = detalhes.find((d) => d && d.id === p.id);
          if (!det) return p;
          return {
            ...p,
            itens: det.itens ?? (p as any).itens,
            total_itens: det.total_itens ?? (p as any).total_itens,
            peso_total: det.peso_total ?? (p as any).peso_total,
            volume_total: det.volume_total ?? (p as any).volume_total,
          } as Pedido;
        });
      }

      const listaNormalizada = lista.map(
        (p) =>
          ({
            ...p,
            id: normalizeId((p as any).id),
          } as Pedido)
      );

      setPedidos((prev) => {
        if (replace) return listaNormalizada;
        const map = new Map<number, Pedido>();
        prev.forEach((pedido) => map.set(normalizeId(pedido.id), pedido));
        listaNormalizada.forEach((pedido) => {
          map.set(normalizeId(pedido.id), pedido);
        });
        return Array.from(map.values());
      });
      setNextApiOffset(currentOffset + listaNormalizada.length);
      if (replace) {
        setDisplayPage(1);
      }
      return listaNormalizada.length;
    } catch (err) {
      if (replace) {
        setPedidos([]);
        setError(err instanceof Error ? err.message : "Falha ao carregar pedidos.");
        setInfo(null);
      } else {
        setError(err instanceof Error ? err.message : "Falha ao carregar pedidos adicionais.");
      }
      return 0;
    } finally {
      if (replace) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (searchParams?.get("tab") === "selecionar") {
      setTimeout(() => {
        selectionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [searchParams]);

  useEffect(() => {
    loadPedidos(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    const loadRestricoes = async () => {
      setCarregandoRestricoes(true);
      setRestricoesErro(null);
      try {
        const resp = await fetch("/api/proxy/restricoes-familias?ativo=true&limit=500", { cache: "no-store" });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(parseApiError(raw, "Falha ao carregar restrições de famílias.", resp.status));
        const parsed = JSON.parse(raw) as API<APIGetRestricoesFamiliasResponse>;
        if (!parsed.success) throw new Error(parsed.detail || "Erro ao carregar restrições de famílias.");
        if (!active) return;
        setRestricoesFamilias(parsed.data?.results ?? []);
      } catch (err) {
        if (!active) return;
        setRestricoesErro(err instanceof Error ? err.message : "Não foi possível validar restrições de famílias.");
      } finally {
        if (active) setCarregandoRestricoes(false);
      }
    };
    loadRestricoes();
    return () => {
      active = false;
    };
  }, []);

  const pedidosWithTotals = useMemo<PedidoEnriquecido[]>(() => {
    return pedidos.map((pedido) => {
      const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

      const totalItensFromApi = Number((pedido as any).total_itens);
      const pesoTotalFromApi = Number((pedido as any).peso_total);
      const volumeTotalFromApi = Number((pedido as any).volume_total);

      const totalItens =
        Number.isFinite(totalItensFromApi)
          ? totalItensFromApi
          : itens.reduce((sum, it) => sum + Number(it.quantidade || 0), 0);

      const pesoTotal =
        Number.isFinite(pesoTotalFromApi)
          ? pesoTotalFromApi
          : itens.reduce(
              (sum, it) =>
                sum +
                (Number(it.peso_total) ||
                  Number(it.quantidade || 0) * Number((it as any)?.produto?.peso || 0)),
              0
            );

      const volumeTotal =
        Number.isFinite(volumeTotalFromApi)
          ? volumeTotalFromApi
          : itens.reduce(
              (sum, it) => sum + Number(it.quantidade || 0) * Number((it as any)?.produto?.volume || 0),
              0
            );

      const cidade = (pedido as any).cidade || "-";

      const rota =
        typeof (pedido as any).rota !== "undefined"
          ? (pedido as any).rota
          : Array.isArray((pedido as any).rotas) && (pedido as any).rotas.length > 0
          ? (pedido as any).rotas[0].id ?? null
          : null;

      return { ...pedido, _totalItens: totalItens, _pesoTotal: pesoTotal, _volumeTotal: volumeTotal, cidade, rota };
    });
  }, [pedidos]);
  const restricaoPairs = useMemo(() => {
    const pairs = new Set<string>();
    restricoesFamilias.forEach((r) => {
      const origem = Number(r.familia_origem?.id);
      const destino = Number(r.familia_restrita?.id);
      const key = buildFamiliaPairKey(origem, destino);
      if (key) pairs.add(key);
    });
    return pairs;
  }, [restricoesFamilias]);

  const restricaoDetalhes = useMemo(() => {
    const mapa = new Map<string, RestricaoFamilia>();
    restricoesFamilias.forEach((r) => {
      const origem = Number(r.familia_origem?.id);
      const destino = Number(r.familia_restrita?.id);
      const key = buildFamiliaPairKey(origem, destino);
      if (key) mapa.set(key, r);
    });
    return mapa;
  }, [restricoesFamilias]);

  const pedidoFamiliasMap = useMemo(() => {
    const map = new Map<number, number[]>();
    pedidosWithTotals.forEach((pedido) => {
      map.set(pedido.id, extractFamiliesFromPedido(pedido));
    });
    return map;
  }, [pedidosWithTotals]);

  const hasConflictBetweenFamilias = useCallback(
    (familiasA?: number[], familiasB?: number[]): boolean => {
      if (!familiasA?.length || !familiasB?.length) return false;
      for (const fa of familiasA) {
        for (const fb of familiasB) {
          const key = buildFamiliaPairKey(fa, fb);
          if (key && restricaoPairs.has(key)) return true;
        }
      }
      return false;
    },
    [restricaoPairs]
  );

  const descreverConflitoFamilias = useCallback(
    (familiasA?: number[], familiasB?: number[]): string | null => {
      if (!familiasA?.length || !familiasB?.length) return null;
      for (const fa of familiasA) {
        for (const fb of familiasB) {
          const key = buildFamiliaPairKey(fa, fb);
          if (key && restricaoDetalhes.has(key)) {
            const restricao = restricaoDetalhes.get(key)!;
            const origemNome = restricao.familia_origem?.nome ?? restricao.familia_origem?.descricao ?? "Família A";
            const destinoNome = restricao.familia_restrita?.nome ?? restricao.familia_restrita?.descricao ?? "Família B";
            return `${origemNome} × ${destinoNome}`;
          }
        }
      }
      return null;
    },
    [restricaoDetalhes]
  );

  const encontrarConflitoComLista = useCallback(
    (
      familiasNovo: number[],
      listaIds: number[],
      extras?: Map<number, number[]>
    ): { pedidoId: number; familias: number[] } | null => {
      for (const id of listaIds) {
        const familiasExistente = extras?.get(id) ?? pedidoFamiliasMap.get(id) ?? [];
        if (hasConflictBetweenFamilias(familiasNovo, familiasExistente)) {
          return { pedidoId: id, familias: familiasExistente };
        }
      }
      return null;
    },
    [pedidoFamiliasMap, hasConflictBetweenFamilias]
  );

  const buildConflictMessage = useCallback(
    (pedidoId: number, outroId: number, familiasPedido: number[], familiasOutro: number[]) => {
      const descricao = descreverConflitoFamilias(familiasPedido, familiasOutro);
      if (descricao) {
        return `Pedido #${pedidoId} não pode ser combinado com o pedido #${outroId} (${descricao}).`;
      }
      return `Pedido #${pedidoId} conflita com o pedido #${outroId} (famílias incompatíveis).`;
    },
    [descreverConflitoFamilias]
  );

  const handleSortChange = useCallback(
    (key: SortKey) => {
      setSortDirection((prevDir) => (sortKey === key ? (prevDir === "asc" ? "desc" : "asc") : "asc"));
      setSortKey(key);
      setDisplayPage(1);
    },
    [sortKey]
  );

  const sortedPedidos = useMemo<PedidoEnriquecido[]>(() => {
    const sorted = [...pedidosWithTotals];
    const direction = sortDirection === "asc" ? 1 : -1;
    const getPedidoTimestamp = (pedido: PedidoEnriquecido) => {
      const parsed = parsePedidoDateToTimestamp(pedido.dtpedido);
      if (typeof parsed === "number" && !Number.isNaN(parsed)) return parsed;
      const created = parseDateTimeToTimestamp((pedido as any).created_at ?? pedido.dtpedido);
      return Number.isNaN(created) ? Number.NaN : created;
    };
    const getSortValue = (pedido: PedidoEnriquecido) => {
      switch (sortKey) {
        case "id":
          return normalizeId(pedido.id);
        case "nf": {
          const nfNum = Number(pedido.nf);
          return Number.isFinite(nfNum) ? nfNum : (pedido.nf ?? "").toString();
        }
        case "cliente":
          return (pedido.cliente ?? "").toString();
        case "cidade":
          return (pedido.cidade ?? "").toString();
        case "data":
          return getPedidoTimestamp(pedido);
        case "itens":
          return Number(pedido._totalItens ?? 0);
        case "peso":
          return Number(pedido._pesoTotal ?? 0);
        case "volume":
          return Number(pedido._volumeTotal ?? 0);
        case "status":
          return getPedidoStatusInfo(pedido).rank;
        default:
          return "";
      }
    };
    sorted.sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);
      const aInvalid =
        valueA === null ||
        typeof valueA === "undefined" ||
        (typeof valueA === "number" && Number.isNaN(valueA));
      const bInvalid =
        valueB === null ||
        typeof valueB === "undefined" ||
        (typeof valueB === "number" && Number.isNaN(valueB));
      if (aInvalid || bInvalid) {
        if (aInvalid && bInvalid) return 0;
        return aInvalid ? 1 : -1;
      }
      const diff =
        typeof valueA === "number" && typeof valueB === "number"
          ? valueA - valueB
          : String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" });
      if (diff !== 0) return diff * direction;
      return (normalizeId(a.id) - normalizeId(b.id)) * direction;
    });
    return sorted;
  }, [pedidosWithTotals, sortKey, sortDirection]);

  const displayedPedidos = useMemo<PedidoEnriquecido[]>(() => {
    const startIndex = Math.max(0, (displayPage - 1) * DISPLAY_PAGE_SIZE);
    return sortedPedidos.slice(startIndex, startIndex + DISPLAY_PAGE_SIZE);
  }, [sortedPedidos, displayPage]);

  const totalPages = useMemo(() => {
    const baseCount = totalCount || sortedPedidos.length || 0;
    const pages = Math.ceil(baseCount / DISPLAY_PAGE_SIZE);
    return Math.max(1, pages || 1);
  }, [totalCount, sortedPedidos.length]);
  const canPrev = displayPage > 1;
  const canNext = displayPage < totalPages;

  useEffect(() => {
    const maxPages = Math.max(1, Math.ceil(((totalCount || sortedPedidos.length || 0) / DISPLAY_PAGE_SIZE) || 1));
    if (displayPage > maxPages) {
      setDisplayPage(maxPages);
    }
  }, [displayPage, sortedPedidos.length, totalCount]);

  const ensureDataForPage = async (targetPage: number) => {
    const neededItems = targetPage * DISPLAY_PAGE_SIZE;
    let loadedItems = sortedPedidos.length;
    let offsetPointer = nextApiOffset;

    while (neededItems > loadedItems && offsetPointer < totalCount) {
      const fetched = await loadPedidos(offsetPointer, false);
      if (fetched <= 0) {
        break;
      }
      offsetPointer += fetched;
      loadedItems += fetched;
    }
  };

  const handleChangePage = async (targetPage: number) => {
    if (targetPage < 1 || loading || loadingMore) return;
    const maxPages = Math.max(1, Math.ceil(((totalCount || sortedPedidos.length || 0) / DISPLAY_PAGE_SIZE) || 1));
    if (targetPage > maxPages) return;
    await ensureDataForPage(targetPage);
    setDisplayPage(targetPage);
  };

  const selectedOrders = pedidosWithTotals.filter(
    (p) => selectedIds.includes(p.id) && !isPedidoEntregue(p) && !isPedidoEmRotaAtiva(p)
  );

  const handleToggleSelect = useCallback(
    (id: number, checked: boolean) => {
      let alertMsg: string | null | undefined = null;
      setSelectedIds((prev) => {
        if (!checked) {
          alertMsg = null;
          return prev.filter((p) => p !== id);
        }
        if (prev.includes(id)) {
          alertMsg = null;
          return prev;
        }
        const pedido = pedidosWithTotals.find((p) => p.id === id);
        if (!pedido || isPedidoEntregue(pedido) || isPedidoEmRotaAtiva(pedido)) {
          alertMsg = "Pedido indisponível para roteirização.";
          return prev;
        }
        const familiasPedido = pedidoFamiliasMap.get(id) ?? [];
        const conflito = encontrarConflitoComLista(familiasPedido, prev);
        if (conflito !== null) {
          alertMsg = buildConflictMessage(id, conflito.pedidoId, familiasPedido, conflito.familias);
          return prev;
        }
        alertMsg = null;
        return [...prev, id];
      });
      setFamiliaAlert(alertMsg ?? null);
    },
    [pedidosWithTotals, pedidoFamiliasMap, encontrarConflitoComLista, buildConflictMessage]
  );

  const handleToggleSelectAll = useCallback(
    (checked: boolean) => {
      let alertMsg: string | null | undefined = null;
      setSelectedIds((prev) => {
        const restantes = prev.filter((id) => !displayedPedidos.some((pedido) => pedido.id === id));
        if (!checked) {
          alertMsg = null;
          return restantes;
        }
        let acumulados = [...restantes];
        const rejeitados: number[] = [];
        displayedPedidos.forEach((pedido) => {
          if (isPedidoEntregue(pedido) || isPedidoEmRotaAtiva(pedido)) {
            return;
          }
          const familiasPedido = pedidoFamiliasMap.get(pedido.id) ?? [];
          const conflito = encontrarConflitoComLista(familiasPedido, acumulados);
          if (conflito !== null) {
            rejeitados.push(
              buildConflictMessage(pedido.id, conflito.pedidoId, familiasPedido, conflito.familias) ||
                `#${pedido.id}`
            );
            return;
          }
          acumulados.push(pedido.id);
        });
        if (rejeitados.length > 0) {
          alertMsg =
            rejeitados.length === 1
              ? rejeitados[0]
              : `Alguns pedidos foram ignorados por restrições: ${rejeitados.join("; ")}`;
        } else {
          alertMsg = null;
        }
        return acumulados;
      });
      setFamiliaAlert(alertMsg ?? null);
    },
    [displayedPedidos, pedidoFamiliasMap, encontrarConflitoComLista, buildConflictMessage]
  );

  useEffect(() => {
    let remocaoPorRotas = false;
    let remocaoPorRestricao = false;
    let conflitoMsg: string | null = null;
    setSelectedIds((prev) => {
      const atualizados: number[] = [];
      prev.forEach((id) => {
        const pedido = pedidosWithTotals.find((p) => p.id === id);
        if (!pedido || isPedidoEntregue(pedido) || isPedidoEmRotaAtiva(pedido)) {
          remocaoPorRotas = true;
          return;
        }
        const familiasPedido = pedidoFamiliasMap.get(id) ?? [];
        const conflito = encontrarConflitoComLista(familiasPedido, atualizados);
        if (conflito !== null) {
          remocaoPorRestricao = true;
          if (!conflitoMsg) {
            conflitoMsg = buildConflictMessage(id, conflito.pedidoId, familiasPedido, conflito.familias);
          }
          return;
        }
        atualizados.push(id);
      });
      return atualizados;
    });
    if (remocaoPorRestricao) {
      setFamiliaAlert(conflitoMsg || "Ajustamos os pedidos selecionados para respeitar restrições de famílias.");
    }
    if (remocaoPorRotas) {
      setInfo("Removemos pedidos que já fazem parte de outra rota.");
    }
  }, [pedidosWithTotals, pedidoFamiliasMap, encontrarConflitoComLista, buildConflictMessage]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setBasePedidoId(null);
      return;
    }
    if (!basePedidoId || !selectedIds.includes(basePedidoId)) {
      setBasePedidoId(selectedIds[0]);
    }
  }, [selectedIds, basePedidoId]);

  const handleOptimize = async () => {
    setError(null);
    setInfo(null);
    setSavingRouteId(null);

    const selecionadosValidos = selectedIds
      .map((id) => pedidosWithTotals.find((p) => p.id === id))
      .filter((pedido): pedido is PedidoEnriquecido => {
        if (!pedido) return false;
        return !isPedidoEntregue(pedido) && !isPedidoEmRotaAtiva(pedido);
      });

    if (selecionadosValidos.length < 2) {
      setError("Selecione pelo menos 2 pedidos disponíveis para otimizar a rota.");
      return;
    }

    setOptimizing(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const capacidade = selecionadosValidos.reduce((sum, p) => sum + (Number(p._pesoTotal) || 0), 0);

      const hasInvalidCoords = selecionadosValidos.some((p) => {
        const lat = Number((p as any).latitude);
        const lng = Number((p as any).longitude);
        return !Number.isFinite(lat) || !Number.isFinite(lng);
      });

      if (hasInvalidCoords) {
        throw new Error("Algum pedido selecionado está sem latitude/longitude. Edite e preencha para otimizar.");
      }

        const deposito = depositoCoords;

      const otimizaResp = await fetch("/api/proxy/otimizar-rota-genetico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidos_ids: selecionadosValidos.map((p) => p.id),
          deposito,
        }),
      });
      const otimizaText = await otimizaResp.text();
      if (!otimizaResp.ok) throw new Error(parseApiError(otimizaText, "Falha ao otimizar rota.", otimizaResp.status));
      const otimizaData = otimizaText ? JSON.parse(otimizaText) : {};
      const resultado =
        otimizaData?.resultado ||
        otimizaData?.data?.resultado ||
        otimizaData?.data ||
        otimizaData;
      const resultadoBruto = resultado;
      let pedidosOrdenados: number[] = resultado?.pedidos_ordem ?? [];
      const distanciaOtimizada = resultado?.distancia_total_km;

      if ((!pedidosOrdenados || pedidosOrdenados.length === 0) && Array.isArray(resultado?.rota_otimizada)) {
        // rota_otimizada traz índices; converte para IDs na mesma ordem enviada
        pedidosOrdenados = resultado.rota_otimizada
          .map((idx: number) => selecionadosValidos[idx]?.id)
          .filter((id: number | undefined): id is number => typeof id === "number");
      }

      pedidosOrdenados = Array.isArray(pedidosOrdenados)
        ? pedidosOrdenados
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))
        : [];

      if (!Array.isArray(pedidosOrdenados) || pedidosOrdenados.length === 0) {
        throw new Error(
          `Otimização não retornou uma ordem de pedidos. Resultado bruto: ${JSON.stringify(resultadoBruto) || "vazio"}`
        );
      }

      const resp = await fetch("/api/proxy/salvar-rota-otimizada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_rota: hoje,
          capacidade_max: capacidade || 0,
          pedidos_ordem: pedidosOrdenados,
          distancia_total: distanciaOtimizada || null,
        }),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(parseApiError(text, "Falha ao criar rota.", resp.status));
      const data = text ? JSON.parse(text) : {};
      if (data.success === false || data.status === "error") throw new Error(data.detail || data.error || "Erro ao criar rota.");
      const rotaCriadaIdRaw = data?.rota_id ?? data?.id ?? data?.data?.rota_id ?? data?.data?.id ?? null;
      const rotaCriadaId = rotaCriadaIdRaw !== null && typeof rotaCriadaIdRaw !== "undefined"
        ? Number(rotaCriadaIdRaw)
        : null;
      setSavingRouteId(Number.isFinite(rotaCriadaId ?? NaN) ? rotaCriadaId : null);
      const ordemHuman = pedidosOrdenados.join(" → ");
      const distanciaMsg =
        typeof distanciaOtimizada === "number" ? ` | Distância: ${distanciaOtimizada} km` : "";
      const algoritmo = resultado?.algoritmo || "genetico";
      setInfo(
        ordemHuman
          ? `Rota otimizada criada (${algoritmo}). Ordem: ${ordemHuman}${distanciaMsg}`
          : `Rota otimizada criada (${algoritmo}).${distanciaMsg}`
      );
      setSelectedIds([]);
      await loadPedidos(0, true);
      if (rotaCriadaId && Number.isFinite(rotaCriadaId)) {
        router.push(`/rotas?rota=${rotaCriadaId}`);
      } else {
        router.push("/rotas");
      }
    } catch (e: any) {
      setError(e.message || "Erro ao gerar rota.");
    } finally {
      setOptimizing(false);
    }
  };

  const handleDelete = async (pedidoId: number) => {
    if (!confirm(`Excluir o pedido ${pedidoId}?`)) return;
    setError(null);
    setInfo(null);
    setDeletingId(pedidoId);
    try {
      const targetId = normalizeId(pedidoId);
      const newTotal = Math.max(0, totalCount - 1);
      const resp = await fetch(`/api/proxy/pedidos/${pedidoId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(parseApiError(text, "Falha ao excluir pedido.", resp.status));
      }
      setPedidos((prev) => prev.filter((p) => normalizeId((p as any).id) !== targetId));
      setSelectedIds((prev) => prev.filter((id) => normalizeId(id) !== targetId));
      setTotalCount(newTotal);
      setInfo("Pedido excluído com sucesso.");
      await loadPedidos(0, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir pedido.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`${inter.className} ${styles.wrapper}`}>
      <AppSidebar active="pedidos" />

      <main className={`${styles.content} ${styles.ordersContent}`}>
        {loading && <LoadingOverlay message="Carregando pedidos..." />}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost}`}
                disabled={selectedIds.length === 0 || optimizing}
                onClick={handleOptimize}
              >
                {optimizing ? "Gerando..." : "Gerar rota"}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => router.push("/entregas/novo")}
              >
                + Novo pedido
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

        <section className={styles.card} style={{ marginTop: 12 }}>
          <div className={styles["card-head"]}>
            <h3>Ponto de partida</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                onClick={() => setDepositoCoords(defaultDeposito)}
                disabled={optimizing}
              >
                Usar padrão
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
                onClick={() => setShowDepositoMap((prev) => !prev)}
                disabled={optimizing}
              >
                {showDepositoMap ? "Esconder mapa" : "Selecionar no mapa"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
              <span className={styles.muted}>Latitude</span>
              <input
                type="number"
                step="0.000001"
                value={depositoCoords.latitude}
                onChange={handleDepositoChange("latitude")}
                className={styles.input}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
              <span className={styles.muted}>Longitude</span>
              <input
                type="number"
                step="0.000001"
                value={depositoCoords.longitude}
                onChange={handleDepositoChange("longitude")}
                className={styles.input}
              />
            </label>
          </div>
          {showDepositoMap && (
            <div style={{ marginTop: 12 }}>
              <MapLocationPicker initialCoords={depositoCoords} onLocationSelect={setDepositoCoords} />
            </div>
          )}
          <p className={styles.muted} style={{ marginTop: 8 }}>
            Essas coordenadas serao usadas como ponto inicial ao otimizar e gerar relatorios.
          </p>
        </section>

        <OrdersTable
          pedidos={displayedPedidos}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onEdit={(id) => router.push(`/entregas/${id}/editar`)}
          onDelete={handleDelete}
          deletingId={deletingId}
          loading={loading}
          formatDateBR={formatDateBR}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          pagination={{
            currentPage: displayPage,
            totalPages,
            totalCount: totalCount || sortedPedidos.length,
            canPrev,
            canNext,
            loading: loading || loadingMore,
            onPrev: () => handleChangePage(displayPage - 1),
            onNext: () => handleChangePage(displayPage + 1),
          }}
        />
        {carregandoRestricoes && <p className={styles.muted}>Validando restrições de famílias...</p>}
        {restricoesErro && <p className={styles.muted}>{restricoesErro}</p>}
        {familiaAlert && <p className={styles.muted}>{familiaAlert}</p>}

        {error && <p className={styles.muted}>{error}</p>}
        {!error && info && <p className={styles.muted}>{info}</p>}
        {savingRouteId && (
          <div className={styles["quick-actions"]}>
            <span className={styles.muted}>Rota criada #{savingRouteId}</span>
          </div>
        )}

        {selectedOrders.length === 0 && (
          <p className={styles.muted} style={{ marginTop: 12 }} ref={selectionSectionRef}>
            Selecione um pedido para usar o raio.
          </p>
        )}
        {selectedOrders.length > 0 && (
          <section className={`${styles.card} ${styles.simpleCard}`} style={{ marginTop: 12 }} ref={selectionSectionRef}>
            <div className={styles["card-head"]}>
              <div>
                <h3>Pedidos próximos</h3>
                <p className={styles.radiusHint}>
                  Use um pedido base e informe o raio para encontrar notas nas proximidades.
                </p>
              </div>
            </div>
            <div className={styles.radiusRow}>
              <label className={styles.radiusField}>
                <span>Pedido base</span>
                <select value={basePedidoId ?? ""} onChange={(e) => setBasePedidoId(Number(e.target.value) || null)}>
                  {selectedOrders.map((pedido) => (
                    <option value={pedido.id} key={pedido.id}>
                      #{pedido.id} — {pedido.cliente ?? "Cliente"}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.radiusField}>
                <span>Raio em km</span>
                <select value={raioKm} onChange={(e) => setRaioKm(Number(e.target.value) || RAIO_OPTIONS[0])}>
                  {RAIO_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary} ${styles.sm} ${styles.radiusAction}`}
                onClick={aplicarRaio}
                disabled={aplicandoRaio}
              >
                {aplicandoRaio ? "Buscando..." : "Aplicar raio"}
              </button>
            </div>
            {raioErro && <small className={styles.muted}>{raioErro}</small>}
            {!raioErro && raioInfo && <small className={styles.muted}>{raioInfo}</small>}
          </section>
        )}

        <div className={`${styles.ordersGrid} ${styles.ordersGridResponsive}`}>
          <div className={styles.mapWrapper}>
            <SelectedOrdersMap
              pedidos={selectedOrders.map((p) => ({
                id: p.id,
                cliente: (p as any).cliente,
                nf: p.nf,
                cidade: p.cidade,
                latitude: (p as any).latitude,
                longitude: (p as any).longitude,
                peso_total: p._pesoTotal,
                volume_total: p._volumeTotal,
              }))}
            />
          </div>

          <section className={`${styles.card} ${styles.summaryCard}`}>
            <div className={`${styles["card-head"]} ${styles.summaryHead}`}>
              <h3>Resumo dos selecionados</h3>
              <span className={styles.muted}>
                {selectedOrders.length > 0 ? `${selectedOrders.length} pedido(s)` : "Nenhum pedido selecionado"}
              </span>
            </div>
            {selectedOrders.length === 0 && <p className={styles.muted}>Selecione pedidos na tabela.</p>}
            {selectedOrders.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selectedOrders.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "12px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--panel-muted, rgba(255,255,255,0.02))",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <strong>#{p.id}</strong> - {p.cliente ?? "-"}
                      </div>
                      <span className={styles.muted}>{p.cidade ?? "-"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6, fontSize: 13 }}>
                      <span>NF: {p.nf ?? "-"}</span>
                      <span>Itens: {p._totalItens ?? 0}</span>
                      <span>Peso: {p._pesoTotal ?? "-"}</span>
                      <span>Volume: {p._volumeTotal ?? "-"}</span>
                      <span>
                        Status:{" "}
                        {p.rota !== null && typeof p.rota !== "undefined" ? (
                          <span className={`${styles.badge} ${styles.done}`}>Rota gerada</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.warn}`}>Pendente</span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.primary} ${styles.sm}`}
                    onClick={handleOptimize}
                    disabled={optimizing || selectedOrders.length === 0}
                  >
                    {optimizing ? "Gerando..." : "Gerar rota"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
