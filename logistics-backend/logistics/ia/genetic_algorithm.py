import random
import math
from typing import List, Tuple
import time

def calcular_distancia(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """
    Calcula distância entre dois pontos usando fórmula de Haversine
    Retorna distância em quilômetros
    """
    lat1, lon1 = coord1
    lon2, lat2 = coord2
    
    # Converte para radianos
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Diferenças
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Fórmula de Haversine
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Raio da Terra em km
    raio_terra = 6371
    
    return raio_terra * c


def avaliar_rota(rota: List[int], coordenadas: List[Tuple[float, float]], 
                 deposito: Tuple[float, float]) -> float:
    """
    Avalia o custo total de uma rota
    Inclui ida do depósito ao primeiro ponto e volta ao depósito
    """
    if not rota:
        return 0
    
    custo_total = 0
    
    # Do depósito ao primeiro ponto
    custo_total += calcular_distancia(deposito, coordenadas[rota[0]])
    
    # Entre os pontos da rota
    for i in range(len(rota) - 1):
        coord_atual = coordenadas[rota[i]]
        coord_proxima = coordenadas[rota[i + 1]]
        custo_total += calcular_distancia(coord_atual, coord_proxima)
    
    # Do último ponto de volta ao depósito
    custo_total += calcular_distancia(coordenadas[rota[-1]], deposito)
    
    return custo_total


def criar_populacao_inicial(tamanho_pop: int, num_pedidos: int) -> List[List[int]]:
    """
    Cria população inicial com rotas aleatórias
    """
    populacao = []
    rota_base = list(range(num_pedidos))
    
    for _ in range(tamanho_pop):
        rota = rota_base.copy()
        random.shuffle(rota)
        populacao.append(rota)
    
    return populacao


def selecao_torneio(populacao: List[List[int]], fitness: List[float], 
                    tamanho_torneio: int = 3) -> List[int]:
    """
    Seleciona um indivíduo através de torneio
    Menor fitness (distância) é melhor
    """
    indices_torneio = random.sample(range(len(populacao)), tamanho_torneio)
    vencedor_idx = min(indices_torneio, key=lambda i: fitness[i])
    return populacao[vencedor_idx].copy()


def crossover_ordem(pai1: List[int], pai2: List[int]) -> Tuple[List[int], List[int]]:
    """
    Crossover de Ordem (OX) - mantém ordem relativa dos elementos
    """
    tamanho = len(pai1)
    
    # Escolhe dois pontos de corte
    ponto1 = random.randint(0, tamanho - 2)
    ponto2 = random.randint(ponto1 + 1, tamanho)
    
    # Cria filhos
    filho1 = [-1] * tamanho
    filho2 = [-1] * tamanho
    
    # Copia segmento do pai1 para filho1
    filho1[ponto1:ponto2] = pai1[ponto1:ponto2]
    
    # Copia segmento do pai2 para filho2
    filho2[ponto1:ponto2] = pai2[ponto1:ponto2]
    
    # Preenche resto do filho1 com elementos do pai2
    pos_filho1 = ponto2
    for gene in pai2[ponto2:] + pai2[:ponto2]:
        if gene not in filho1:
            if pos_filho1 >= tamanho:
                pos_filho1 = 0
            filho1[pos_filho1] = gene
            pos_filho1 += 1
    
    # Preenche resto do filho2 com elementos do pai1
    pos_filho2 = ponto2
    for gene in pai1[ponto2:] + pai1[:ponto2]:
        if gene not in filho2:
            if pos_filho2 >= tamanho:
                pos_filho2 = 0
            filho2[pos_filho2] = gene
            pos_filho2 += 1
    
    return filho1, filho2


def mutacao_troca(rota: List[int], taxa_mutacao: float = 0.2) -> List[int]:
    """
    Mutação por troca de dois elementos
    """
    if random.random() < taxa_mutacao:
        idx1, idx2 = random.sample(range(len(rota)), 2)
        rota[idx1], rota[idx2] = rota[idx2], rota[idx1]
    
    return rota


def mutacao_inversao(rota: List[int], taxa_mutacao: float = 0.1) -> List[int]:
    """
    Mutação por inversão de um segmento
    """
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
    elitismo: int = 2
) -> dict:
    """
    Algoritmo Genético para otimização de rotas
    
    Args:
        pedidos_coords: Lista de coordenadas (lat, lng) dos pedidos
        deposito_coords: Coordenadas (lat, lng) do depósito
        tamanho_pop: Tamanho da população
        num_geracoes: Número de gerações
        taxa_crossover: Probabilidade de crossover
        taxa_mutacao: Probabilidade de mutação
        elitismo: Número de melhores indivíduos preservados
    
    Returns:
        dict com melhor rota, distância, histórico de evolução
    """
    inicio_tempo = time.time()
    
    num_pedidos = len(pedidos_coords)
    
    # Cria população inicial
    populacao = criar_populacao_inicial(tamanho_pop, num_pedidos)
    
    # Histórico para análise
    historico_melhor = []
    historico_media = []
    
    melhor_rota_global = None
    melhor_fitness_global = float('inf')
    geracoes_sem_melhora = 0
    
    for geracao in range(num_geracoes):
        # Avalia fitness de toda população
        fitness = [avaliar_rota(rota, pedidos_coords, deposito_coords) 
                   for rota in populacao]
        
        # Encontra melhor da geração
        idx_melhor = fitness.index(min(fitness))
        melhor_fitness = fitness[idx_melhor]
        melhor_rota = populacao[idx_melhor]
        
        # Atualiza melhor global
        if melhor_fitness < melhor_fitness_global:
            melhor_fitness_global = melhor_fitness
            melhor_rota_global = melhor_rota.copy()
            geracoes_sem_melhora = 0
        else:
            geracoes_sem_melhora += 1
        
        # Registra histórico
        historico_melhor.append(melhor_fitness)
        historico_media.append(sum(fitness) / len(fitness))
        
        # Critério de parada antecipada
        if geracoes_sem_melhora > 50:
            print(f"Convergiu na geração {geracao}")
            break
        
        # Cria nova população
        nova_populacao = []
        
        # Elitismo - preserva os melhores
        indices_elite = sorted(range(len(fitness)), key=lambda i: fitness[i])[:elitismo]
        for idx in indices_elite:
            nova_populacao.append(populacao[idx].copy())
        
        # Gera resto da população
        while len(nova_populacao) < tamanho_pop:
            # Seleção
            pai1 = selecao_torneio(populacao, fitness)
            pai2 = selecao_torneio(populacao, fitness)
            
            # Crossover
            if random.random() < taxa_crossover:
                filho1, filho2 = crossover_ordem(pai1, pai2)
            else:
                filho1, filho2 = pai1.copy(), pai2.copy()
            
            # Mutação
            filho1 = mutacao_troca(filho1, taxa_mutacao)
            filho1 = mutacao_inversao(filho1, taxa_mutacao * 0.5)
            
            filho2 = mutacao_troca(filho2, taxa_mutacao)
            filho2 = mutacao_inversao(filho2, taxa_mutacao * 0.5)
            
            nova_populacao.append(filho1)
            if len(nova_populacao) < tamanho_pop:
                nova_populacao.append(filho2)
        
        populacao = nova_populacao
    
    tempo_execucao = time.time() - inicio_tempo
    
    return {
        'rota_otimizada': melhor_rota_global,
        'distancia_total_km': round(melhor_fitness_global, 2),
        'num_geracoes': geracao + 1,
        'tempo_execucao_s': round(tempo_execucao, 2),
        'historico_melhor': historico_melhor,
        'historico_media': historico_media,
        'melhoria_percentual': round(
            (historico_melhor[0] - melhor_fitness_global) / historico_melhor[0] * 100, 2
        ) if historico_melhor else 0
    }


# Função auxiliar para converter resultado para formato da API
def otimizar_rota_pedidos(pedidos: List[dict], deposito: dict) -> dict:
    """
    Wrapper para integração com a API Django
    
    Args:
        pedidos: Lista de dicts com {id, latitude, longitude}
        deposito: Dict com {latitude, longitude}
    
    Returns:
        dict com rota otimizada e informações
    """
    # Extrai coordenadas
    pedidos_coords = [(p['latitude'], p['longitude']) for p in pedidos]
    deposito_coords = (deposito['latitude'], deposito['longitude'])
    
    # Executa algoritmo genético
    resultado = algoritmo_genetico(
        pedidos_coords=pedidos_coords,
        deposito_coords=deposito_coords,
        tamanho_pop=100,
        num_geracoes=500,
        taxa_crossover=0.8,
        taxa_mutacao=0.2,
        elitismo=2
    )
    
    # Mapeia índices para IDs dos pedidos
    rota_ids = [pedidos[idx]['id'] for idx in resultado['rota_otimizada']]
    
    # Adiciona coordenadas na ordem da rota
    rota_coords = []
    rota_coords.append({
        'latitude': deposito_coords[0],
        'longitude': deposito_coords[1],
        'tipo': 'deposito',
        'ordem': 0
    })
    
    for i, idx in enumerate(resultado['rota_otimizada'], 1):
        rota_coords.append({
            'latitude': pedidos_coords[idx][0],
            'longitude': pedidos_coords[idx][1],
            'pedido_id': pedidos[idx]['id'],
            'tipo': 'entrega',
            'ordem': i
        })
    
    rota_coords.append({
        'latitude': deposito_coords[0],
        'longitude': deposito_coords[1],
        'tipo': 'deposito',
        'ordem': len(rota_coords)
    })
    
    return {
        'pedidos_ordem': rota_ids,
        'rota_coordenadas': rota_coords,
        'distancia_total_km': resultado['distancia_total_km'],
        'tempo_execucao_s': resultado['tempo_execucao_s'],
        'num_geracoes': resultado['num_geracoes'],
        'melhoria_percentual': resultado['melhoria_percentual']
    }