/**
 * LLEVA LA TRANSCRIPCIÓN A RECORDATORIOS, por la instancia local de la plataforma (Espacio de trabajo):
 * tiene la base y la IA y su ruta en Railway da 404, así que no hace falta publicar ningún secreto nuevo.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { leerPendiente } from './sesion.mjs';

const WEB = process.env.COPILOTO_WEB || 'http://127.0.0.1:3792';
const TOKEN = process.env.COPILOTO_TOKEN_ESPACIO || path.join(os.homedir(), '.gcc-espacio/token');

export async function enviarPendiente(ruta, fetcher = fetch) {
  const p = leerPendiente(ruta);
  const r = await fetcher(`${WEB}/api/copiloto/recordatorio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fs.readFileSync(TOKEN, 'utf8').trim()}` },
    body: JSON.stringify(p),
    signal: AbortSignal.timeout(180000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `La plataforma respondió ${r.status}`);
  fs.rmSync(ruta, { force: true });
  return j;
}
