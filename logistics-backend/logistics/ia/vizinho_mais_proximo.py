# logistics/ia/nearest_neighbor.py

#Algoritmo Construtivo: Vizinho Mais Próximo (Nearest Neighbor)
#Constrói uma rota inicial visitando sempre o pedido não visitado mais próximo


import math
from typing import List, Dict, Tuple, Optional


class NearestNeighbor:
    
    def __init__(self, pedidos: List[Dict], capacidade_veiculo: float, deposito: Tuple[float, float]):
        """
        Args:
            pedidos: Lista de dicionários com dados dos pedidos
                    Cada pedido deve ter: id, latitude, longitude, peso_total
            capacidade_veiculo: Capacidade máxima do veículo em kg
            deposito: Tupla (latitude, longitude) do depósito/ponto inicial
        """
        self.pedidos = pedidos
        self.capacidade_veiculo = capacidade_veiculo
        self.deposito = deposito
        
    def calcular_distancia(self, coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
        """
        Calcula distância euclidiana entre dois pontos geográficos usando Haversine
        
        Args:
            coord1: (latitude, longitude) do ponto 1
            coord2: (latitude, longitude) do ponto 2
            
        Returns:
            Distância em quilômetros
        """
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        
        # Converter para radianos
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Fórmula de Haversine
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = (math.sin(dlat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2)
        c = 2 * math.asin(math.sqrt(a))
        
        # Raio da Terra em km
        raio_terra = 6371
        
        return raio_terra * c
    
    def encontrar_pedido_mais_proximo(
        self, 
        posicao_atual: Tuple[float, float],
        pedidos_disponiveis: List[Dict],
        peso_atual: float
    ) -> Optional[Dict]:
        """
        Encontra o pedido não visitado mais próximo que cabe no veículo
        
        Args:
            posicao_atual: (latitude, longitude) atual
            pedidos_disponiveis: Lista de pedidos ainda não visitados
            peso_atual: Peso já carregado no veículo
            
        Returns:
            Pedido mais próximo ou None se nenhum couber
        """
        melhor_pedido = None
        menor_distancia = float('inf')
        
        for pedido in pedidos_disponiveis:
            # Verificar se o pedido cabe no veículo
            if peso_atual + pedido['peso_total'] <= self.capacidade_veiculo:
                # Calcular distância
                coord_pedido = (pedido['latitude'], pedido['longitude'])
                distancia = self.calcular_distancia(posicao_atual, coord_pedido)
                
                # Atualizar se for o mais próximo
                if distancia < menor_distancia:
                    menor_distancia = distancia
                    melhor_pedido = pedido
        
        return melhor_pedido
    
    def construir_rota(self, inicio_no_deposito: bool = True) -> Dict:
        """
        Constrói uma rota usando o algoritmo do Vizinho Mais Próximo
        
        Args:
            inicio_no_deposito: Se True, inicia a rota no depósito
            
        Returns:
            Dicionário com a rota construída:
            {
                'pedidos_rota': [lista de IDs dos pedidos na ordem],
                'distancia_total': distância total em km,
                'peso_total': peso total carregado,
                'pedidos_nao_atendidos': [pedidos que não couberam]
            }
        """
        # Copiar lista de pedidos disponíveis
        pedidos_disponiveis = self.pedidos.copy()
        
        # Inicializar rota
        rota = []
        peso_acumulado = 0
        distancia_total = 0
        
        # Posição inicial
        if inicio_no_deposito:
            posicao_atual = self.deposito
        else:
            # Se não começar no depósito, pegar o primeiro pedido mais próximo
            primeiro_pedido = self.encontrar_pedido_mais_proximo(
                self.deposito, 
                pedidos_disponiveis,
                0
            )
            if not primeiro_pedido:
                return {
                    'pedidos_rota': [],
                    'distancia_total': 0,
                    'peso_total': 0,
                    'pedidos_nao_atendidos': pedidos_disponiveis
                }
            
            rota.append(primeiro_pedido['id'])
            peso_acumulado += primeiro_pedido['peso_total']
            posicao_atual = (primeiro_pedido['latitude'], primeiro_pedido['longitude'])
            distancia_total += self.calcular_distancia(self.deposito, posicao_atual)
            pedidos_disponiveis.remove(primeiro_pedido)
        
        # Construir rota visitando sempre o mais próximo
        while pedidos_disponiveis:
            proximo_pedido = self.encontrar_pedido_mais_proximo(
                posicao_atual,
                pedidos_disponiveis,
                peso_acumulado
            )
            
            # Se não encontrou pedido que caiba, parar
            if not proximo_pedido:
                break
            
            # Adicionar pedido à rota
            coord_proximo = (proximo_pedido['latitude'], proximo_pedido['longitude'])
            distancia = self.calcular_distancia(posicao_atual, coord_proximo)
            
            rota.append(proximo_pedido['id'])
            peso_acumulado += proximo_pedido['peso_total']
            distancia_total += distancia
            posicao_atual = coord_proximo
            pedidos_disponiveis.remove(proximo_pedido)
        
        # Voltar ao depósito
        if rota:
            distancia_total += self.calcular_distancia(posicao_atual, self.deposito)
        
        return {
            'pedidos_rota': rota,
            'distancia_total': round(distancia_total, 2),
            'peso_total': round(peso_acumulado, 2),
            'pedidos_nao_atendidos': [p['id'] for p in pedidos_disponiveis]
        }
    
    def construir_multiplas_rotas(self) -> List[Dict]:
        """
        Constrói múltiplas rotas quando os pedidos não cabem em uma única rota
        
        Returns:
            Lista de rotas construídas
        """
        pedidos_restantes = self.pedidos.copy()
        rotas = []
        
        while pedidos_restantes:
            # Criar nova instância para esta rota
            nn = NearestNeighbor(
                pedidos_restantes,
                self.capacidade_veiculo,
                self.deposito
            )
            
            # Construir rota
            resultado = nn.construir_rota()
            
            # Se não conseguiu colocar nenhum pedido, parar
            if not resultado['pedidos_rota']:
                # Adicionar pedidos não atendidos como problemas
                for pedido_id in resultado['pedidos_nao_atendidos']:
                    rotas.append({
                        'pedidos_rota': [pedido_id],
                        'distancia_total': 0,
                        'peso_total': next(p['peso_total'] for p in pedidos_restantes if p['id'] == pedido_id),
                        'status': 'EXCEDE_CAPACIDADE',
                        'erro': 'Pedido excede capacidade do veículo'
                    })
                break
            
            # Adicionar rota válida
            rotas.append(resultado)
            
            # Remover pedidos já atendidos
            ids_atendidos = set(resultado['pedidos_rota'])
            pedidos_restantes = [p for p in pedidos_restantes if p['id'] not in ids_atendidos]
        
        return rotas


# =====================================================================
# FUNÇÕES AUXILIARES PARA INTEGRAÇÃO COM DJANGO
# =====================================================================

def preparar_pedidos_para_ia(pedidos_queryset) -> List[Dict]:
    """
    Converte queryset do Django para formato usado pela IA
    
    Args:
        pedidos_queryset: QuerySet de Pedido do Django
        
    Returns:
        Lista de dicionários com dados formatados
    """
    pedidos_formatados = []
    
    for pedido in pedidos_queryset:
        # Calcular peso total dos itens
        peso_total = sum(
            item.produto.peso * item.quantidade 
            for item in pedido.itens.all()
        )
        
        pedidos_formatados.append({
            'id': pedido.id,
            'latitude': float(pedido.latitude),
            'longitude': float(pedido.longitude),
            'peso_total': float(peso_total),
            'nf': pedido.nf,
            'observacao': pedido.observacao or ''
        })
    
    return pedidos_formatados


def executar_nearest_neighbor(
    pedidos_queryset,
    capacidade_veiculo: float,
    deposito_lat: float,
    deposito_lon: float
) -> Dict:
    """
    Executa o algoritmo do Vizinho Mais Próximo
    
    Args:
        pedidos_queryset: QuerySet de Pedido do Django
        capacidade_veiculo: Capacidade em kg
        deposito_lat: Latitude do depósito
        deposito_lon: Longitude do depósito
        
    Returns:
        Dicionário com resultado da otimização
    """
    # Preparar dados
    pedidos = preparar_pedidos_para_ia(pedidos_queryset)
    deposito = (deposito_lat, deposito_lon)
    
    # Executar algoritmo
    nn = NearestNeighbor(pedidos, capacidade_veiculo, deposito)
    
    # Se houver poucos pedidos, uma rota é suficiente
    if len(pedidos) <= 10:
        resultado = nn.construir_rota()
        return {
            'success': True,
            'rotas': [resultado],
            'total_rotas': 1,
            'algoritmo': 'nearest_neighbor'
        }
    else:
        # Múltiplas rotas
        rotas = nn.construir_multiplas_rotas()
        return {
            'success': True,
            'rotas': rotas,
            'total_rotas': len(rotas),
            'algoritmo': 'nearest_neighbor'
        }