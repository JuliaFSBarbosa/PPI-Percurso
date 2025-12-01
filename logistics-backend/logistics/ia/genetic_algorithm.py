import random
import math
from typing import List, Tuple
import time


def calcular_distancia(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    # Distância Haversine em quilômetros entre dois pontos (lat, lon).
    lat1, lon1 = coord1
    lat2, lon2 = coord2

    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))

    raio_terra = 6371
    return raio_terra * c


def avaliar_rota(rota: List[int], coordenadas: List[Tuple[float, float]], deposito: Tuple[float, float]) -> float:
    # Custo total da rota: depósito -> pontos -> depósito.
    if not rota:
        return 0

    custo_total = 0
    custo_total += calcular_distancia(deposito, coordenadas[rota[0]])

    for i in range(len(rota) - 1):
        coord_atual = coordenadas[rota[i]]
        coord_proxima = coordenadas[rota[i + 1]]
        custo_total += calcular_distancia(coord_atual, coord_proxima)

    custo_total += calcular_distancia(coordenadas[rota[-1]], deposito)
    return custo_total


def criar_populacao_inicial(tamanho_pop: int, num_pedidos: int) -> List[List[int]]:
    # Gera rotas iniciais embaralhadas.
    populacao = []
    rota_base = list(range(num_pedidos))

    for _ in range(tamanho_pop):
        rota = rota_base.copy()
        random.shuffle(rota)
        populacao.append(rota)

    return populacao


def selecao_torneio(populacao: List[List[int]], fitness: List[float], tamanho_torneio: int = 3) -> List[int]:
    # Seleção por torneio; menor fitness vence.
    indices_torneio = random.sample(range(len(populacao)), tamanho_torneio)
    vencedor_idx = min(indices_torneio, key=lambda i: fitness[i])
    return populacao[vencedor_idx].copy()


def crossover_ordem(pai1: List[int], pai2: List[int]) -> Tuple[List[int], List[int]]:
    # Crossover OX preservando ordem relativa.
    tamanho = len(pai1)

    ponto1 = random.randint(0, tamanho - 2)
    ponto2 = random.randint(ponto1 + 1, tamanho)

    filho1 = [-1] * tamanho
    filho2 = [-1] * tamanho

    filho1[ponto1:ponto2] = pai1[ponto1:ponto2]
    filho2[ponto1:ponto2] = pai2[ponto1:ponto2]

    pos_filho1 = ponto2
    for gene in pai2[ponto2:] + pai2[:ponto2]:
        if gene not in filho1:
            if pos_filho1 >= tamanho:
                pos_filho1 = 0
            filho1[pos_filho1] = gene
            pos_filho1 += 1

    pos_filho2 = ponto2
    for gene in pai1[ponto2:] + pai1[:ponto2]:
        if gene not in filho2:
            if pos_filho2 >= tamanho:
                pos_filho2 = 0
            filho2[pos_filho2] = gene
            pos_filho2 += 1

    return filho1, filho2


def mutacao_troca(rota: List[int], taxa_mutacao: float = 0.2) -> List[int]:
    # Troca dois genes aleatoriamente.
    if random.random() < taxa_mutacao:
        idx1, idx2 = random.sample(range(len(rota)), 2)
        rota[idx1], rota[idx2] = rota[idx2], rota[idx1]
    return rota


def mutacao_inversao(rota: List[int], taxa_mutacao: float = 0.1) -> List[int]:
    # Inverte um segmento da rota.
    if random.random() < taxa_mutacao:
        tamanho = len(rota)
        idx1 = random.randint(0, tamanho - 2)
        idx2 = random.randint(idx1 + 1, tamanho)
        rota[idx1:idx2] = reversed(rota[idx1:idx2])
    return rota


def algoritmo_genetico(
    pedidos_coords: List[Tuple[float, float]],
    deposito_coords: Tuple[float, float],
    tamanho_pop: int = 100,
    num_geracoes: int = 500,
    taxa_crossover: float = 0.8,
    taxa_mutacao: float = 0.2,
    elitismo: int = 2,
) -> dict:
    # Algoritmo genético para otimizar a ordem de entregas.
    inicio_tempo = time.time()

    num_pedidos = len(pedidos_coords)
    populacao = criar_populacao_inicial(tamanho_pop, num_pedidos)

    historico_melhor = []
    historico_media = []

    melhor_rota_global = None
    melhor_fitness_global = float("inf")
    geracoes_sem_melhora = 0

    for geracao in range(num_geracoes):
        fitness = [avaliar_rota(rota, pedidos_coords, deposito_coords) for rota in populacao]

        idx_melhor = fitness.index(min(fitness))
        melhor_fitness = fitness[idx_melhor]
        melhor_rota = populacao[idx_melhor]

        if melhor_fitness < melhor_fitness_global:
            melhor_fitness_global = melhor_fitness
            melhor_rota_global = melhor_rota.copy()
            geracoes_sem_melhora = 0
        else:
            geracoes_sem_melhora += 1

        historico_melhor.append(melhor_fitness)
        historico_media.append(sum(fitness) / len(fitness))

        if geracoes_sem_melhora > 100:
            print(f"Convergiu na geracao {geracao}")
            break

        nova_populacao = []

        indices_elite = sorted(range(len(fitness)), key=lambda i: fitness[i])[:elitismo]
        for idx in indices_elite:
            nova_populacao.append(populacao[idx].copy())

        while len(nova_populacao) < tamanho_pop:
            pai1 = selecao_torneio(populacao, fitness)
            pai2 = selecao_torneio(populacao, fitness)

            if random.random() < taxa_crossover:
                filho1, filho2 = crossover_ordem(pai1, pai2)
            else:
                filho1, filho2 = pai1.copy(), pai2.copy()

            filho1 = mutacao_troca(filho1, taxa_mutacao)
            filho1 = mutacao_inversao(filho1, taxa_mutacao * 0.5)

            filho2 = mutacao_troca(filho2, taxa_mutacao)
            filho2 = mutacao_inversao(filho2, taxa_mutacao * 0.5)

            nova_populacao.append(filho1)
            if len(nova_populacao) < tamanho_pop:
                nova_populacao.append(filho2)

        populacao = nova_populacao

    tempo_execucao = time.time() - inicio_tempo

    melhoria_percentual = 0
    if historico_melhor and historico_melhor[0]:
        melhoria_percentual = round(
            (historico_melhor[0] - melhor_fitness_global) / historico_melhor[0] * 100, 2
        )

    return {
        "rota_otimizada": melhor_rota_global,
        "distancia_total_km": round(melhor_fitness_global, 2),
        "num_geracoes": geracao + 1,
        "tempo_execucao_s": round(tempo_execucao, 2),
        "historico_melhor": historico_melhor,
        "historico_media": historico_media,
        "melhoria_percentual": melhoria_percentual,
    }


def otimizar_rota_pedidos(pedidos: List[dict], deposito: dict) -> dict:
    # Converte pedidos e depósito para o GA e retorna rota otimizada.
    pedidos_coords = [(p["latitude"], p["longitude"]) for p in pedidos]
    deposito_coords = (deposito["latitude"], deposito["longitude"])

    resultado = algoritmo_genetico(
        pedidos_coords=pedidos_coords,
        deposito_coords=deposito_coords,
        tamanho_pop=100,
        num_geracoes=500,
        taxa_crossover=0.8,
        taxa_mutacao=0.2,
        elitismo=2,
    )

    rota_ids = [pedidos[idx]["id"] for idx in resultado["rota_otimizada"]]

    rota_coords = [
        {"latitude": deposito_coords[0], "longitude": deposito_coords[1], "tipo": "deposito", "ordem": 0}
    ]

    for i, idx in enumerate(resultado["rota_otimizada"], 1):
        rota_coords.append(
            {
                "latitude": pedidos_coords[idx][0],
                "longitude": pedidos_coords[idx][1],
                "pedido_id": pedidos[idx]["id"],
                "tipo": "entrega",
                "ordem": i,
            }
        )

    rota_coords.append(
        {"latitude": deposito_coords[0], "longitude": deposito_coords[1], "tipo": "deposito", "ordem": len(rota_coords)}
    )

    return {
        "pedidos_ordem": rota_ids,
        "rota_coordenadas": rota_coords,
        "distancia_total_km": resultado["distancia_total_km"],
        "tempo_execucao_s": resultado["tempo_execucao_s"],
        "num_geracoes": resultado["num_geracoes"],
        "melhoria_percentual": resultado["melhoria_percentual"],
    }
