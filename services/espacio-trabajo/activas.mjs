/**
 * SESIONES ACTIVAS: las que tuvieron actividad en los últimos 2 días, de todos los proyectos. Las más
 * viejas salen de este panel y siguen en su proyecto. Lo que está en marcha entra siempre, aunque lleve
 * más tiempo o aún no tenga archivo (una sesión que acaba de nacer).
 */
export const VENTANA_ACTIVA_MS = 2 * 24 * 60 * 60 * 1000;

export const enMarcha = (v) => Boolean(v) && v.estado !== 'cerrada' && (v.estado !== 'libre' || v.noVisto || (v.tareas || 0) > 0);

export function sesionesActivas(filas, vivas, ahora = Date.now()) {
  const porId = new Map();
  for (const f of filas) {
    if (ahora - f.actualizada >= VENTANA_ACTIVA_MS && !enMarcha(f.viva)) continue;
    // Una subcarpeta de un proyecto puede ser otro proyecto: manda aquel cuya raíz es esa carpeta.
    const ya = porId.get(f.id);
    if (!ya || (ya.carpeta && !f.carpeta)) porId.set(f.id, f);
  }
  for (const v of vivas) {
    if (!enMarcha(v) || porId.has(v.id) || filas.some((f) => f.id === v.id)) continue;
    porId.set(v.id, { id: v.id, proyecto: v.proyecto, titulo: 'Sesión nueva', actualizada: ahora, rama: null, carpeta: null, enTerminal: false, error: null, viva: v });
  }
  return [...porId.values()].sort((a, b) => b.actualizada - a.actualizada);
}
