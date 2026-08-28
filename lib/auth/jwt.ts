import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

const COOKIE_NAME = "auth_token";
const TOKEN_EXPIRY = "7d";

export type UserRole = "client" | "member" | "admin";

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  /**
   * Solo cuando un ADMINISTRADOR está viendo la plataforma con los ojos de este usuario.
   * Guarda quién es el administrador de verdad, para poder volver a su cuenta sin pedirle
   * la contraseña otra vez.
   *
   * ⚠️ El `role` de arriba es el DEL USUARIO SUPLANTADO, no el del administrador, y eso es
   * a propósito: mientras dura la vista, quien mira pierde sus permisos de administrador
   * en todas las rutas del servidor. Es lo que hace que «ver como otro» sea ver de verdad
   * —los botones que no tiene, los 403 que recibe— y no un administrador disfrazado.
   * También cierra el paso a encadenar suplantaciones: sin rol de admin no se puede
   * empezar otra.
   */
  suplantadoPor?: string;
  /** El correo del administrador, para poder enseñarlo en el aviso sin otra consulta. */
  suplantadoPorEmail?: string;
}

export async function createToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
  suplantadoPor?: string;
  suplantadoPorEmail?: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyTokenWithInvalidation(
  token: string
): Promise<TokenPayload | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;

  const result = await pool.query(
    "SELECT tokens_invalidated_at FROM gcc_world.users WHERE id = $1",
    [payload.userId]
  );
  if (result.rows.length === 0) return null;

  const { tokens_invalidated_at } = result.rows[0];
  if (tokens_invalidated_at && payload.iat) {
    const invalidatedAtSec = Math.floor(new Date(tokens_invalidated_at).getTime() / 1000);
    if (payload.iat <= invalidatedAtSec) return null;
  }

  return payload;
}

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function removeAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getAuthToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value || null;
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return verifyTokenWithInvalidation(token);
}
