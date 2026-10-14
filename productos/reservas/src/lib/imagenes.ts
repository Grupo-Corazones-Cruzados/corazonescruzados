import { config } from '@/lib/identidadGcc';

/**
 * Las imágenes (logo de marca, fotos de ubicaciones y suites) NO viven en la base de datos.
 *
 * Desde el 2026-10-13 van al **Google Drive del Grupo** (decisión de Fernando para todas las
 * fotos de los productos), en `GCC World · Archivos de la empresa / Productos / Reservas /
 * <hotel> / …`. El producto no tiene la clave de Google: se las manda a la plataforma
 * (`POST /api/media/productos`, de servidor a servidor con `GCC_TOKEN`, como Planificaciones)
 * y en la fila queda `https://app.grupocc.org/api/media/<id>`. Antes iban a Cloudinary.
 *
 * El motivo de sacarlas de la base sigue en pie: Railway factura el Postgres por RAM
 * retenida, y una base que engorda con binarios se paga todos los meses.
 */
/** ¿Se puede subir? Sin el secreto de la plataforma, el formulario ofrece pegar una dirección. */
export const haySubida = Boolean(config().token);

export type ResultadoSubida = { ok: true; url: string } | { ok: false; error: string };

const MAXIMO = 5 * 1024 * 1024; // 5 MB
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

/** `carpeta` = `<slug>/marca` o `<slug>/lugares`. */
export async function subirImagen(archivo: File, carpeta: string): Promise<ResultadoSubida> {
  if (!TIPOS.includes(archivo.type))
    return { ok: false, error: 'El archivo tiene que ser JPG, PNG, WEBP o SVG.' };
  if (archivo.size > MAXIMO) return { ok: false, error: 'La imagen no puede pasar de 5 MB.' };
  const { base, token } = config();
  if (!token) return { ok: false, error: 'Todavía no hay almacenamiento de imágenes configurado. Pega la dirección de una imagen.' };
  const [inquilino, sub] = carpeta.split('/');
  const datos = Buffer.from(await archivo.arrayBuffer());
  try {
    const r = await fetch(`${base}/api/media/productos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-token': token },
      body: JSON.stringify({
        accion: 'subir', producto: 'reservas', inquilino, carpeta: sub, referencia: carpeta,
        base: archivo.name.replace(/\.[^.]+$/, '') || 'imagen',
        dataUri: `data:${archivo.type};base64,${datos.toString('base64')}`,
      }),
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!r.ok || !j.url) return { ok: false, error: j.error ? `No se pudo guardar la imagen: ${j.error}` : 'No se pudo subir la imagen. Inténtalo de nuevo.' };
    return { ok: true, url: j.url };
  } catch {
    return { ok: false, error: 'No se pudo subir la imagen. Inténtalo de nuevo.' };
  }
}
