import { headers } from 'next/headers';
import { createHash, randomBytes } from 'crypto';

export const CLIENT_COOKIE = 'gcc_client_token';
export const AUTH_COOKIE = 'gcc_player_auth';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = h.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 64);
}

export function generateClientToken(): string {
  return randomBytes(32).toString('hex');
}
