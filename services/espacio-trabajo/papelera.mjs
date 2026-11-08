import fs from 'node:fs';
import path from 'node:path';

/**
 * ELIMINAR UNA SESIÓN no la borra al momento: su archivo de Claude Code (y la carpeta de sus subagentes) se mueve a
 * la papelera del Espacio y se borra de verdad a los 30 días. Fuera de `~/.claude/projects` ya no aparece en ningún
 * listado, ni aquí ni en `claude --resume`, y un error tiene arreglo devolviendo la carpeta a su sitio.
 *
 * Cada sesión eliminada es una carpeta `<fecha>-<id>` con `origen.json`, que dice de dónde salió.
 */
export const DIAS_PAPELERA = 30;

export function moverAPapelera(raiz, archivo, id, ahora = Date.now()) {
  const destino = path.join(raiz, `${ahora}-${id}`);
  fs.mkdirSync(destino, { recursive: true, mode: 0o700 });
  const subagentes = path.join(path.dirname(archivo), id);
  fs.renameSync(archivo, path.join(destino, path.basename(archivo)));
  if (fs.existsSync(subagentes)) fs.renameSync(subagentes, path.join(destino, id));
  fs.writeFileSync(path.join(destino, 'origen.json'), JSON.stringify({ id, archivo, eliminada: ahora }, null, 2), { mode: 0o600 });
  return destino;
}

export function vaciarPapelera(raiz, ahora = Date.now(), dias = DIAS_PAPELERA) {
  let borradas = 0;
  let entradas = [];
  try { entradas = fs.readdirSync(raiz); } catch { return 0; }
  for (const e of entradas) {
    const cuando = Number(e.split('-')[0]);
    if (!Number.isFinite(cuando) || ahora - cuando < dias * 86_400_000) continue;
    fs.rmSync(path.join(raiz, e), { recursive: true, force: true });
    borradas++;
  }
  return borradas;
}
