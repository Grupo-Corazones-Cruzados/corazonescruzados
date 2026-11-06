import { api, BASE, cabeceras } from '@/components/espacio/api';

const TAMANO_PARTE = 32 * 1024 * 1024;
const REINTENTOS = 5;
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Sigue desde lo que ya está en disco. Una parte fallida se repite; si el servicio dice otra posición, manda él. */
export async function subirArchivo(video: { carpeta: string }, archivo: File, nombreArchivo: string, alAvanzar: (recibido: number) => void, tipo = '') {
  const base = `${BASE}/videos/${encodeURIComponent(video.carpeta)}`;
  const nombre = encodeURIComponent(nombreArchivo);
  const q = tipo ? `&tipo=${tipo}` : '';
  const estado = await api(`/videos/${encodeURIComponent(video.carpeta)}/estado?nombre=${nombre}${q}`);
  let desde: number = estado.recibido;
  if (estado.completa) { alAvanzar(archivo.size); return; }
  let fallos = 0;
  while (desde < archivo.size) {
    alAvanzar(desde);
    let r: Response | null = null;
    try {
      r = await fetch(`${base}/partes?nombre=${nombre}&desde=${desde}${q}`, {
        method: 'POST', headers: cabeceras({ 'Content-Type': 'application/octet-stream' }), body: archivo.slice(desde, desde + TAMANO_PARTE),
      });
    } catch { /* se repite abajo */ }
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok || (r?.status === 409 && typeof j.recibido === 'number')) { desde = j.recibido; fallos = 0; continue; }
    if (r && r.status >= 400 && r.status < 500) throw new Error(j.error || 'No se pudo subir el video.');
    fallos += 1;
    if (fallos > REINTENTOS) throw new Error('Se perdió la conexión con la Mac. Vuelve a elegir el archivo para seguir desde donde quedó.');
    await espera(1000 * fallos);
  }
  alAvanzar(archivo.size);
}
