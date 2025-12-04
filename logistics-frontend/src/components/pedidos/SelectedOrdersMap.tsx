"use client";

import { useEffect, useRef } from "react";
import styles from "@/app/inicio/styles.module.css";

type PedidoMapa = {
  id: number;
  cliente?: string;
  nf?: number;
  cidade?: string;
  latitude?: number;
  longitude?: number;
  peso_total?: number;
  volume_total?: number;
};

type Props = {
  pedidos: PedidoMapa[];
};

const ensureLeaflet = async () => {
  if (typeof window === "undefined") return null;

  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

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

export function SelectedOrdersMap({ pedidos }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const points = pedidos
      .map((p) => {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { ...p, latitude: lat, longitude: lng };
      })
      .filter(Boolean) as Required<PedidoMapa>[];

    if (points.length === 0) {
      mapRef.current.innerHTML = "Selecione pedidos na tabela para visualizar no mapa.";
      return;
    }

    let map: any;

    const init = async () => {
      const L = await ensureLeaflet();
      if (!L || !mapRef.current) return;

      if (L.Icon && L.Icon.Default) {
        const proto = (L.Icon.Default.prototype as any) || {};
        delete proto._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
      }

      map = L.map(mapRef.current).setView([points[0].latitude, points[0].longitude], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const bounds: [number, number][] = [];

      points.forEach((p) => {
        bounds.push([p.latitude!, p.longitude!]);
        const popup = `
          <div style="font-size: 13px; line-height: 1.4">
            <strong>Pedido #${p.id}</strong><br/>
            Cliente: ${p.cliente ?? "-"}<br/>
            Cidade: ${p.cidade ?? "-"}<br/>
            NF: ${p.nf ?? "-"}<br/>
            Peso total: ${p.peso_total ?? "-"}<br/>
            Volume total: ${p.volume_total ?? "-"}
          </div>
        `;
        L.marker([p.latitude!, p.longitude!]).addTo(map).bindPopup(popup);
      });

      if (bounds.length > 1) {
        map.fitBounds(bounds as any, { padding: [20, 20] });
      }
    };

    init();

    return () => {
      if (map) map.remove();
    };
  }, [pedidos]);

  return (
    <section className={`${styles.card} ${styles.map} ${styles.ordersPanel}`}>
      <div className={styles["card-head"]}>
        <h3>Mapa dos selecionados</h3>
        <span className={styles.muted}>
          {pedidos.length > 0 ? `${pedidos.length} pedido(s)` : "Nenhum selecionado"}
        </span>
      </div>
      <div
        ref={mapRef}
        style={{
          width: "100%",
          flex: 1,
          minHeight: "320px",
          borderRadius: "12px",
          overflow: "hidden",
          background: "var(--panel)",
          color: "var(--muted)",
          display: "grid",
          placeItems: "center",
          padding: "12px",
        }}
      />
    </section>
  );
}
