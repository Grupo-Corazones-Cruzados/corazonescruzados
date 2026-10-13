import { prisma } from '@/lib/db';
import { config } from '@/lib/identidadGcc';

/**
 * Las imágenes de las destrezas viven en el Google Drive del Grupo, no en la base
 * (decisión de Fernando, 2026-10-13). El producto NO tiene la clave de Google: le pide a la
 * plataforma que suba, renombre o quite (`POST /api/media/productos`, de servidor a servidor
 * con `GCC_TOKEN`), y en la fila queda la dirección `https://app.grupocc.org/api/media/<id>`,
 * que se ve en un `<img>` y que `cargarImagen` del PDF y del Word ya sabe descargar.
 */

async function plataforma<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { base, token } = config();
  if (!token) throw new Error('Falta GCC_TOKEN: no se puede guardar la imagen en el Drive del Grupo.');
  const r = await fetch(`${base}/api/media/productos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-token': token },
    body: JSON.stringify(cuerpo),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `La plataforma respondió ${r.status}`);
  return j as T;
}

/** El id de Drive si la dirección es de la plataforma; si no (una URL pegada a mano), `null`. */
export function fileIdDe(ref: string | null | undefined): string | null {
  const m = String(ref ?? '').match(/\/api\/media\/([A-Za-z0-9_-]{10,})(?:[?#].*)?$/);
  return m ? m[1] : null;
}

export async function subirImagen(dataUrl: string, o: { inquilino: string; referencia: string; base: string }): Promise<string> {
  const j = await plataforma<{ url: string }>({ accion: 'subir', producto: 'planificaciones', dataUri: dataUrl, ...o });
  return j.url;
}

export async function renombrarImagen(ref: string, base: string): Promise<string> {
  return (await plataforma<{ nombre: string }>({ accion: 'renombrar', ref, nombre: base })).nombre;
}

/** Nombre en Drive de cada imagen, por id. Si la plataforma no responde, sin nombres (no rompe la página). */
export async function nombresImagenes(refs: (string | null)[]): Promise<Record<string, string>> {
  const nuestras = refs.filter((r): r is string => !!fileIdDe(r));
  if (!nuestras.length) return {};
  try {
    return (await plataforma<{ nombres: Record<string, string> }>({ accion: 'nombres', refs: nuestras })).nombres || {};
  } catch (e) {
    console.error('[media] nombres de las imágenes:', e);
    return {};
  }
}

/**
 * A la papelera de Drive SOLO si ninguna destreza la usa ya: al crear una planificación las
 * destrezas se copian del catálogo con la MISMA dirección de imagen, así que una imagen
 * puede estar en varias filas.
 */
export async function quitarSiHuerfana(ref: string | null | undefined): Promise<void> {
  if (!ref || !fileIdDe(ref)) return;
  const usos = await prisma.destreza.count({ where: { imagenUrl: ref } });
  if (usos > 0) return;
  await plataforma({ accion: 'quitar', ref }).catch((e) => console.error('[media] quitar imagen:', e));
}
