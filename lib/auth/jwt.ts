import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import type { UserRole } from "@/lib/types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

const COOKIE_NAME = "auth_token";
const TOKEN_EXPIRY = "7d";

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export async function createToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
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

/** Verify token AND check it hasn't been invalidated by the user */
export async function verifyTokenWithInvalidation(
  token: string
): Promise<TokenPayload | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;

  const result = await query(
    "SELECT tokens_invalidated_at FROM users WHERE id = $1",
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
