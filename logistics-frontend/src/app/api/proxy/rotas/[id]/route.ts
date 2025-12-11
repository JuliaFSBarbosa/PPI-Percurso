import { auth } from "@/lib/auth";

const apiBaseRaw = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const apiBase = apiBaseRaw.replace(/\/+$/, "");
const readPath = `${apiBase}/api/v1/logistics/rotas/`;
const writePath = `${apiBase}/api/v1/logistics/rotas-admin/`;

const buildHeaders = async (req?: Request) => {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const hdr: Record<string, string> = {};
  if (token) hdr["Authorization"] = `Bearer ${token}`;
  const contentType = req?.headers.get("content-type");
  if (contentType) hdr["Content-Type"] = contentType;
  return hdr;
};

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hdr = await buildHeaders();
  const upstream = await fetch(`${readPath}${id}/`, {
    method: "GET",
    headers: hdr,
    cache: "no-store",
  });
  if (upstream.status === 204) {
    return new Response(null, { status: upstream.status });
  }
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hdr = await buildHeaders(req);
  if (!hdr["Content-Type"]) hdr["Content-Type"] = "application/json";
  const body = await req.text();
  const upstream = await fetch(`${writePath}${id}/`, {
    method: "PUT",
    headers: hdr,
    body,
  });
  if (upstream.status === 204) {
    return new Response(null, { status: upstream.status });
  }
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hdr = await buildHeaders(req);
  if (!hdr["Content-Type"]) hdr["Content-Type"] = "application/json";
  const body = await req.text();
  const upstream = await fetch(`${writePath}${id}/`, {
    method: "PATCH",
    headers: hdr,
    body,
  });
  if (upstream.status === 204) {
    return new Response(null, { status: upstream.status });
  }
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hdr = await buildHeaders();
  const upstream = await fetch(`${writePath}${id}/`, {
    method: "DELETE",
    headers: hdr,
  });
  if (upstream.status === 204) {
    return new Response(null, { status: upstream.status });
  }
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
