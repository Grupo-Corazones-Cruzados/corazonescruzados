// Autenticación del WORKER LOCAL del Sistema de Percepción Social.
// El worker (scripts/percepcion-worker.mjs) corre en una máquina con el Claude CLI y llama a la app
// (local o publicada) para tomar capturas pendientes y devolver el análisis. No usa sesión JWT: se
// autentica con un SECRETO COMPARTIDO en la env `PERCEPCION_WORKER_TOKEN` (mismo valor en el server y
// en el worker). Fail-closed: si el server no tiene el token configurado, los endpoints se rechazan.
import type { NextRequest } from 'next/server';

export function workerTokenConfigured(): boolean {
  return !!process.env.PERCEPCION_WORKER_TOKEN;
}

/** Compara el header del worker contra el token del server. */
export function checkWorkerToken(req: NextRequest): boolean {
  const expected = process.env.PERCEPCION_WORKER_TOKEN;
  if (!expected) return false;
  const got = req.headers.get('x-worker-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return got.length > 0 && got === expected;
}
