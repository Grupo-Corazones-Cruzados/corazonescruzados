/**
 * DÓNDE VIVE EL PRODUCTO (Fernando, 2026-11-08: sin subdominio). Se sirve desde GCC World bajo
 * `/p/reservas` (`basePath` en next.config): `<Link>`, `router` y `redirect()` lo añaden solos; lo
 * escrito a mano —un `<a>`, una cabecera `Location`, el manifiesto— pasa por `conBase`.
 */
export const BASE = '/p/reservas';
export const conBase = (ruta: string) => `${BASE}${ruta}`;
