/**
 * LA ENTREGA DE UN SOLO USO ADMITE ARCHIVOS MÁS GRANDES (Fernando, 2026-11-09: no podía subir un ZIP de
 * 127 MB). La sube el equipo, no alguien de fuera, y los bytes van del navegador a Drive y de Drive a quien
 * descarga en flujo: el servidor nunca los tiene enteros. El enlace público (sube quien sea) sigue en 100 MB.
 * Aparte de `index.ts` para que la pantalla lo importe sin arrastrar la base de datos.
 */
export const MAX_BYTES_ENTREGA = 500 * 1024 * 1024;
export const textoTope = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;
