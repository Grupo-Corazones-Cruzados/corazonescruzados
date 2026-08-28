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

/** El mismo ancho de siempre, pero pidiéndole a Cloudinary la copia ya desenfocada. */
export function urlDesenfocada(url: string, ancho: number, sigma: number): string {
  if (!esUrlCloudinary(url)) return url;
  // `e_blur` va de 1 a 2000 y NO es el sigma de una gaussiana: se escala para que se
  // parezca a lo que hace `sharp` en el otro camino de servido.
  const blur = Math.min(2000, Math.max(100, Math.round(sigma * 100)));
  return url.replace(/\/image\/upload\/(?:[^/]*\/)?/, `/image/upload/w_${ancho},e_blur:${blur},f_auto,q_auto,c_limit/`);
}

/** El desenfoque que le toca a un ancho. Proporcional: ver la ruta de imagen del marketplace. */
export function sigmaPara(ancho: number): number {
  return Math.round((1.1 * (ancho / 240)) * 100) / 100;
}
