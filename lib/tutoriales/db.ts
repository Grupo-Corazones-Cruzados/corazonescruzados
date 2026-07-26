import { pool } from '@/lib/db';

/**
 * "Tutoriales": videos de YouTube incrustados que explican cada módulo del dashboard.
 * Se ven desde el botón de información (ⓘ) que acompaña a cada módulo en el sidebar.
 *
 * El video se guarda por su ID de YouTube y se incrusta con `youtube-nocookie.com`.
 * OJO: para que se pueda incrustar, el video debe ser **No listado** (accesible solo
 * con el enlace). Los videos marcados **Privado** en YouTube NO se pueden incrustar en
 * ningún sitio — YouTube los bloquea aunque tengas el enlace.
 *
 * `module` = href del módulo (`/dashboard/tickets`), la misma clave de
 * `lib/dashboard/modules.ts` y del control de acceso.
 */

export interface Tutorial {
  id: number;
  module: string;
  title: string;
  description: string | null;
  url: string;
  videoId: string;
  orden: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

let ensuring: Promise<void> | null = null;
export function ensureTutorialesTable(): Promise<void> {
  if (ensuring) return ensuring;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.tutoriales (
        id SERIAL PRIMARY KEY,
        module TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        video_id TEXT NOT NULL,
        orden INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS tutoriales_module_idx ON gcc_world.tutoriales(module, orden);
    `)
    .then(() => undefined)
    .catch((err: unknown) => { ensuring = null; throw err; });
  ensuring = p;
  return p;
}

const ROW = `id, module, title, description, url, video_id AS "videoId", orden, active,
             created_at AS "createdAt", updated_at AS "updatedAt"`;

/**
 * Extrae el ID de un enlace de YouTube. Acepta las formas habituales:
 * `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`, o el ID pelado.
 * Devuelve `null` si no se reconoce.
 */
export function parseYouTubeId(input: string): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;

  // ID pelado (11 caracteres del alfabeto de YouTube).
  if (/^[\w-]{11}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  const seg = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') return /^[\w-]{11}$/.test(seg[0] || '') ? seg[0] : null;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return null;

  const v = url.searchParams.get('v');
  if (v && /^[\w-]{11}$/.test(v)) return v;

  // /embed/ID · /shorts/ID · /live/ID · /v/ID
  if (['embed', 'shorts', 'live', 'v'].includes(seg[0]) && /^[\w-]{11}$/.test(seg[1] || '')) return seg[1];
  return null;
}

/** URL para incrustar en el iframe (dominio sin cookies, sin videos sugeridos ajenos). */
export function embedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

/** Miniatura del video (para las listas del admin). */
export function thumbUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/** Tutoriales ACTIVOS de un módulo, en orden — lo que ve el usuario en el modal. */
export async function listByModule(module: string): Promise<Tutorial[]> {
  await ensureTutorialesTable();
  const { rows } = await pool.query(
    `SELECT ${ROW} FROM gcc_world.tutoriales WHERE module = $1 AND active
      ORDER BY orden, id`,
    [module],
  );
  return rows;
}

/** Todos los tutoriales (admin), incluidos los inactivos. */
export async function listAll(): Promise<Tutorial[]> {
  await ensureTutorialesTable();
  const { rows } = await pool.query(
    `SELECT ${ROW} FROM gcc_world.tutoriales ORDER BY module, orden, id`,
  );
  return rows;
}

/** Cuántos tutoriales ACTIVOS tiene cada módulo: `{ '/dashboard/tickets': 2, … }`. */
export async function countsByModule(): Promise<Record<string, number>> {
  await ensureTutorialesTable();
  const { rows } = await pool.query(
    `SELECT module, COUNT(*)::int AS count FROM gcc_world.tutoriales
      WHERE active GROUP BY module`,
  );
  return Object.fromEntries(rows.map((r: { module: string; count: number }) => [r.module, r.count]));
}

export async function createTutorial(input: {
  module: string; title: string; description?: string | null; url: string; videoId: string;
  orden?: number; active?: boolean;
}): Promise<Tutorial> {
  await ensureTutorialesTable();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.tutoriales (module, title, description, url, video_id, orden, active)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, (
       SELECT COALESCE(MAX(orden), -1) + 1 FROM gcc_world.tutoriales WHERE module = $1
     )), COALESCE($7, TRUE))
     RETURNING ${ROW}`,
    [input.module, input.title, input.description ?? null, input.url, input.videoId,
     input.orden ?? null, input.active ?? null],
  );
  return rows[0];
}

export async function updateTutorial(id: number, patch: {
  module?: string; title?: string; description?: string | null; url?: string; videoId?: string;
  orden?: number; active?: boolean;
}): Promise<Tutorial | null> {
  await ensureTutorialesTable();
  const map: Record<string, string> = {
    module: 'module', title: 'title', description: 'description',
    url: 'url', videoId: 'video_id', orden: 'orden', active: 'active',
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [key, col] of Object.entries(map)) {
    const v = (patch as Record<string, unknown>)[key];
    if (v === undefined) continue;
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  }
  if (!sets.length) return null;
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE gcc_world.tutoriales SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${vals.length} RETURNING ${ROW}`,
    vals,
  );
  return rows[0] || null;
}

export async function deleteTutorial(id: number): Promise<boolean> {
  await ensureTutorialesTable();
  const res = await pool.query('DELETE FROM gcc_world.tutoriales WHERE id = $1', [id]);
  return (res.rowCount ?? 0) > 0;
}
