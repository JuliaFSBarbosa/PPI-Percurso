"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Corrige os ícones do Leaflet no Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface RouteMapViewerProps {
  pontos: {
    latitude: number;
    longitude: number;
    label?: string;
  }[];
}

export default function RouteMapViewer({ pontos }: RouteMapViewerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (pontos.length === 0) return;

    // inicializa o mapa
    const map = L.map(mapRef.current).setView(
      [pontos[0].latitude, pontos[0].longitude],
      13
    );

    // camada de tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    // adiciona marcadores
    pontos.forEach((ponto) => {
      L.marker([ponto.latitude, ponto.longitude])
        .addTo(map)
        .bindPopup(ponto.label || "Ponto")
        .openPopup();
    });

    // desenha polilinha ligando os pontos
    const polyline = L.polyline(
      pontos.map((p) => [p.latitude, p.longitude]) as [number, number][],
      { color: "blue" }
    ).addTo(map);

    map.fitBounds(polyline.getBounds());

    return () => {
      map.remove();
    };
  }, [pontos]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "450px",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    />
  );
}
