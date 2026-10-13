import { pool } from '@/lib/db';

/**
 * Las columnas de `gcc_world.projects` SIN la media, para usar donde antes había `p.*`.
 *
 * `projects` guarda dentro de la fila las fotos (`images`, base64), el video (`video_data`,
 * bytea) y la proforma (`proforma_pdf`). Medido el 2026-10-13 con el proyecto 7: abrir su
 * detalle con `SELECT p.*` costaba **33 MB de JSON y +246 MB de RAM** en el servidor, cuando
 * sin esas tres columnas son 26 KB. Ninguna pantalla las leía de ahí: la galería, el video y
 * la proforma tienen sus propias rutas (`/images`, `/video`, `/proforma`), que siguen
 * pidiéndolas por nombre.
 *
 * La lista sale de `information_schema` una vez por proceso y se guarda: las columnas nuevas
 * entran solas sin tocar este archivo (aparecen tras el siguiente despliegue).
 */
export const COLUMNAS_PESADAS = ['images', 'video_data', 'proforma_pdf'] as const;

let nombres: Promise<string[]> | null = null;

function cargar(): Promise<string[]> {
  if (!nombres) {
    const pesadas: readonly string[] = COLUMNAS_PESADAS;
    nombres = pool
      .query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'gcc_world' AND table_name = 'projects'
          ORDER BY ordinal_position`,
      )
      .then((res: { rows: { column_name: string }[] }) =>
        res.rows.map((r) => r.column_name).filter((c) => !pesadas.includes(c)))
      // Si falla, no se guarda el error: la siguiente petición vuelve a intentarlo.
      .catch((e: unknown) => { nombres = null; throw e; });
  }
  return nombres as Promise<string[]>;
}

/** `"p"."id", "p"."title", …` (o sin alias) listo para un SELECT o un RETURNING. */
export async function columnasProyecto(alias?: string): Promise<string> {
  const pre = alias ? `"${alias}".` : '';
  return (await cargar()).map((c) => `${pre}"${c}"`).join(', ');
}
