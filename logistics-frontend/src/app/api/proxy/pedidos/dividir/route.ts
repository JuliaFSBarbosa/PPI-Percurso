import { auth } from "@/lib/auth";

const apiBaseRaw = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const apiBase = apiBaseRaw.replace(/\/+$/, "");
const dividirPath = `${apiBase}/api/v1/logistics/pedidos-admin/dividir/`;

const buildHeaders = async (req: Request) => {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const hdr: Record<string, string> = {};
  if (token) hdr["Authorization"] = `Bearer ${token}`;
  const contentType = req.headers.get("content-type");
  if (contentType) {
    hdr["Content-Type"] = contentType;
  } else {
    hdr["Content-Type"] = "application/json";
  }
  return hdr;
};

export async function POST(req: Request) {
  const headers = await buildHeaders(req);
  const body = await req.text();
  const upstream = await fetch(dividirPath, {
    method: "POST",
    headers,
    body,
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
