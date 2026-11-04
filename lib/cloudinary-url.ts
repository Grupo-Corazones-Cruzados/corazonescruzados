/**
 * Transformaciones de URL de Cloudinary — **puras y sin SDK**.
 *
 * Viven aparte de `lib/cloudinary.ts` a propósito: ese importa el SDK de Cloudinary, que
 * es de servidor, así que un componente del navegador no puede tocarlo sin arrastrárselo
 * entero al paquete. Esto son dos funciones de texto: valen en los dos lados.
 */

export function esUrlCloudinary(url: string | null | undefined): boolean {
  return !!url && /res\.cloudinary\.com/.test(url);
}

/** Solo el ancho (WebP/AVIF según el navegador), sin tocar la imagen: para lo que se enseña nítido. */
export function urlRedimensionada(url: string, ancho: number): string {
  if (!esUrlCloudinary(url)) return url;
  return url.replace(/\/image\/upload\/(?:[^/]*\/)?/, `/image/upload/w_${ancho},f_auto,q_auto,c_limit/`);
}

