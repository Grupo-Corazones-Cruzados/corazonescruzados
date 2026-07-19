import type { NextRequest } from 'next/server';

/**
 * Autenticación de TRABAJOS PROGRAMADOS (cron) que llaman a la app desde fuera.
 *
 * Next.js en Railway solo atiende peticiones: no ejecuta nada por su cuenta a una hora fija.
 * El disparo lo hace un servicio de cron externo que llama a un endpoint con un SECRETO
 * COMPARTIDO en la env `CRON_TOKEN` (mismo valor en el server y en el disparador).
 * Mismo esquema que el worker de Percepción Social (`percepcion-worker.ts`).
 *
 * Fail-closed: si el server no tiene `CRON_TOKEN`, el endpoint se rechaza (503).
 */
export function cronTokenConfigured(): boolean {
  return !!process.env.CRON_TOKEN;
}

export function checkCronToken(req: NextRequest): boolean {
  const expected = process.env.CRON_TOKEN;
  if (!expected) return false;
  const got = req.headers.get('x-cron-token')
    || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || '';
  return got.length > 0 && got === expected;
}
