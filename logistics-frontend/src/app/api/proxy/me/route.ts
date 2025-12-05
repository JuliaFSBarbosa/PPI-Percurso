// Proxy de API no Next para encaminhar requisições protegidas ao backend
// Inclui automaticamente o token JWT do NextAuth no header Authorization
import { auth } from "@/lib/auth";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const buildHeaders = async () => {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const hdr: Record<string, string> = { "Content-Type": "application/json" };
  if (token) hdr["Authorization"] = `Bearer ${token}`;
  return hdr;
};

export async function GET() {
  const headers = await buildHeaders();
  const upstream = await fetch(`${apiBase}/api/v1/accounts/me`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}

// Atualiza dados do usuário autenticado no backend (/accounts/me)
export async function PUT(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
  const body = await req.text();
  const hdr = await buildHeaders();
  const upstream = await fetch(`${apiBase}/api/v1/accounts/me`, {
    method: "PUT",
    headers: hdr,
    body,
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
