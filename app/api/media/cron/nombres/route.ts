import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { nombreActual } from '@/lib/media/drive';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST — trae a la plataforma los nombres que alguien cambió DIRECTAMENTE en Drive.
 *
 * Renombrar desde la plataforma ya cambia los dos sitios al instante; esto cubre el camino
 * contrario, a más tardar al día siguiente (decisión de Fernando, 2026-10-13: una vez por
 * noche, no una consulta a Google cada vez que se abre una galería).
 *
 * Un archivo que ya no está en Drive (o está en la papelera) NO se borra de la plataforma:
 * solo se cuenta. Decidir que una foto sobra es de una persona, no de un cron.
 *
 * Autorización: `CRON_TOKEN` o un admin logueado para forzarlo a mano. Idempotente.
 */
export async function POST(req: NextRequest) {
  if (!checkCronToken(req)) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      if (!cronTokenConfigured()) return NextResponse.json({ error: 'Cron no configurado (falta CRON_TOKEN)' }, { status: 503 });
      return NextResponse.json({ error: 'Token de cron inválido' }, { status: 401 });
    }
  }

  const { rows } = await pool.query(
    `SELECT file_id, nombre FROM gcc_world.media_drive WHERE borrado_en IS NULL ORDER BY file_id`,
  );
  let cambiados = 0, faltan = 0, errores = 0;
  for (const r of rows as { file_id: string; nombre: string }[]) {
    try {
      const enDrive = await nombreActual(r.file_id);
      if (enDrive == null) { faltan++; continue; }
      if (enDrive !== r.nombre) {
        await pool.query(
          `UPDATE gcc_world.media_drive SET nombre = $2, actualizado_en = NOW() WHERE file_id = $1`, [r.file_id, enDrive],
        );
        cambiados++;
      }
    } catch (e: any) {
      errores++;
      console.error('[media/nombres]', r.file_id, e?.message);
    }
  }
  return NextResponse.json({ ok: errores === 0, revisados: rows.length, cambiados, faltanEnDrive: faltan, errores });
}
