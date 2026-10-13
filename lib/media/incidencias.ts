import { prisma } from '@/lib/db';
import { guardar } from '@/lib/media';

/**
 * Fotos de las incidencias de la documentación de proyectos (`gcc_world."Incident"`, las del
 * portal `/portal/<proyecto>`). Hasta el 2026-10-13 iban como base64 DENTRO de la fila
 * («Railway tiene el disco efímero»): 20 MB en 32 incidencias. Ahora van al Drive de la
 * empresa, en `Documentación de proyectos / <proyecto> / <incidencia>`.
 */
const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
};

export async function guardarFotosIncidencia(
  archivos: File[], incidencia: { id: string; projectId: string; title: string }, yaHay = 0,
): Promise<string[]> {
  const proyecto = await prisma.project
    .findUnique({ where: { id: incidencia.projectId }, select: { name: true } })
    .catch(() => null);
  const urls: string[] = [];
  for (const f of archivos) {
    if (!f || f.size === 0) continue;
    const ext = f.name.split('.').pop()?.toLowerCase() || 'png';
    const mime = f.type && f.type.startsWith('image/') ? f.type : MIME[ext] || 'image/png';
    const g = await guardar({
      datos: Buffer.from(await f.arrayBuffer()), mime,
      base: `${incidencia.title} · foto ${String(yaHay + urls.length + 1).padStart(2, '0')}`,
      modulo: 'incidencia', referencia: incidencia.id,
      ruta: ['Documentación de proyectos', proyecto?.name || incidencia.projectId, incidencia.title.slice(0, 80)],
    });
    urls.push(g.url);
  }
  return urls;
}
