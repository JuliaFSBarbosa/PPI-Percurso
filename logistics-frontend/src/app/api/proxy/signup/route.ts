// Proxy de API no Next para cadastrar usuários no backend
// Se houver sessão, encaminha o token no header Authorization
import { auth } from "@/lib/auth";

// Cria um novo usuário no backend (/accounts/signup/)
export async function POST(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
  const body = await req.text();
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const hdr: Record<string, string> = { "Content-Type": "application/json" };
  if (token) hdr["Authorization"] = `Bearer ${token}`;
  const upstream = await fetch(`${apiBase}/api/v1/accounts/signup/`, {
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
