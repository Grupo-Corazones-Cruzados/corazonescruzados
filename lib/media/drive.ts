import { createHash } from 'crypto';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { authDrive } from '@/lib/integrations/google-workspace';
import { miniatura as miniaturaDrive } from '@/lib/integrations/google-drive';

/**
 * Drive de la empresa (`lfgonzalezm0@grupocc.org`) como almacén de fotos y videos de
 * Proyectos y Productos (decisión de Fernando, 2026-10-13).
 *
 * Habla como la cuenta organizadora con la cuenta de servicio y delegación de dominio, la
 * misma que ya manda el correo y crea las reuniones de Meet. No usa el token de ningún
 * usuario: es el almacén de la empresa, no el Drive personal de quien sube.
 *
 * Todo vive en UNA carpeta dedicada en la raíz de esa cuenta, separada de lo personal (ahí
 * ya hay un «GCC World / Experiencias» del módulo de experiencias, que es otra cosa):
 *
 *   GCC World · Archivos de la empresa /
 *     Proyectos / <id · título> / Fotos | Video | Incidencias
 *     Documentación de proyectos / <proyecto> / <incidencia>
 *     Productos / <producto> / <institución> / …
 *
 * Una carpeta por proyecto y por producto (Fernando, 2026-10-13).
 */

const CARPETA = 'application/vnd.google-apps.folder';
const RAIZ = ['GCC World · Archivos de la empresa'];

function api() {
  return google.drive({ version: 'v3', auth: authDrive() });
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** id de carpeta por ruta; dura lo que el proceso. */
const carpetas = new Map<string, Promise<string>>();

async function hija(nombre: string, padre: string | null): Promise<string> {
  const drive = api();
  const dentro = padre ? `'${q(padre)}' in parents` : `'root' in parents`;
  const { data } = await drive.files.list({
    q: `name = '${q(nombre)}' and mimeType = '${CARPETA}' and ${dentro} and trashed = false`,
    fields: 'files(id)', pageSize: 1, spaces: 'drive',
  });
  if (data.files?.[0]?.id) return data.files[0].id;
  const { data: nueva } = await drive.files.create({
    requestBody: { name: nombre, mimeType: CARPETA, ...(padre ? { parents: [padre] } : {}) },
    fields: 'id',
  });
  return nueva.id!;
}

/** Carpeta `<raíz> / <ruta…>`, creándola si falta. */
export function carpeta(ruta: string[]): Promise<string> {
  const partes = [...RAIZ, ...ruta];
  const clave = partes.join('/');
  let p = carpetas.get(clave);
  if (!p) {
    p = (async () => {
      let padre: string | null = null;
      for (const nombre of partes) padre = await hija(nombre, padre);
      return padre!;
    })();
    // Si falla no se guarda la promesa rota: la siguiente subida lo reintenta.
    p.catch(() => carpetas.delete(clave));
    carpetas.set(clave, p);
  }
  return p;
}

export type Subido = { id: string; md5: string; tamano: number };

/**
 * Sube un archivo y COMPRUEBA que Drive guardó exactamente esos bytes (su md5 contra el
 * nuestro). Si no coinciden, lo borra y lanza: nunca se da por guardado lo que no lo está.
 */
export async function subir(o: { datos: Buffer; nombre: string; mime: string; ruta: string[] }): Promise<Subido> {
  const drive = api();
  const padre = await carpeta(o.ruta);
  const md5 = createHash('md5').update(o.datos).digest('hex');
  const { data } = await drive.files.create({
    requestBody: { name: o.nombre, parents: [padre] },
    media: { mimeType: o.mime, body: Readable.from(o.datos) },
    fields: 'id,md5Checksum,size',
  });
  if (data.md5Checksum !== md5 || Number(data.size) !== o.datos.length) {
    await drive.files.delete({ fileId: data.id! }).catch(() => {});
    throw new Error(`Drive guardó otra cosa para «${o.nombre}» (md5 ${data.md5Checksum} ≠ ${md5})`);
  }
  return { id: data.id!, md5, tamano: o.datos.length };
}

/**
 * El contenido, como stream. `rango` es la cabecera `Range` del navegador tal cual: el video
 * se reproduce y se adelanta pidiendo trozos, y Drive los entiende igual.
 */
export async function abrir(id: string, rango?: string | null) {
  const res = await api().files.get(
    { fileId: id, alt: 'media' },
    { responseType: 'stream', headers: rango ? { Range: rango } : undefined },
  );
  // ⚠️ Las cabeceras llegan como objeto `Headers` (hay que usar `.get()`): indexarlas como
  // `headers['content-range']` da `undefined` y el video no se podría adelantar. Medido el
  // 2026-10-13 con una lectura parcial real (206 y `bytes 0-999/5000` solo por `.get()`).
  const h: any = res.headers;
  const leer = (k: string): string | null => (typeof h?.get === 'function' ? h.get(k) : h?.[k]) ?? null;
  return {
    stream: res.data as unknown as Readable,
    status: res.status,
    contentRange: leer('content-range'),
    contentLength: leer('content-length'),
  };
}

/** Todo el contenido en memoria. Solo para quien de verdad necesita los bytes (sharp, ffmpeg). */
export async function descargar(id: string): Promise<Buffer> {
  const { data } = await api().files.get({ fileId: id, alt: 'media' }, { responseType: 'arraybuffer' });
  return Buffer.from(data as ArrayBuffer);
}

/**
 * Miniatura de `lado` px que genera Drive (unos KB). Medido el 2026-10-13: la galería de 24
 * fotos tardaba 53 s pidiendo los originales (12,8 MB); las cuadrículas piden esto y el
 * original solo se baja al abrir la foto. `null` si Drive aún no la tiene (p. ej. recién
 * subida) o el archivo no es una imagen: quien llama sirve el original.
 */
export async function miniatura(id: string, lado: number): Promise<Response | null> {
  const { token } = await authDrive().getAccessToken();
  if (!token) return null;
  return miniaturaDrive(token, id, lado).catch(() => null);
}

export async function renombrar(id: string, nombre: string): Promise<void> {
  await api().files.update({ fileId: id, requestBody: { name: nombre } });
}

/** A la papelera, no borrado: Drive la vacía a los 30 días y hasta entonces se puede recuperar. */
export async function aPapelera(id: string): Promise<void> {
  await api().files.update({ fileId: id, requestBody: { trashed: true } });
}

/** Nombre actual en Drive (para la sincronización nocturna). `null` si ya no existe o está en la papelera. */
export async function nombreActual(id: string): Promise<string | null> {
  try {
    const { data } = await api().files.get({ fileId: id, fields: 'name,trashed' });
    return data.trashed ? null : data.name ?? null;
  } catch (e: any) {
    if (e?.code === 404 || e?.response?.status === 404) return null;
    throw e;
  }
}
