import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

const PROTECTED = ["/dashboard"];
const AUTH_ROUTES = ["/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/blocked") return NextResponse.next();

  const token = request.cookies.get("auth_token")?.value;
  let valid = false;

  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      valid = true;
    } catch {
      valid = false;
    }
  }

  const isProtected = PROTECTED.some((r) => pathname.startsWith(r));
  const isAuth = AUTH_ROUTES.some((r) => pathname.startsWith(r));

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
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public|blocked).*)",
  ],
};
