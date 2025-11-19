// Proxy para listar/criar usuários administrativos, reaproveitando o token do NextAuth.
import { auth } from "@/lib/auth";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const basePath = `${apiBase}/api/v1/accounts/users/`;

// Monta headers com Authorization (quando há sessão) e Content-Type herdado da requisição.
const buildHeaders = async (req?: Request) => {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const hdr: Record<string, string> = {};
  if (token) hdr["Authorization"] = `Bearer ${token}`;
  const contentType = req?.headers.get("content-type");
  if (contentType) hdr["Content-Type"] = contentType;
  return hdr;
};

export async function GET(req: Request) {
  const hdr = await buildHeaders(req);
  const upstream = await fetch(basePath, {
    method: "GET",
    headers: hdr,
    cache: "no-store",
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}

export async function POST(req: Request) {
  const hdr = await buildHeaders(req);
  if (!hdr["Content-Type"]) hdr["Content-Type"] = "application/json";
  const body = await req.text();
  const upstream = await fetch(basePath, {
    method: "POST",
    headers: hdr,
    body,
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
