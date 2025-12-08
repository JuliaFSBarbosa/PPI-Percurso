from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q

from logistics.models import (
    Familia,
    Pedido,
    PedidoRestricaoGrupo,
    Produto,
    ProdutoPedido,
    RestricaoFamilia,
    Rota,
)


def _buscar_restricoes_relevantes(familia_ids: Iterable[int]) -> List[RestricaoFamilia]:
    ids = list({fid for fid in familia_ids if fid})
    if not ids:
        return []
    return list(
        RestricaoFamilia.objects.filter(ativo=True).filter(
            Q(familia_origem_id__in=ids) | Q(familia_restrita_id__in=ids)
        )
    )


def _montar_grafo(restricoes: Sequence[RestricaoFamilia]) -> Dict[int, Set[int]]:
    grafo: Dict[int, Set[int]] = defaultdict(set)
    for restricao in restricoes:
        grafo[restricao.familia_origem_id].add(restricao.familia_restrita_id)
        grafo[restricao.familia_restrita_id].add(restricao.familia_origem_id)
    return grafo


def _criar_grupos_por_coloring(familias: Set[int], restricoes: Sequence[RestricaoFamilia]):
    grafo = _montar_grafo(restricoes)
    if not grafo:
        return {fid: 0 for fid in familias}, 1

    familias_ordenadas = sorted(
        familias,
        key=lambda fid: (len(grafo.get(fid, set())), fid),
        reverse=True,
    )
    atribuicoes: Dict[int, int] = {}
    grupos: List[Set[int]] = []

    for familia_id in familias_ordenadas:
        conflitos = grafo.get(familia_id, set())
        alocado = False
        for idx, grupo in enumerate(grupos):
            if not (grupo & conflitos):
                grupo.add(familia_id)
                atribuicoes[familia_id] = idx
                alocado = True
                break
        if not alocado:
            grupos.append({familia_id})
            atribuicoes[familia_id] = len(grupos) - 1
    return atribuicoes, len(grupos)


def limpar_grupos_restricao(pedido: Pedido):
    pedido.itens.update(grupo_restricao=None)
    pedido.grupos_restricao.all().delete()


def aplicar_restricoes_no_pedido(pedido: Pedido) -> Dict[str, object]:
    itens = list(pedido.itens.select_related("produto__familia"))
    familias_presentes = {item.produto.familia_id for item in itens if item.produto and item.produto.familia_id}
    restricoes = _buscar_restricoes_relevantes(familias_presentes)

    if not restricoes or len(familias_presentes) <= 1:
        if pedido.grupos_restricao.exists():
            limpar_grupos_restricao(pedido)
        return {"possui_reparticao": False, "mensagem": None}

    atribuicoes, total_grupos = _criar_grupos_por_coloring(familias_presentes, restricoes)
    if total_grupos <= 1:
        if pedido.grupos_restricao.exists():
            limpar_grupos_restricao(pedido)
        return {"possui_reparticao": False, "mensagem": None}

    conflitos_texto = {
        f"{r.familia_origem.nome} x {r.familia_restrita.nome}"
        for r in restricoes
        if r.familia_origem_id in familias_presentes and r.familia_restrita_id in familias_presentes
    }

    with transaction.atomic():
        limpar_grupos_restricao(pedido)
        grupos_criados: Dict[int, PedidoRestricaoGrupo] = {}
        familias_map = defaultdict(list)
        for familia_id, idx in atribuicoes.items():
            familias_map[idx].append(familia_id)

        for idx, familia_ids in familias_map.items():
            grupo = PedidoRestricaoGrupo.objects.create(
                pedido=pedido,
                titulo=f"Grupo {idx + 1}",
                ativo=True,
            )
            grupo.familias.set(Familia.objects.filter(id__in=familia_ids))
            grupos_criados[idx] = grupo

        for item in itens:
            grupo_idx = atribuicoes.get(item.produto.familia_id)
            grupo = grupos_criados.get(grupo_idx)
            item.grupo_restricao = grupo
            item.save(update_fields=["grupo_restricao"])

    mensagem = (
        f"Itens da NF foram repartidos em {total_grupos} grupos "
        f"para evitar conflitos entre: {', '.join(sorted(conflitos_texto))}."
    )
    return {
        "possui_reparticao": True,
        "total_grupos": total_grupos,
        "mensagem": mensagem,
    }


def analisar_restricoes_para_itens_payload(itens_payload: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Normaliza os itens enviados no payload e identifica restrições
    entre as famílias envolvidas antes mesmo de persistir o pedido.
    """
    analise_base = {
        "possui_conflito": False,
        "total_grupos": 0,
        "conflitos": [],
        "grupos": [],
        "mensagem": None,
    }
    if not itens_payload:
        return analise_base

    produto_ids = {item.get("produto_id") for item in itens_payload if item.get("produto_id")}
    produtos_map = {
        produto.id: produto
        for produto in Produto.objects.filter(id__in=produto_ids).select_related("familia")
    }
    if len(produto_ids) != len(produtos_map):
        raise ValidationError("Alguns produtos informados não foram encontrados.")

    itens_normalizados: List[Dict[str, Any]] = []
    familias_presentes: Set[int] = set()
    for raw in itens_payload:
        produto_id = raw.get("produto_id")
        quantidade = int(raw.get("quantidade") or 0)
        produto = produtos_map.get(produto_id)
        if not produto:
            raise ValidationError(f"Produto {produto_id} não encontrado.")
        familia_id = produto.familia_id
        if familia_id:
            familias_presentes.add(familia_id)
        itens_normalizados.append(
            {
                "produto_id": produto.id,
                "produto_nome": produto.nome,
                "quantidade": quantidade,
                "familia_id": familia_id,
                "familia_nome": produto.familia.nome if produto.familia else "Sem família",
            }
        )

    restricoes = _buscar_restricoes_relevantes(familias_presentes)
    if not restricoes or len(familias_presentes) <= 1:
        return analise_base

    atribuicoes, total_grupos = _criar_grupos_por_coloring(familias_presentes, restricoes)
    if total_grupos <= 1:
        return analise_base

    conflitos_texto = sorted(
        {
            f"{r.familia_origem.nome} x {r.familia_restrita.nome}"
            for r in restricoes
            if r.familia_origem_id in familias_presentes and r.familia_restrita_id in familias_presentes
        }
    )

    grupos_detalhados: List[Dict[str, Any]] = []
    for idx in sorted(set(atribuicoes.values())):
        itens_grupo = [item for item in itens_normalizados if atribuicoes.get(item["familia_id"], -1) == idx]
        familias_nomes = sorted({item["familia_nome"] for item in itens_grupo if item["familia_nome"]})
        grupos_detalhados.append(
            {
                "indice": idx,
                "titulo": f"Grupo {idx + 1}",
                "familias": familias_nomes,
                "familia_ids": sorted({item["familia_id"] for item in itens_grupo if item["familia_id"]}),
                "total_itens": sum(item["quantidade"] for item in itens_grupo),
                "itens": itens_grupo,
            }
        )

    mensagem = (
        "Pedido possui produtos de famílias incompatíveis "
        f"({', '.join(conflitos_texto)}). Divida o pedido para manter a NF e "
        "garantir a entrega separada por restrição."
    )
    analise_base.update(
        {
            "possui_conflito": True,
            "total_grupos": total_grupos,
            "conflitos": conflitos_texto,
            "grupos": grupos_detalhados,
            "mensagem": mensagem,
        }
    )
    return analise_base


def dividir_pedido_validado(dados_pedido: Dict[str, Any], analise: Optional[Dict[str, Any]] = None) -> List[Pedido]:
    """
    Cria múltiplos pedidos a partir de um payload validado,
    dividindo os itens conforme os grupos identificados.
    """
    analise = analise or analisar_restricoes_para_itens_payload(dados_pedido.get("itens") or [])
    if not analise.get("possui_conflito") or not analise.get("grupos"):
        raise ValidationError("Não há restrições suficientes para dividir o pedido.")

    campos_base = {k: v for k, v in dados_pedido.items() if k != "itens"}
    pedidos_criados: List[Pedido] = []

    with transaction.atomic():
        for grupo in analise.get("grupos", []):
            dados_novos = dict(campos_base)
            pedido = Pedido.objects.create(**dados_novos)
            for item in grupo.get("itens", []):
                ProdutoPedido.objects.create(
                    pedido=pedido,
                    produto_id=item["produto_id"],
                    quantidade=item["quantidade"],
                )
            aplicar_restricoes_no_pedido(pedido)
            pedidos_criados.append(pedido)
    return pedidos_criados


def _buscar_conflito_familias(familias_a: Set[int], familias_b: Set[int]) -> Optional[RestricaoFamilia]:
    if not familias_a or not familias_b:
        return None
    return (
        RestricaoFamilia.objects.filter(ativo=True)
        .filter(
            (Q(familia_origem_id__in=familias_a) & Q(familia_restrita_id__in=familias_b))
            | (Q(familia_origem_id__in=familias_b) & Q(familia_restrita_id__in=familias_a))
        )
        .select_related("familia_origem", "familia_restrita")
        .first()
    )


def obter_familias_do_pedido(
    pedido: Pedido,
    grupo: Optional[PedidoRestricaoGrupo],
    ignorar_validacao_grupo: bool = False,
) -> Set[int]:
    itens = pedido.itens.select_related("produto__familia")
    if grupo:
        itens = itens.filter(grupo_restricao=grupo)
    elif not ignorar_validacao_grupo and pedido.grupos_restricao.filter(ativo=True).exists():
        raise ValidationError(
            f"Pedido {pedido.id} possui itens repartidos. Informe o grupo da restricao na solicitacao."
        )
    familias = {item.produto.familia_id for item in itens if item.produto and item.produto.familia_id}
    return familias


def coletar_familias_da_rota(rota: Rota) -> Set[int]:
    familias: Set[int] = set()
    rota_pedidos = rota.pedidos.select_related("pedido", "grupo_restricao").prefetch_related("pedido__itens__produto__familia")
    for rel in rota_pedidos:
        familias_rel = obter_familias_do_pedido(rel.pedido, rel.grupo_restricao, ignorar_validacao_grupo=True)
        familias.update(familias_rel)
    return familias


def validar_novos_vinculos_em_rota(
    novos_vinculos: Sequence[Tuple[Pedido, Optional[PedidoRestricaoGrupo]]],
    familias_iniciais: Optional[Set[int]] = None,
) -> None:
    familias_base = set(familias_iniciais or set())
    for pedido, grupo in novos_vinculos:
        familias_novas = obter_familias_do_pedido(pedido, grupo)
        conflito = _buscar_conflito_familias(familias_base, familias_novas)
        if conflito:
            raise ValidationError(
                f"Não é permitido combinar '{conflito.familia_origem.nome}' com "
                f"'{conflito.familia_restrita.nome}' na mesma rota."
            )
        familias_base.update(familias_novas)


def normalizar_payload_pedidos(payload: Sequence[object]) -> List[Dict[str, Optional[int]]]:
    normalizados: List[Dict[str, Optional[int]]] = []
    for item in payload:
        if isinstance(item, int):
            normalizados.append({"pedido_id": item, "grupo_restricao_id": None})
        elif isinstance(item, dict):
            pedido_id = item.get("pedido_id") or item.get("id")
            grupo_id = item.get("grupo_restricao_id") or item.get("grupo_id")
            if not pedido_id:
                raise ValidationError("Informe o identificador do pedido na restrição.")
            normalizados.append(
                {
                    "pedido_id": int(pedido_id),
                    "grupo_restricao_id": int(grupo_id) if grupo_id is not None else None,
                }
            )
        else:
            raise ValidationError("Formato de pedido inválido. Utilize ID ou objeto com pedido_id.")
    return normalizados
