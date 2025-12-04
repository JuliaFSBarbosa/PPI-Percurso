import { auth } from "@/lib/auth";

const apiBaseRaw = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const apiBase = apiBaseRaw.replace(/\/+$/, "");
const upstreamPath = `${apiBase}/api/v1/logistics/dashboard/resumo/`;

const buildHeaders = async () => {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const hdr: Record<string, string> = {};
  if (token) hdr["Authorization"] = `Bearer ${token}`;
  return hdr;
};

export async function GET(req: Request) {
  const hdr = await buildHeaders();
  const url = new URL(req.url);
  const search = url.search ?? "";
  const upstream = await fetch(`${upstreamPath}${search}`, {
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
