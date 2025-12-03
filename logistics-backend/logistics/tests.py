import random

from django.test import TestCase

from logistics.ia.genetic_algorithm import algoritmo_genetico, otimizar_rota_pedidos


class GeneticAlgorithmTests(TestCase):
    def test_algoritmo_genetico_retorna_rota_completa(self):
        random.seed(42)
        pedidos = [
            (-23.5505, -46.6333),  # SP
            (-22.9068, -43.1729),  # RJ
            (-25.4284, -49.2733),  # Curitiba
        ]
        deposito = (-23.6815, -46.8755)  # proximo a SP

        resultado = algoritmo_genetico(
            pedidos_coords=pedidos,
            deposito_coords=deposito,
            tamanho_pop=20,
            num_geracoes=50,
            taxa_crossover=0.8,
            taxa_mutacao=0.2,
            elitismo=2,
        )

        self.assertEqual(set(resultado["rota_otimizada"]), {0, 1, 2})
        self.assertGreater(resultado["distancia_total_km"], 0)
        self.assertGreaterEqual(resultado["num_geracoes"], 1)

    def test_parametros_sao_normalizados(self):
        pedidos = [
            {"id": 1, "latitude": -23.55, "longitude": -46.63},
            {"id": 2, "latitude": -22.9, "longitude": -43.17},
        ]
        deposito = {"latitude": -23.68, "longitude": -46.87}

        parametros = {
            "tamanho_pop": 10000,
            "num_geracoes": 5000,
            "taxa_crossover": 2,
            "taxa_mutacao": -1,
            "elitismo": 9999,
        }

        resultado = otimizar_rota_pedidos(pedidos, deposito, parametros)
        usados = resultado["parametros_utilizados"]

        self.assertLessEqual(usados["tamanho_pop"], 500)
        self.assertLessEqual(usados["num_geracoes"], 1000)
        self.assertGreaterEqual(usados["taxa_crossover"], 0)
        self.assertGreaterEqual(usados["taxa_mutacao"], 0)
        self.assertLessEqual(usados["elitismo"], usados["tamanho_pop"])
