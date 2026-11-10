import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

/**
 * LOS VIDEOS DE GENERACIÓN DE CONTENIDO. Cada uno tiene su carpeta en ~/Movies/GCC-Edicion, la única
 * que CapCut lee sin pedir permiso, y una sesión de Claude Code dedicada.
 *
 * Se suben por partes y en orden, porque un video llega a 6 GB: si se corta, se sigue desde lo que
 * ya está en disco en vez de empezar de cero.
 */
export const raizEdicion = (entorno = process.env) => entorno.ESPACIO_EDICION || path.join(os.homedir(), 'Movies/GCC-Edicion');
export const MAX_PARTE = 64 * 1024 * 1024;
const EXTENSIONES = new Set(['.mov', '.mp4', '.m4v', '.mkv', '.avi', '.webm']);

export class ErrorVideo extends Error {
  constructor(estado, mensaje, extra = {}) { super(mensaje); this.estado = estado; Object.assign(this, extra); }
}

/** Con este prefijo, ni un error ni una ruta manipulada alcanzan `biblioteca` ni los proyectos anteriores. */
export function carpetaDe(raiz, carpeta) {
  if (!/^video-\d+(-[a-z0-9]+)*$/.test(String(carpeta))) throw new ErrorVideo(400, 'Carpeta de video inválida.');
  return path.join(raiz, carpeta);
}

export function extensionDe(nombre) {
  const ext = path.extname(String(nombre || '')).toLowerCase();
  if (!EXTENSIONES.has(ext)) throw new ErrorVideo(400, 'Ese archivo no es un video.');
  return ext;
}

/** `fuente` es lo que entra al agente; `final`, lo que Fernando exportó de CapCut para publicar. */
const baseDe = (tipo) => (tipo === 'final' ? 'final' : 'fuente');
const finalDe = (dir, ext, tipo) => path.join(dir, `${baseDe(tipo)}${ext}`);
const parcialDe = (dir, ext, tipo) => path.join(dir, `.${baseDe(tipo)}${ext}.parcial`);
const tamanoDe = (ruta) => { try { return fs.statSync(ruta).size; } catch { return 0; } };

export function estadoSubida(dir, nombre, tipo) {
  const ext = extensionDe(nombre);
  // La versión final siempre se puede reemplazar: que ya exista una no significa que sea esta.
  if (tipo !== 'final' && fs.existsSync(finalDe(dir, ext, tipo))) return { recibido: tamanoDe(finalDe(dir, ext, tipo)), completa: true };
  return { recibido: tamanoDe(parcialDe(dir, ext, tipo)), completa: false };
}

/** Una parte fuera de orden no se escribe: se responde desde dónde hay que seguir. */
export async function guardarParte(origen, dir, nombre, desde, tipo) {
  const ext = extensionDe(nombre);
  fs.mkdirSync(dir, { recursive: true });
  const parcial = parcialDe(dir, ext, tipo);
  const recibido = tamanoDe(parcial);
  if (Number(desde) !== recibido) throw new ErrorVideo(409, 'La subida se desfasó.', { codigo: 'desfase', recibido });
  let total = 0;
  await pipeline(origen, async function* (entrada) {
    for await (const trozo of entrada) {
      total += trozo.length;
      if (total > MAX_PARTE) throw new ErrorVideo(413, 'La parte es demasiado grande.');
      yield trozo;
    }
  }, fs.createWriteStream(parcial, { flags: 'a', mode: 0o600 }));
  return { recibido: recibido + total };
}

/** Solo pasa a ser el video cuando mide lo que dijo el navegador. Repetirlo no cambia nada. */
export function terminarSubida(dir, nombre, tamano, tipo) {
  const ext = extensionDe(nombre);
  const final = finalDe(dir, ext, tipo);
  const parcial = parcialDe(dir, ext, tipo);
  if (fs.existsSync(final) && (tipo !== 'final' || !fs.existsSync(parcial))) return final;
  const recibido = tamanoDe(parcial);
  if (recibido !== Number(tamano)) {
    // Restos de otro archivo más grande: sin esto, la versión final no se podría volver a subir nunca.
    if (tipo === 'final' && recibido > Number(tamano)) fs.rmSync(parcial, { force: true });
    throw new ErrorVideo(409, 'La subida está incompleta. Vuelve a elegir el archivo.', { codigo: 'desfase', recibido });
  }
  // Una versión final nueva sustituye a la anterior, aunque tenga otra extensión.
  if (tipo === 'final') for (const n of fs.readdirSync(dir)) if (/^final\.\w+$/.test(n)) fs.rmSync(path.join(dir, n));
  fs.renameSync(parcialDe(dir, ext, tipo), final);
  return final;
}

/** La primera orden de la sesión dedicada al video. */
export function primerMensaje({ ruta, carpeta, tema }) {
  return [
    `/editar-video ${ruta}`,
    '',
    `Sesión dedicada a la idea${tema ? ` «${tema}»` : ''} de Generación de Contenido. Es la única sesión de esta idea.`,
    `- Usa \`--idea ${carpeta}\`. El video ya está en esa carpeta y ya viene editado por Fernando en CapCut.`,
    `- En \`idea.md\` están el talento, sus cuentas y los trabajos de referencia.`,
    '- Entrega las cuatro piezas de Generación de Contenido: `final.mp4` con `construir.mjs --final` (sin música), y la miniatura, el carrusel y la infografía con `entregables.mjs`. Pon tú el `titulo` de la idea.',
    '- Si aun así encuentras silencios largos, frases repetidas o abandonadas, corrígelos con `cortes` y dile cuáles.',
  ].join('\n');
}
