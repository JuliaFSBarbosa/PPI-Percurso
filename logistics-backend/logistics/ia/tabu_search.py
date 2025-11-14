# logistics/ia/tabu_search.py
"""
Algoritmo de Refinamento: Busca Tabu
Melhora uma rota inicial explorando vizinhanças e evitando ciclos com lista tabu
"""

import math
import copy
from typing import List, Dict, Tuple, Set


class TabuSearch:
    """
    Implementa a Busca Tabu para otimização de rotas
    """
    
    def __init__(
        self,
        rota_inicial: List[int],
        pedidos_dict: Dict[int, Dict],
        deposito: Tuple[float, float],
        tamanho_lista_tabu: int = 10,
        max_iteracoes: int = 100,
        max_sem_melhoria: int = 20
    ):
        """
        Args:
            rota_inicial: Lista de IDs dos pedidos na ordem inicial
            pedidos_dict: Dicionário {id_pedido: {lat, lon, peso, ...}}
            deposito: (latitude, longitude) do depósito
            tamanho_lista_tabu: Tamanho da lista tabu
            max_iteracoes: Número máximo de iterações
            max_sem_melhoria: Parar se não melhorar após N iterações
        """
        self.rota_atual = rota_inicial.copy()
        self.pedidos = pedidos_dict
        self.deposito = deposito
        self.tamanho_lista_tabu = tamanho_lista_tabu
        self.max_iteracoes = max_iteracoes
        self.max_sem_melhoria = max_sem_melhoria
        
        # Lista tabu: armazena movimentos proibidos temporariamente
        # Formato: [(i, j), ...] onde i e j são posições trocadas
        self.lista_tabu: List[Tuple[int, int]] = []
        
        # Melhor solução encontrada
        self.melhor_rota = rota_inicial.copy()
        self.melhor_distancia = self.calcular_distancia_total(rota_inicial)
    
    def calcular_distancia_haversine(
        self, 
        coord1: Tuple[float, float], 
        coord2: Tuple[float, float]
    ) -> float:
        """Calcula distância entre dois pontos usando fórmula de Haversine"""
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = (math.sin(dlat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2)
        c = 2 * math.asin(math.sqrt(a))
        
        return 6371 * c  # Raio da Terra em km
    
    def calcular_distancia_total(self, rota: List[int]) -> float:
        """
        Calcula distância total de uma rota
        Inclui: Depósito → Pedido1 → ... → PedidoN → Depósito
        """
        if not rota:
            return 0.0
        
        distancia = 0.0
        posicao_atual = self.deposito
        
        # Percorrer todos os pedidos
        for pedido_id in rota:
            pedido = self.pedidos[pedido_id]
            coord_pedido = (pedido['latitude'], pedido['longitude'])
            distancia += self.calcular_distancia_haversine(posicao_atual, coord_pedido)
            posicao_atual = coord_pedido
        
        # Voltar ao depósito
        distancia += self.calcular_distancia_haversine(posicao_atual, self.deposito)
        
        return distancia
    
    def gerar_vizinhanca_2opt(self, rota: List[int]) -> List[Tuple[List[int], Tuple[int, int]]]:
        """
        Gera vizinhança usando movimento 2-opt
        2-opt inverte um segmento da rota
        
        Exemplo: [1,2,3,4,5] com i=1, j=3 → [1,3,2,4,5]
        
        Returns:
            Lista de tuplas (nova_rota, (i, j))
        """
        vizinhos = []
        n = len(rota)
        
        for i in range(n - 1):
            for j in range(i + 2, n + 1):
                # Criar nova rota com segmento invertido
                nova_rota = rota[:i] + rota[i:j][::-1] + rota[j:]
                vizinhos.append((nova_rota, (i, j)))
        
        return vizinhos
    
    def gerar_vizinhanca_swap(self, rota: List[int]) -> List[Tuple[List[int], Tuple[int, int]]]:
        """
        Gera vizinhança usando movimento SWAP
        Troca dois pedidos de posição
        
        Exemplo: [1,2,3,4,5] com i=1, j=3 → [1,4,3,2,5]
        
        Returns:
            Lista de tuplas (nova_rota, (i, j))
        """
        vizinhos = []
        n = len(rota)
        
        for i in range(n):
            for j in range(i + 1, n):
                # Criar nova rota trocando posições i e j
                nova_rota = rota.copy()
                nova_rota[i], nova_rota[j] = nova_rota[j], nova_rota[i]
                vizinhos.append((nova_rota, (i, j)))
        
        return vizinhos
    
    def movimento_eh_tabu(self, movimento: Tuple[int, int]) -> bool:
        """Verifica se um movimento está na lista tabu"""
        return movimento in self.lista_tabu
    
    def adicionar_movimento_tabu(self, movimento: Tuple[int, int]):
        """Adiciona movimento à lista tabu (FIFO)"""
        self.lista_tabu.append(movimento)
        
        # Manter tamanho da lista tabu
        if len(self.lista_tabu) > self.tamanho_lista_tabu:
            self.lista_tabu.pop(0)
    
    def criterio_aspiracao(self, distancia: float) -> bool:
        """
        Critério de aspiração: aceita movimento tabu se for melhor que a melhor solução
        
        Returns:
            True se o movimento deve ser aceito mesmo sendo tabu
        """
        return distancia < self.melhor_distancia
    
    def otimizar(self, verbose: bool = False) -> Dict:
        """
        Executa a Busca Tabu
        
        Args:
            verbose: Se True, imprime log das iterações
            
        Returns:
            Dicionário com resultado da otimização:
            {
                'rota_otimizada': lista de IDs,
                'distancia_inicial': distância antes,
                'distancia_final': distância depois,
                'melhoria_percentual': % de redução,
                'iteracoes': número de iterações,
                'historico': [(iteracao, distancia), ...]
            }
        """
        distancia_inicial = self.melhor_distancia
        iteracoes_sem_melhoria = 0
        historico = [(0, distancia_inicial)]
        
        if verbose:
            print(f"🚀 Iniciando Busca Tabu")
            print(f"📍 Rota inicial: {self.rota_atual}")
            print(f"📏 Distância inicial: {distancia_inicial:.2f} km\n")
        
        for iteracao in range(1, self.max_iteracoes + 1):
            # Gerar vizinhança (combinando 2-opt e swap)
            vizinhos_2opt = self.gerar_vizinhanca_2opt(self.rota_atual)
            vizinhos_swap = self.gerar_vizinhanca_swap(self.rota_atual)
            todos_vizinhos = vizinhos_2opt + vizinhos_swap
            
            # Encontrar melhor vizinho não-tabu
            melhor_vizinho = None
            melhor_distancia_vizinho = float('inf')
            melhor_movimento = None
            
            for vizinho_rota, movimento in todos_vizinhos:
                distancia_vizinho = self.calcular_distancia_total(vizinho_rota)
                
                # Aceitar se não for tabu OU se satisfizer critério de aspiração
                eh_tabu = self.movimento_eh_tabu(movimento)
                aceitar = not eh_tabu or self.criterio_aspiracao(distancia_vizinho)
                
                if aceitar and distancia_vizinho < melhor_distancia_vizinho:
                    melhor_vizinho = vizinho_rota
                    melhor_distancia_vizinho = distancia_vizinho
                    melhor_movimento = movimento
            
            # Se não encontrou vizinho válido, parar
            if melhor_vizinho is None:
                if verbose:
                    print(f"⚠️ Nenhum vizinho válido encontrado na iteração {iteracao}")
                break
            
            # Atualizar rota atual
            self.rota_atual = melhor_vizinho
            self.adicionar_movimento_tabu(melhor_movimento)
            
            # Atualizar melhor solução global
            if melhor_distancia_vizinho < self.melhor_distancia:
                self.melhor_rota = melhor_vizinho.copy()
                self.melhor_distancia = melhor_distancia_vizinho
                iteracoes_sem_melhoria = 0
                
                if verbose:
                    print(f"✨ Iteração {iteracao}: Nova melhor solução! "
                          f"Distância: {self.melhor_distancia:.2f} km")
            else:
                iteracoes_sem_melhoria += 1
            
            historico.append((iteracao, self.melhor_distancia))
            
            # Critério de parada: muitas iterações sem melhoria
            if iteracoes_sem_melhoria >= self.max_sem_melhoria:
                if verbose:
                    print(f"\n⏹️ Parada: {self.max_sem_melhoria} iterações sem melhoria")
                break
        
        # Calcular melhoria
        melhoria = ((distancia_inicial - self.melhor_distancia) / distancia_inicial) * 100
        
        if verbose:
            print(f"\n{'='*60}")
            print(f"✅ Otimização concluída!")
            print(f"📏 Distância inicial: {distancia_inicial:.2f} km")
            print(f"📏 Distância final: {self.melhor_distancia:.2f} km")
            print(f"📊 Melhoria: {melhoria:.2f}%")
            print(f"🔄 Iterações executadas: {iteracao}")
            print(f"📍 Rota otimizada: {self.melhor_rota}")
        
        return {
            'rota_otimizada': self.melhor_rota,
            'distancia_inicial': round(distancia_inicial, 2),
            'distancia_final': round(self.melhor_distancia, 2),
            'melhoria_percentual': round(melhoria, 2),
            'iteracoes': iteracao,
            'historico': historico
        }


# =====================================================================
# FUNÇÃO INTEGRADA: VIZINHO MAIS PRÓXIMO + BUSCA TABU
# =====================================================================

def otimizar_rota_completa(
    pedidos_queryset,
    capacidade_veiculo: float,
    deposito_lat: float,
    deposito_lon: float,
    verbose: bool = False
) -> Dict:
    """
    Pipeline completo: Constrói rota inicial com NN e refina com Busca Tabu
    
    Args:
        pedidos_queryset: QuerySet de Pedido do Django
        capacidade_veiculo: Capacidade em kg
        deposito_lat: Latitude do depósito
        deposito_lon: Longitude do depósito
        verbose: Se True, imprime logs
        
    Returns:
        Dicionário com resultado completo da otimização
    """
    from logistics.ia.nearest_neighbor import (
        preparar_pedidos_para_ia,
        NearestNeighbor
    )
    
    # 1. Preparar dados
    pedidos_lista = preparar_pedidos_para_ia(pedidos_queryset)
    deposito = (deposito_lat, deposito_lon)
    
    # Criar dicionário para busca tabu
    pedidos_dict = {p['id']: p for p in pedidos_lista}
    
    if verbose:
        print(f"\n{'='*60}")
        print(f"🤖 PIPELINE DE OTIMIZAÇÃO DE ROTAS")
        print(f"{'='*60}")
        print(f"📦 Total de pedidos: {len(pedidos_lista)}")
        print(f"🚛 Capacidade do veículo: {capacidade_veiculo} kg")
        print(f"📍 Depósito: ({deposito_lat:.4f}, {deposito_lon:.4f})\n")
    
    # 2. Construir rota inicial com Vizinho Mais Próximo
    if verbose:
        print("📍 FASE 1: Construção da Rota Inicial (Vizinho Mais Próximo)")
        print("-" * 60)
    
    nn = NearestNeighbor(pedidos_lista, capacidade_veiculo, deposito)
    resultado_nn = nn.construir_rota()
    
    if not resultado_nn['pedidos_rota']:
        return {
            'success': False,
            'erro': 'Não foi possível construir rota inicial',
            'detalhes': resultado_nn
        }
    
    if verbose:
        print(f"✅ Rota inicial construída")
        print(f"📏 Distância: {resultado_nn['distancia_total']:.2f} km")
        print(f"⚖️ Peso total: {resultado_nn['peso_total']:.2f} kg")
        print(f"📦 Pedidos na rota: {len(resultado_nn['pedidos_rota'])}")
        if resultado_nn['pedidos_nao_atendidos']:
            print(f"⚠️ Pedidos não atendidos: {len(resultado_nn['pedidos_nao_atendidos'])}")
    
    # 3. Refinar com Busca Tabu
    if verbose:
        print(f"\n{'='*60}")
        print("🔍 FASE 2: Refinamento (Busca Tabu)")
        print("-" * 60)
    
    tabu = TabuSearch(
        rota_inicial=resultado_nn['pedidos_rota'],
        pedidos_dict=pedidos_dict,
        deposito=deposito,
        tamanho_lista_tabu=10,
        max_iteracoes=100,
        max_sem_melhoria=20
    )
    
    resultado_tabu = tabu.otimizar(verbose=verbose)
    
    # 4. Montar resultado final
    return {
        'success': True,
        'rota_inicial': {
            'pedidos': resultado_nn['pedidos_rota'],
            'distancia': resultado_nn['distancia_total'],
            'peso_total': resultado_nn['peso_total'],
            'algoritmo': 'nearest_neighbor'
        },
        'rota_otimizada': {
            'pedidos': resultado_tabu['rota_otimizada'],
            'distancia': resultado_tabu['distancia_final'],
            'peso_total': resultado_nn['peso_total'],  # Peso não muda
            'algoritmo': 'tabu_search'
        },
        'melhoria': {
            'distancia_reduzida': resultado_tabu['distancia_inicial'] - resultado_tabu['distancia_final'],
            'percentual': resultado_tabu['melhoria_percentual'],
            'iteracoes': resultado_tabu['iteracoes']
        },
        'pedidos_nao_atendidos': resultado_nn['pedidos_nao_atendidos'],
        'historico_otimizacao': resultado_tabu['historico']
    }