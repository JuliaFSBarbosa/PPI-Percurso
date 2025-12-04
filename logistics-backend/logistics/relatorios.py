import base64
import io
import logging
import os
import urllib.parse
import urllib.request
from decimal import Decimal
from typing import List, Optional, Tuple

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.graphics.shapes import Circle, Drawing, Line, Rect, String

from .ia.genetic_algorithm import calcular_distancia
from .constants import DEFAULT_DEPOSITO
from .models import Pedido, Rota

logger = logging.getLogger(__name__)


def _peso_pedido(pedido: Pedido) -> float:
    # Calcula peso total de um pedido a partir dos itens.
    total = Decimal("0")
    for item in pedido.itens.select_related("produto").all():
        total += item.produto.peso * item.quantidade
    return float(total)


def _coordenadas_da_rota(rota: Rota, deposito_coords: Optional[dict]) -> List[dict]:
    # Monta a sequencia de coordenadas da rota usando a ordem de entrega.
    coords: List[dict] = []

    if deposito_coords:
        coords.append(
            {
                "latitude": float(deposito_coords["latitude"]),
                "longitude": float(deposito_coords["longitude"]),
                "tipo": "deposito",
                "ordem": 0,
            }
        )

    for ordem, rota_pedido in enumerate(rota.pedidos.select_related("pedido").order_by("ordem_entrega"), 1):
        pedido = rota_pedido.pedido
        coords.append(
            {
                "latitude": float(pedido.latitude),
                "longitude": float(pedido.longitude),
                "pedido_id": pedido.id,
                "tipo": "entrega",
                "ordem": ordem,
            }
        )

    if deposito_coords:
        coords.append(
            {
                "latitude": float(deposito_coords["latitude"]),
                "longitude": float(deposito_coords["longitude"]),
                "tipo": "deposito",
                "ordem": len(coords),
            }
        )

    return coords


def _mapa_como_drawing(coords: List[dict], largura: float = 500, altura: float = 320) -> Optional[Drawing]:
    # Desenha um mapa simplificado da rota sem depender de tiles externos.
    if not coords or len(coords) < 2:
        return None

    lats = [c["latitude"] for c in coords]
    lons = [c["longitude"] for c in coords]

    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)

    # Evita divisao por zero quando todos os pontos sao iguais.
    lat_span = max(max_lat - min_lat, 1e-6)
    lon_span = max(max_lon - min_lon, 1e-6)

    margin = 30
    map_w = largura - 2 * margin
    map_h = altura - 2 * margin

    def _transform(lat: float, lon: float) -> Tuple[float, float]:
        x = margin + ((lon - min_lon) / lon_span) * map_w
        y = margin + ((lat - min_lat) / lat_span) * map_h
        return x, y

    drawing = Drawing(largura, altura)
    drawing.add(Rect(0, 0, largura, altura, strokeColor=colors.lightgrey, fillColor=colors.whitesmoke))

    # Desenha linhas conectando os pontos na ordem.
    for idx in range(len(coords) - 1):
        x1, y1 = _transform(coords[idx]["latitude"], coords[idx]["longitude"])
        x2, y2 = _transform(coords[idx + 1]["latitude"], coords[idx + 1]["longitude"])
        drawing.add(Line(x1, y1, x2, y2, strokeColor=colors.darkblue, strokeWidth=2))

    for ponto in coords:
        x, y = _transform(ponto["latitude"], ponto["longitude"])
        cor = colors.green if ponto["tipo"] == "deposito" else colors.red
        drawing.add(Circle(x, y, 5, fillColor=cor, strokeColor=colors.black))
        drawing.add(String(x + 6, y + 2, str(ponto.get("ordem", "")), fontSize=8, fillColor=colors.black))

    drawing.add(
        String(
            margin,
            altura - margin + 10,
            "Mapa simplificado (sem base cartografica)",
            fontSize=9,
            fillColor=colors.grey,
        )
    )
    return drawing


def _map_flowable(coords: List[dict], map_image_base64: Optional[str]) -> Optional[object]:
    # Retorna um flowable (Image ou Drawing) para o mapa.
    if map_image_base64:
        try:
            img_bytes = base64.b64decode(map_image_base64)
            return Image(io.BytesIO(img_bytes), width=500, height=320)
        except Exception:
            logger.warning("Falha ao decodificar imagem base64 do mapa; usando mapa gerado pelo servidor.")

    # 1) Mapbox (quando houver token)
    mapa_bytes = _tentar_mapa_estatico(coords)
    if mapa_bytes:
        return Image(io.BytesIO(mapa_bytes), width=500, height=320)

    # 2) Servico estatico OSM como fallback cartografico publico
    mapa_osm = _tentar_mapa_osm(coords)
    if mapa_osm:
        return Image(io.BytesIO(mapa_osm), width=500, height=320)

    # 3) Ultimo recurso: mapa simplificado desenhado
    return _mapa_como_drawing(coords)


def _calcular_distancia_da_rota(coords: List[dict]) -> Optional[float]:
    if not coords or len(coords) < 2:
        return None

    distancia = 0.0
    for i in range(len(coords) - 1):
        atual = coords[i]
        prox = coords[i + 1]
        distancia += calcular_distancia((atual["latitude"], atual["longitude"]), (prox["latitude"], prox["longitude"]))
    return round(distancia, 2)


def _mapbox_url(coords: List[dict], token: str) -> Optional[str]:
    # Monta uma URL de mapa estatico do Mapbox com path da rota e marcadores.
    if not coords or len(coords) < 2:
        return None

    # path-4+color-opa(city)+strokeWidth
    path_coords = ";".join([f"{c['longitude']},{c['latitude']}" for c in coords])
    path = f"path-4+ff2d55-0.8({path_coords})"

    # Marcadores inicio/fim
    overlays = [path]
    inicio = coords[0]
    fim = coords[-1]
    overlays.append(f"pin-s-a+00aa00({inicio['longitude']},{inicio['latitude']})")
    overlays.append(f"pin-s-b+ff0000({fim['longitude']},{fim['latitude']})")

    overlay_str = ",".join(overlays)
    overlay_encoded = urllib.parse.quote(overlay_str, safe=":/,()@+;=-")

    return (
        f"https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/"
        f"{overlay_encoded}/auto/800x500@2x?access_token={token}"
    )


def _baixar(url: str, timeout: int = 8) -> Optional[bytes]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.read()
    except Exception:
        return None


def _tentar_mapa_estatico(coords: List[dict]) -> Optional[bytes]:
    # Busca mapa estatico realista (Mapbox) se houver token configurado.
    token = getattr(settings, "MAPBOX_TOKEN", None) or os.getenv("MAPBOX_TOKEN")
    if not token:
        return None

    url = _mapbox_url(coords, token)
    if not url:
        return None

    img = _baixar(url)
    if not img:
        logger.warning("Nao foi possivel baixar mapa estatico do Mapbox.")
    return img


def _tentar_mapa_osm(coords: List[dict]) -> Optional[bytes]:
    # Fallback usando servico estatico do OpenStreetMap (gratuito, sem token).
    if not coords or len(coords) < 2:
        return None

    try:
        # Calcula centro aproximado para enquadrar
        lat_med = sum(c["latitude"] for c in coords) / len(coords)
        lon_med = sum(c["longitude"] for c in coords) / len(coords)
        size = "800x500"

        # Path color azul
        path_partes = [f"{c['latitude']},{c['longitude']}" for c in coords]
        path = "color:0x0033cc|weight:4|" + "|".join(path_partes)

        # Marcadores primeiro/ultimo
        inicio = coords[0]
        fim = coords[-1]
        markers = [
            f"{inicio['latitude']},{inicio['longitude']},lightgreen1",
            f"{fim['latitude']},{fim['longitude']},red",
        ]
        markers_param = "|".join(markers)

        params = urllib.parse.urlencode(
            {
                "center": f"{lat_med},{lon_med}",
                "zoom": 8,
                "size": size,
                "maptype": "mapnik",
                "markers": markers_param,
                "path": path,
            }
        )
        url = f"https://staticmap.openstreetmap.de/staticmap.php?{params}"
        return _baixar(url)
    except Exception:
        return None


def _google_maps_link(coords: List[dict]) -> Optional[str]:
    # Monta um link do Google Maps Directions com origem/destino/waypoints.
    if not coords or len(coords) < 2:
        return None
    origin = f"{coords[0]['latitude']},{coords[0]['longitude']}"
    destination = f"{coords[-1]['latitude']},{coords[-1]['longitude']}"
    waypoints_list = coords[1:-1]
    waypoints = "|".join(f"{c['latitude']},{c['longitude']}" for c in waypoints_list) if waypoints_list else ""

    params = {
        "api": "1",
        "travelmode": "driving",
        "origin": origin,
        "destination": destination,
    }
    if waypoints:
        params["waypoints"] = waypoints

    return f"https://www.google.com/maps/dir/?{urllib.parse.urlencode(params)}"


def gerar_relatorio_rota_pdf(
    rota: Rota,
    distancia_total_km: Optional[float] = None,
    deposito_coords: Optional[dict] = None,
    rota_coordenadas: Optional[List[dict]] = None,
    map_image_base64: Optional[str] = None,
) -> bytes:
    # Gera o PDF da rota com resumo, tabela de pedidos, peso e mapa.
    if distancia_total_km is not None:
        try:
            distancia_total_km = round(float(distancia_total_km), 2)
        except (TypeError, ValueError):
            raise ValueError("distancia_total_km precisa ser numerico")

    if deposito_coords is None:
        deposito_coords = DEFAULT_DEPOSITO

    coords_para_mapa = rota_coordenadas if rota_coordenadas else _coordenadas_da_rota(rota, deposito_coords)

    # Ordena pela chave "ordem" para garantir que o primeiro ponto seja o de partida.
    if coords_para_mapa:
        coords_para_mapa = sorted(coords_para_mapa, key=lambda c: c.get("ordem", 0))

    # Garante que o ponto de partida/retorno (deposito) esteja presente para o link do mapa.
    if deposito_coords:
        deposito_ponto = {
            "latitude": float(deposito_coords["latitude"]),
            "longitude": float(deposito_coords["longitude"]),
            "tipo": "deposito",
            "ordem": 0,
        }
        if not coords_para_mapa or coords_para_mapa[0].get("tipo") != "deposito":
            coords_para_mapa = [deposito_ponto] + coords_para_mapa
        if not coords_para_mapa[-1].get("tipo") == "deposito":
            coords_para_mapa = coords_para_mapa + [{**deposito_ponto, "ordem": len(coords_para_mapa)}]
    else:
        # Sem deposito informado: usa um ponto marcado como deposito, ou cria um "pseudo deposito"
        # duplicando o primeiro ponto para garantir origem/destino no link.
        depositos = [c for c in coords_para_mapa if c.get("tipo") == "deposito"]
        if depositos:
            dep = depositos[0]
        elif coords_para_mapa:
            primeiro = coords_para_mapa[0]
            dep = {
                "latitude": float(primeiro["latitude"]),
                "longitude": float(primeiro["longitude"]),
                "tipo": "deposito",
                "ordem": 0,
            }
        else:
            dep = None

        if dep:
            entregas = [c for c in coords_para_mapa if c is not dep and c.get("tipo") != "deposito"]
            coords_para_mapa = [dep] + entregas
            if not coords_para_mapa[-1].get("tipo") == "deposito":
                coords_para_mapa.append({**dep, "ordem": len(coords_para_mapa)})

    if distancia_total_km is None:
        distancia_total_km = _calcular_distancia_da_rota(coords_para_mapa)

    pedidos_info = []
    for rota_pedido in rota.pedidos.select_related("pedido").order_by("ordem_entrega"):
        pedido = rota_pedido.pedido
        peso = _peso_pedido(pedido)
        pedidos_info.append(
            {
                "ordem": rota_pedido.ordem_entrega,
                "id": pedido.id,
                "nf": pedido.nf,
                "cliente": pedido.cliente or "",
                "cidade": pedido.cidade or "",
                "lat": float(pedido.latitude),
                "lon": float(pedido.longitude),
                "peso": round(peso, 3),
            }
        )

    peso_total = sum(p["peso"] for p in pedidos_info)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="SectionTitle", fontSize=14, leading=16, spaceAfter=10, textColor=colors.HexColor("#0a2540")))
    styles.add(ParagraphStyle(name="Small", fontSize=9, leading=11, textColor=colors.grey))

    story: List[object] = []
    story.append(Paragraph("Relatorio da Rota Otimizada", styles["Title"]))
    story.append(Paragraph(f"Rota #{rota.id} | Status: {rota.status}", styles["Small"]))
    story.append(Spacer(1, 12))

    resumo_data = [
        ["Data da rota", rota.data_rota.strftime("%d/%m/%Y")],
        ["Total de entregas", str(len(pedidos_info))],
        ["Distancia total (km)", f"{distancia_total_km:.2f}" if distancia_total_km is not None else "N/D"],
        ["Peso total (kg)", f"{peso_total:.3f}"],
        ["Capacidade maxima (kg)", f"{float(rota.capacidade_max):.3f}"],
    ]
    resumo_table = Table(resumo_data, colWidths=[140, 360])
    resumo_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f4ff")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0a2540")),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(Paragraph("Resumo", styles["SectionTitle"]))
    story.append(resumo_table)
    story.append(Spacer(1, 16))

    story.append(Paragraph("Link da Rota", styles["SectionTitle"]))
    maps_link = _google_maps_link(coords_para_mapa)
    if maps_link:
        story.append(Paragraph(f'<link href="{maps_link}">Abrir no Google Maps</link>', styles["Normal"]))
    else:
        story.append(Paragraph("Link da rota indisponivel (faltam coordenadas).", styles["Normal"]))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Pedidos e Entregas", styles["SectionTitle"]))
    pedidos_data = [["Ordem", "Pedido", "NF", "Cliente", "Cidade", "Latitude", "Longitude", "Peso (kg)"]]
    for info in pedidos_info:
        pedidos_data.append(
            [
                info["ordem"],
                info["id"],
                info["nf"],
                info["cliente"],
                info["cidade"],
                f'{info["lat"]:.6f}',
                f'{info["lon"]:.6f}',
                f'{info["peso"]:.3f}',
            ]
        )

    pedidos_table = Table(pedidos_data, repeatRows=1)
    pedidos_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0a2540")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ]
        )
    )
    story.append(pedidos_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
