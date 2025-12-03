import { auth } from "@/lib/auth";

const apiBaseRaw = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const apiBase = apiBaseRaw.replace(/\/+$/, "");
const pdfPath = `${apiBase}/api/v1/logistics/rotas/relatorio-pdf/`;

const buildHeaders = async () => {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const hdr: Record<string, string> = {};
  if (token) hdr["Authorization"] = `Bearer ${token}`;
  return hdr;
};

export async function POST(req: Request) {
  const hdr = await buildHeaders();
  const body = await req.text();

  const upstream = await fetch(pdfPath, {
    method: "POST",
    headers: { ...hdr, "Content-Type": "application/json" },
    body,
  });

  const arrayBuf = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") || "application/pdf";
  const disposition = upstream.headers.get("content-disposition") || "";

  return new Response(arrayBuf, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
    },
  });
}
