import { auth } from "@/lib/auth";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const basePath = `${apiBase}/api/v1/accounts/profiles/screens/`;

export async function GET() {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const upstream = await fetch(basePath, { headers, cache: "no-store" });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
