"use client";

import { useEffect, useRef } from "react";

type RouteMapViewerProps = {
  pontos: {
    latitude: number;
    longitude: number;
    label?: string;
  }[];
};

/**
 * Visualizador de rota usando Leaflet via CDN (sem depender do pacote local).
 * Inclui invalidateSize para funcionar em contêiner oculto e evitar corte em screenshots.
 */
export default function RouteMapViewer({ pontos }: RouteMapViewerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!Array.isArray(pontos) || pontos.length === 0) return;

    const ensureLeaflet = async () => {
      if (typeof window === "undefined") return null;

      // CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // JS
      if ((window as any).L) return (window as any).L;

      await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
        if (existing && existing.dataset.loaded === "true" && (window as any).L) {
          resolve();
          return;
        }
        const script = existing || document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.defer = true;
        script.onload = () => {
          script.dataset.loaded = "true";
          resolve();
        };
        script.onerror = () => reject(new Error("Falha ao carregar Leaflet"));
        if (!existing) document.body.appendChild(script);
      });

      return (window as any).L;
    };

    let map: any;

    const init = async () => {
      const L = await ensureLeaflet();
      if (!L || !mapRef.current) return;

      // Corrige ícones
      if (L.Icon && L.Icon.Default) {
        const proto = (L.Icon.Default.prototype as any) || {};
        delete proto._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
      }

      map = L.map(mapRef.current, {
        preferCanvas: true,
        zoomControl: false,
      }).setView([pontos[0].latitude, pontos[0].longitude], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      pontos.forEach((p: any) => {
        L.marker([p.latitude, p.longitude]).addTo(map).bindPopup(p.label || "Ponto");
      });

      const renderer = L.canvas({ padding: 0.5 });
      const polyline = L.polyline(
        pontos.map((p) => [p.latitude, p.longitude]) as [number, number][],
        { color: "blue", weight: 4, renderer }
      ).addTo(map);

      map.fitBounds(polyline.getBounds(), { padding: [16, 16] });

      // Reajusta dimensão quando renderizado off-screen (evita corte em screenshots)
      setTimeout(() => {
        try {
          map.invalidateSize();
          map.fitBounds(polyline.getBounds(), { padding: [16, 16] });
        } catch (err) {
          console.warn("Falha ao ajustar mapa", err);
        }
      }, 300);
    };

    init();

    return () => {
      if (map) map.remove();
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
