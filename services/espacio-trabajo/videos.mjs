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

const finalDe = (dir, ext) => path.join(dir, `fuente${ext}`);
const parcialDe = (dir, ext) => path.join(dir, `.fuente${ext}.parcial`);
const tamanoDe = (ruta) => { try { return fs.statSync(ruta).size; } catch { return 0; } };

export function estadoSubida(dir, nombre) {
  const ext = extensionDe(nombre);
  if (fs.existsSync(finalDe(dir, ext))) return { recibido: tamanoDe(finalDe(dir, ext)), completa: true };
  return { recibido: tamanoDe(parcialDe(dir, ext)), completa: false };
}

/** Una parte fuera de orden no se escribe: se responde desde dónde hay que seguir. */
export async function guardarParte(origen, dir, nombre, desde) {
  const ext = extensionDe(nombre);
  fs.mkdirSync(dir, { recursive: true });
  const parcial = parcialDe(dir, ext);
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
export function terminarSubida(dir, nombre, tamano) {
  const ext = extensionDe(nombre);
  const final = finalDe(dir, ext);
  if (fs.existsSync(final)) return final;
  const recibido = tamanoDe(parcialDe(dir, ext));
  if (recibido !== Number(tamano)) throw new ErrorVideo(409, 'La subida está incompleta.', { codigo: 'desfase', recibido });
  fs.renameSync(parcialDe(dir, ext), final);
  return final;
}

/** La primera orden de la sesión dedicada al video. */
export function primerMensaje({ ruta, carpeta, tema }) {
  return [
    `/editar-video ${ruta}`,
    '',
    `Este video pertenece a la idea «${tema}» de Generación de Contenido. Sesión dedicada a este video.`,
    `- Usa \`--idea ${carpeta}\` y llama al proyecto \`${carpeta}-v1\`. El video ya está en esa carpeta.`,
    `- En \`idea.md\` de esa carpeta están la idea y los guiones. Es lo que se quería decir: úsalo para entender el video, pero manda lo que se dice en él.`,
    '- Fernando ya aplicó sus cortes. Si aun así encuentras silencios largos, frases repetidas o abandonadas, corrígelos con `cortes` y dile cuáles.',
  ].join('\n');
}
