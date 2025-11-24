"use client";

import { useEffect, useRef, useState } from "react";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type Props = {
  initialCoords?: Coordinates;
  onLocationSelect: (coords: Coordinates) => void;
  disabled?: boolean;
};

const roundCoord = (value: number) => Number(value.toFixed(6)); // evita excessos de casas decimais

/**
 * Componente de seleção de localização no mapa
 * Usa Leaflet (OpenStreetMap) - gratuito e sem necessidade de API key
 */
export function MapLocationPicker({ initialCoords, onLocationSelect, disabled = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [coords, setCoords] = useState<Coordinates>(
    initialCoords || { latitude: -27.5969, longitude: -53.5495 } // Centro de Frederico Westphalen
  );

  useEffect(() => {
    // Carrega Leaflet dinamicamente (client-side only)
    const loadMap = async () => {
      if (typeof window === "undefined") return;

      // Carrega CSS do Leaflet
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      // Carrega JS do Leaflet
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      
      script.onload = () => {
        initMap();
      };

      document.body.appendChild(script);
    };

    const initMap = () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = (window as any).L;

      // garante que o ícone do marcador use caminhos absolutos (evita 404)
      const DefaultIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;

      // Cria o mapa
      const map = L.map(mapRef.current).setView([coords.latitude, coords.longitude], 13);

      // Adiciona tiles do OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Adiciona marcador inicial
      const marker = L.marker([coords.latitude, coords.longitude], {
        draggable: !disabled,
      }).addTo(map);

      // Atualiza coordenadas quando o marcador é movido
      marker.on("dragend", function (e: any) {
        const position = e.target.getLatLng();
        const newCoords = {
          latitude: roundCoord(position.lat),
          longitude: roundCoord(position.lng),
        };
        setCoords(newCoords);
        onLocationSelect(newCoords);
      });

      // Adiciona marcador ao clicar no mapa
      map.on("click", function (e: any) {
        if (disabled) return;
        
        const newCoords = {
          latitude: roundCoord(e.latlng.lat),
          longitude: roundCoord(e.latlng.lng),
        };
        
        marker.setLatLng([newCoords.latitude, newCoords.longitude]);
        setCoords(newCoords);
        onLocationSelect(newCoords);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      setIsLoading(false);
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Atualiza marcador quando coordenadas externas mudam
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([coords.latitude, coords.longitude]);
      mapInstanceRef.current.setView([coords.latitude, coords.longitude], 13);
    }
  }, [coords.latitude, coords.longitude]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocalização não é suportada pelo seu navegador.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          latitude: roundCoord(position.coords.latitude),
          longitude: roundCoord(position.coords.longitude),
        };
        setCoords(newCoords);
        onLocationSelect(newCoords);
      },
      (error) => {
        alert("Não foi possível obter sua localização: " + error.message);
      }
    );
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "400px" }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f0f0f0",
            zIndex: 1000,
          }}
        >
          Carregando mapa...
        </div>
      )}
      
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={disabled}
          style={{
            padding: "8px 12px",
            background: "linear-gradient(135deg, #0f3a2b, #145a43)",
            color: "white",
            border: "1px solid rgba(20,90,67,.55)",
            borderRadius: "8px",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: "12px",
            fontWeight: 600,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          📍 Minha localização
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          right: "10px",
          zIndex: 1000,
          background: "rgba(15, 43, 33, 0.95)",
          padding: "12px",
          borderRadius: "8px",
          color: "white",
          fontSize: "12px",
        }}
      >
        <strong>Coordenadas selecionadas:</strong>
        <br />
        Latitude: {coords.latitude.toFixed(6)} | Longitude: {coords.longitude.toFixed(6)}
        <br />
        <small style={{ color: "rgba(255,255,255,0.7)" }}>
          {disabled ? "Visualização" : "Clique no mapa ou arraste o marcador para selecionar a localização"}
        </small>
      </div>
    </div>
  );
}
