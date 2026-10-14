/**
 * Las fotos del Drive del Grupo (`…/api/media/<id>`) se piden en miniatura en las vistas de
 * tarjetas: los originales pasan por la plataforma y desde Ecuador tardan segundos cada uno
 * (medido 2026-10-13 en la plataforma: 24 fotos, 53 s los originales y 5 s las miniaturas).
 * Lo que no es del Drive (una dirección pegada a mano) se deja tal cual.
 */
export function miniatura(url: string | null | undefined, ancho: number): string | undefined {
  if (!url) return undefined;
  return /\/api\/media\/[A-Za-z0-9_-]{10,}$/.test(url) ? `${url}?w=${ancho}` : url;
}
