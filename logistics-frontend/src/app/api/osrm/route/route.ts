import { NextResponse } from "next/server";

const baseRaw = process.env.NEXT_PUBLIC_OSRM_URL || "http://localhost:5000";
const osrmBase = baseRaw.replace(/\/+$/, "");

type Coords = { latitude: number; longitude: number };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const coords: Coords[] = Array.isArray(body?.coords) ? body.coords : [];
    if (!coords || coords.length < 2) {
      return NextResponse.json(
        { error: "Envie pelo menos 2 coordenadas para o calculo da rota." },
        { status: 400 }
      );
    }

    const coordsStr = coords.map((c) => `${c.longitude},${c.latitude}`).join(";");
    const url = `${osrmBase}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
    const upstream = await fetch(url, { method: "GET", cache: "no-store" });
    const data = await upstream.json();

    if (!upstream.ok || !data?.routes || !data.routes[0]?.geometry) {
      return NextResponse.json(
        { error: "Falha ao obter rota no OSRM.", detalhes: data || null },
        { status: upstream.status || 502 }
      );
    }

    const route = data.routes[0];
    return NextResponse.json({
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
      raw: route,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erro ao calcular rota no OSRM.", detalhes: err?.message || String(err) },
      { status: 500 }
    );
  }
}
