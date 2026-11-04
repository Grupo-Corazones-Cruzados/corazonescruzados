/**
 * SESIONES ACTIVAS: las que tuvieron actividad en los últimos 2 días, de todos los proyectos. Las más
 * viejas salen de este panel y siguen en su proyecto. Lo que está en marcha entra siempre, aunque lleve
 * más tiempo o aún no tenga archivo (una sesión que acaba de nacer).
 */
import fs from 'node:fs';

export const VENTANA_ACTIVA_MS = 2 * 24 * 60 * 60 * 1000;

const TRAMOS = [256 * 1024, 8 * 1024 * 1024];
const recordadas = new Map();

/**
 * Cuándo se habló de verdad en una sesión. La fecha del archivo no sirve: una terminal abierta escribe
 * datos internos cada cierto tiempo aunque nadie la use (medido el 2026-11-04: 21 «recientes», 8 reales).
 */
export function ultimaInteraccion(archivo) {
  let info;
  try { info = fs.statSync(archivo); } catch { return null; }
  const firma = `${info.mtimeMs}:${info.size}`;
  const ya = recordadas.get(archivo);
  if (ya?.firma === firma) return ya.valor;
  let valor = null;
  const fd = fs.openSync(archivo, 'r');
  try {
    for (const tramo of TRAMOS) {
      const largo = Math.min(tramo, info.size);
      const trozo = Buffer.alloc(largo);
      fs.readSync(fd, trozo, 0, largo, info.size - largo);
      const lineas = trozo.toString('utf8').split('\n');
      if (largo < info.size) lineas.shift();
      for (let i = lineas.length - 1; i >= 0 && valor === null; i--) {
        if (!lineas[i].includes('"timestamp"')) continue;
        try {
          const d = JSON.parse(lineas[i]);
          if ((d.type === 'user' || d.type === 'assistant') && !d.isMeta && d.timestamp) valor = Date.parse(d.timestamp) || null;
        } catch { /* línea cortada */ }
      }
      if (valor !== null || largo === info.size) break;
    }
  } finally { fs.closeSync(fd); }
  recordadas.set(archivo, { firma, valor });
  return valor;
}

export const enMarcha = (v) => Boolean(v) && v.estado !== 'cerrada' && (v.estado !== 'libre' || v.noVisto || (v.tareas || 0) > 0);

/** `cerradas`: cuándo se cerró cada una a mano. Vuelve a ser activa con el siguiente mensaje. */
export function sesionesActivas(filas, vivas, ahora = Date.now(), cerradas = {}) {
  const porId = new Map();
  for (const f of filas) {
    if (!enMarcha(f.viva) && (ahora - f.actualizada >= VENTANA_ACTIVA_MS || cerradas[f.id] >= f.actualizada)) continue;
    // Una subcarpeta de un proyecto puede ser otro proyecto: manda aquel cuya raíz es esa carpeta.
    const ya = porId.get(f.id);
    if (!ya || (ya.carpeta && !f.carpeta)) porId.set(f.id, f);
  }
  for (const v of vivas) {
    if (!enMarcha(v) || porId.has(v.id) || filas.some((f) => f.id === v.id)) continue;
    porId.set(v.id, { id: v.id, proyecto: v.proyecto, titulo: 'Sesión nueva', actualizada: ahora, rama: null, carpeta: null, enTerminal: false, error: null, viva: v });
  }
  return [...porId.values()].sort((a, b) => b.actualizada - a.actualizada);
}
