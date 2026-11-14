/**
 * Qué direcciones de imagen acepta Planificaciones (auditoría de seguridad, 2026-11-14).
 *
 * El logo podía ser CUALQUIER dirección y el servidor la descargaba al generar el PDF o el Word: así
 * un administrador de un negocio hacía que el servidor de GCC consultara direcciones internas del M1
 * o de la red de casa. Las imágenes guardadas son solo `data:` (subidas) o fotos del Drive de la
 * empresa servidas por la plataforma (`https://app.grupocc.org/api/media/<id>`), así que eso es lo
 * único que se acepta y lo único que se descarga.
 */
export const DATA_IMAGEN = /^data:image\/(png|jpe?g);base64,/;
const MEDIA_PLATAFORMA = /^https:\/\/app\.grupocc\.org\/api\/media\/[A-Za-z0-9_-]+(\?[^#\s]*)?$/;

export function esImagenPermitida(url: string | null | undefined): boolean {
  if (!url) return false;
  return DATA_IMAGEN.test(url) || MEDIA_PLATAFORMA.test(url);
}

/** ¿Se puede descargar desde el servidor? Solo las fotos del Drive de la empresa, y sin seguir redirecciones. */
export function esDescargable(url: string): boolean {
  return MEDIA_PLATAFORMA.test(url);
}
