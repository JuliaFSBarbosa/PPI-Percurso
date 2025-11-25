import { auth } from "@/lib/auth";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const upstreamUrl = `${apiBase}/api/v1/logistics/otimizar-rota-genetico/`;

const buildHeaders = async () => {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const hdr: Record<string, string> = {};
  if (token) hdr["Authorization"] = `Bearer ${token}`;
  hdr["Content-Type"] = "application/json";
  return hdr;
};

export async function POST(req: Request) {
  const hdr = await buildHeaders();
  const body = await req.text();
  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers: hdr,
    body,
    cache: "no-store",
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
