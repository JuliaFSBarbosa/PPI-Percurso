
import random

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from logistics.models import Familia, Pedido, Produto, RestricaoFamilia
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


class PedidoRestricoesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.familia_agro = Familia.objects.create(nome="Agrotóxicos", ativo=True)
        self.familia_outros = Familia.objects.create(nome="Agropecuária", ativo=True)
        RestricaoFamilia.objects.create(
            familia_origem=self.familia_agro,
            familia_restrita=self.familia_outros,
        )
        self.produto_agro = Produto.objects.create(
            nome="Defensivo",
            peso=1,
            volume=1,
            familia=self.familia_agro,
            ativo=True,
        )
        self.produto_outros = Produto.objects.create(
            nome="Ração",
            peso=1,
            volume=1,
            familia=self.familia_outros,
            ativo=True,
        )
        self.pedidos_url = reverse("pedido-admin-list")
        self.dividir_url = reverse("pedido-admin-dividir")

    def _payload(self):
        return {
            "nf": 777,
            "cliente": "Fazenda Modelo",
            "cidade": "Tenente Portela",
            "dtpedido": "2024-05-01",
            "observacao": "",
            "latitude": -27.0,
            "longitude": -53.0,
            "itens": [
                {"produto_id": self.produto_agro.id, "quantidade": 3},
                {"produto_id": self.produto_outros.id, "quantidade": 2},
            ],
        }

    def test_pedido_com_familias_incompativeis_retorna_erro_amigavel(self):
        resp = self.client.post(self.pedidos_url, data=self._payload(), format="json")
        self.assertEqual(resp.status_code, 400)
        body = resp.json()
        self.assertEqual(body.get("code"), "familias_incompativeis")
        self.assertTrue(body.get("pode_dividir"))
        self.assertTrue(body.get("grupos"))

    def test_dividir_pedido_cria_pedidos_distintos_com_mesma_nf(self):
        resp = self.client.post(self.dividir_url, data=self._payload(), format="json")
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertTrue(body.get("dividido"))
        self.assertEqual(body.get("nf"), 777)
        self.assertEqual(Pedido.objects.filter(nf=777).count(), 2)
