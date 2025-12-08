import { auth } from "@/lib/auth";

const apiBaseRaw = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const apiBase = apiBaseRaw.replace(/\/+$/, "");
const basePath = `${apiBase}/api/v1/logistics/restricoes-familias/`;

const buildHeaders = async (req?: Request) => {
  const session = await auth();
  const token = (session as any)?.user?.access_token as string | undefined;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const contentType = req?.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
};

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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const headers = await buildHeaders(req);
  if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const body = await req.text();
  const upstream = await fetch(`${basePath}${params.id}/`, {
    method: "PATCH",
    headers,
    body,
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
