import { pool } from '@/lib/db';
import { decodificarDataUri, guardar, quitar } from '@/lib/media';

/**
 * Fotos de los ítems del PORTAFOLIO (productos, automatizaciones y proyectos escritos a mano:
 * `gcc_world.member_portfolio_items`, lo que enseña el marketplace). Iban a Cloudinary, que ya
 * no está configurado en producción: el guardado reventaba con 500 y la foto nueva no llegaba
 * (2026-11-01). Ahora van al Drive de la empresa, como las de los proyectos.
 *
 * Llega la lista ENTERA: las nuevas (data URL) suben a Drive y las de Drive que ya no están
 * van a la papelera DESPUÉS de guardar la fila (lo hace quien llama con `quitadas`).
 */
export async function guardarFotosPortafolio(
  itemId: string | number, imagenes: unknown,
): Promise<{ imagenes: string[]; quitadas: string[] }> {
  const { rows: [actual] } = await pool.query(
    `SELECT title, COALESCE(images, '{}') AS images FROM gcc_world.member_portfolio_items WHERE id = $1`, [itemId],
  );
  const antes: string[] = actual?.images || [];
  const titulo = String(actual?.title || `Ítem ${itemId}`).slice(0, 80);
  const lista = (Array.isArray(imagenes) ? imagenes : []).map((x) => String(x ?? '').trim()).filter(Boolean);
  const finales: string[] = [];
  for (const img of lista) {
    const d = decodificarDataUri(img);
    if (!d || !d.mime.startsWith('image/')) { finales.push(img); continue; }
    const g = await guardar({
      datos: d.datos, mime: d.mime,
      base: `${titulo} · foto ${String(finales.length + 1).padStart(2, '0')}`,
      modulo: 'portafolio_foto', referencia: itemId, ruta: ['Portafolio', `${itemId} · ${titulo}`, 'Fotos'],
    });
    finales.push(g.url);
  }
  return { imagenes: finales, quitadas: antes.filter((x) => !finales.includes(x)) };
}

export async function quitarFotos(refs: string[]): Promise<void> {
  for (const ref of refs) await quitar(ref).catch((e) => console.error('[portafolio] papelera de Drive', e?.message));
}

/** El portafolio de un miembro lo toca ese miembro (o un administrador), no cualquier sesión. */
export async function puedeEditarPortafolio(user: { userId: string; role: string }, memberId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
  return !!u?.member_id && String(u.member_id) === String(memberId);
}
