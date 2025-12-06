import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findScreenIdByPath, normalizePermissions, firstAllowedPath } from "@/lib/permissions";

const PUBLIC_PATHS = ["/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow direct access to static assets served from /public (e.g., images, icons)
  if (/\.[^/]+$/.test(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user) {
    const url = new URL("/", req.url);
    return NextResponse.redirect(url);
  }

  const isDefaultProfile = !!(session.user as any)?.profile?.is_default;

  if (pathname.startsWith("/_next") || pathname.startsWith("/public")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/configuracoes/perfil")) {
    return NextResponse.next();
  }

  if (pathname === "/inicio" && isDefaultProfile) {
    return NextResponse.redirect(new URL("/inicio/padrao", req.url));
  }

  if (pathname.startsWith("/inicio/padrao") && !isDefaultProfile) {
    return NextResponse.redirect(new URL("/inicio", req.url));
  }

  if (session.user.is_superuser) {
    return NextResponse.next();
  }

  const screenId = findScreenIdByPath(pathname);
  if (!screenId) {
    return NextResponse.next();
  }

  const permissions = normalizePermissions((session.user as any).permissions);
  if (screenId === "inicio") {
    // tela inicial (e sua variação padrão) deve ficar acessível para todos os perfis
    return NextResponse.next();
  }
  if (permissions.includes(screenId)) {
    return NextResponse.next();
  }

  let targetPath = firstAllowedPath(permissions);
  if (!targetPath) {
    targetPath = isDefaultProfile ? "/inicio/padrao" : "/inicio";
  } else if (isDefaultProfile && targetPath === "/inicio") {
    // mantém usuários do perfil padrão dentro da variante correta da tela inicial
    targetPath = "/inicio/padrao";
  }
  const redirectUrl = new URL(targetPath, req.url);
  redirectUrl.searchParams.set("acesso", "negado");
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
};
