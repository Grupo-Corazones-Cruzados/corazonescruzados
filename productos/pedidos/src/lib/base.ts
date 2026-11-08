/**
 * DÓNDE VIVE EL PRODUCTO (Fernando, 2026-11-08: sin subdominio). Se sirve desde GCC World bajo
 * `/p/pedidos` (`basePath` en next.config): `<Link>`, `router` y `redirect()` lo añaden solos; lo escrito a
 * mano —un `<a>`, un `fetch`, una cabecera `Location`, el manifiesto— pasa por `conBase`.
 */
export const BASE = '/p/pedidos';
/** Antepone la base a una ruta relativa de la app; deja igual lo absoluto, `mailto:`/`tel:` y lo ya prefijado. */
export const conBase = (ruta: string) =>
  ruta.startsWith('/') && !ruta.startsWith('//') && ruta !== BASE && !ruta.startsWith(`${BASE}/`) ? `${BASE}${ruta}` : ruta;
