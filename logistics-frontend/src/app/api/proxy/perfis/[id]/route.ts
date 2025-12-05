import { auth } from "@/lib/auth";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const basePath = `${apiBase}/api/v1/accounts/profiles/`;

const buildHeaders = async (req?: Request) => {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const contentType = req?.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
};

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const headers = await buildHeaders();
  const upstream = await fetch(`${basePath}${params.id}/`, { headers, cache: "no-store" });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const headers = await buildHeaders(req);
  if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const body = await req.text();
  const upstream = await fetch(`${basePath}${params.id}/`, {
    method: "PUT",
    headers,
    body,
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const headers = await buildHeaders();
  const upstream = await fetch(`${basePath}${params.id}/`, {
    method: "DELETE",
    headers,
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
