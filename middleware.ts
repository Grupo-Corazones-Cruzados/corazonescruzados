import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { secretoServidor } from "@/lib/auth/secreto";

const PROTECTED = ["/dashboard"];
const AUTH_ROUTES = ["/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("auth_token")?.value;
  let valid = false;

  if (token) {
    try {
      // Sin clave en producción, `secretoServidor` lanza y la sesión no vale: falla cerrado.
      await jwtVerify(token, new TextEncoder().encode(secretoServidor()));
      valid = true;
    } catch {
      valid = false;
    }
  }

  const isProtected = PROTECTED.some((r) => pathname.startsWith(r));
  const isAuth = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // GCC Centralizado abre su módulo al ARRANCAR o al iniciar sesión, viniendo de la portada. El botón
  // «Inicio» también pide `/dashboard`, y ese debe llegar al Inicio: es navegación interna (`rsc`) o
  // viene de otra página del panel.
  if (valid && pathname === "/dashboard" && request.cookies.get("gcc_app")?.value === "centralizado") {
    const interna = request.headers.has("rsc") || request.nextUrl.searchParams.has("_rsc");
    const referer = request.headers.get("referer");
    const desdeElPanel = !!referer && new URL(referer).pathname.startsWith("/dashboard");
    if (!interna && !desdeElPanel) {
      return NextResponse.redirect(new URL("/dashboard/centralized", request.url));
    }
  }

  // En GCC Progreso no se paga con PayPhone (`usePagosEnApp`), ni llegando por un enlace.
  if (pathname.startsWith("/pagar") && request.cookies.get("gcc_app")?.value === "progreso") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtected && !valid) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (
    isAuth &&
    valid &&
    !pathname.includes("/verify") &&
    !pathname.includes("/reset")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public|universal_assets|sounds).*)",
  ],
};
