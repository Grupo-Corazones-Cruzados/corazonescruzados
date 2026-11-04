import { llamarServicio } from '@/lib/espacio-trabajo/guardia';

/**
 * Una respuesta JSON de Claude Code en esta Mac, con la suscripción. El servicio responde al momento
 * y mantiene viva la conexión con espacios mientras Claude escribe, así que aquí no hay plazo.
 */
export async function generarJSONLocal<T = any>(system: string, user: string): Promise<T> {
  let r: Response;
  try {
    r = await llamarServicio('/generar-json', { method: 'POST', body: JSON.stringify({ system, user }) });
  } catch {
    throw new Error('El servicio local no está en marcha.');
  }
  const j = JSON.parse(await r.text());
  if (!r.ok || j.error) throw new Error(j.error || 'Claude no pudo generarlo.');
  return j.datos as T;
}

export async function borrarCarpetaVideo(video: { carpeta: string | null; sesion_id: string | null }): Promise<void> {
  if (!video.carpeta) return;
  const r = await llamarServicio(`/videos/${encodeURIComponent(video.carpeta)}`, { method: 'DELETE', body: JSON.stringify({ sesion: video.sesion_id }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo borrar la carpeta del video.');
}
