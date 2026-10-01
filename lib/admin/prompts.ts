import { pool } from '@/lib/db';
import { htmlToMarkdown } from '@/lib/admin/prompts-md';

/**
 * Admin ▸ «Prompts»: un documento libre por proyecto (Fernando, 2026-10-01), escrito como
 * en Word. La tabla la crea la migración 064 — aquí no hay DDL.
 *
 * El editor guarda HTML; el servidor deriva el Markdown al guardar (`content_md`), que es
 * lo que se copia como prompt o lee un agente. Así el Markdown nunca se queda atrás del
 * documento, porque no hay otro camino para escribirlo.
 */

export interface PromptProject {
  id: number;
  title: string;
  status: string;
  client: string | null;
  chars: number;
  updatedAt: string | null;
}

export interface PromptDoc {
  projectId: number;
  title: string;
  status: string;
  html: string;
  md: string;
  chars: number;
  /** `null` = el proyecto todavía no tiene documento. */
  updatedAt: string | null;
}

/** Tope del documento: holgado para texto, y corta un pegado accidental de imágenes en base64. */
export const MAX_HTML = 2_000_000;

/** Los 26 proyectos del módulo Proyectos, con lo que llevan escrito. */
export async function listPromptProjects(): Promise<PromptProject[]> {
  const { rows } = await pool.query(
    `SELECT p.id::int AS id, p.title, p.status,
            COALESCE(NULLIF(c.company, ''), NULLIF(c.full_name, ''), c.name) AS client,
            COALESCE(d.char_count, 0)::int AS chars,
            d.updated_at AS "updatedAt"
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.clients c ON c.id = p.client_id
       LEFT JOIN gcc_world.project_prompts d ON d.project_id = p.id
      ORDER BY p.updated_at DESC NULLS LAST, p.id DESC`,
  );
  return rows;
}

export async function getPromptDoc(projectId: number): Promise<PromptDoc | null> {
  const { rows: [r] } = await pool.query(
    `SELECT p.id::int AS "projectId", p.title, p.status,
            COALESCE(d.content_html, '') AS html, COALESCE(d.content_md, '') AS md,
            COALESCE(d.char_count, 0)::int AS chars, d.updated_at AS "updatedAt"
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.project_prompts d ON d.project_id = p.id
      WHERE p.id = $1`,
    [projectId],
  );
  return r ?? null;
}

/** Texto visible, para el contador. */
function plainLength(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().length;
}

export type SaveResult =
  | { ok: true; updatedAt: string; chars: number }
  | { ok: false; conflict: true; updatedAt: string | null };

/**
 * Guarda el documento. `baseUpdatedAt` es la fecha que conocía quien escribe: si en la base
 * hay otra, alguien guardó después (otra pestaña) y NO se pisa — se devuelve conflicto.
 */
export async function savePromptDoc(
  projectId: number, html: string, baseUpdatedAt: string | null, userId: string,
): Promise<SaveResult> {
  const content = html === '<p></p>' ? '' : html;
  const markdown = htmlToMarkdown(content);
  const chars = plainLength(content);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [cur] } = await client.query(
      `SELECT updated_at FROM gcc_world.project_prompts WHERE project_id = $1 FOR UPDATE`,
      [projectId],
    );
    const actual: string | null = cur ? new Date(cur.updated_at).toISOString() : null;
    const base = baseUpdatedAt ? new Date(baseUpdatedAt).toISOString() : null;
    if (actual !== base) {
      await client.query('ROLLBACK');
      return { ok: false, conflict: true, updatedAt: actual };
    }
    const { rows: [r] } = await client.query(
      `INSERT INTO gcc_world.project_prompts (project_id, content_html, content_md, char_count, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (project_id) DO UPDATE
         SET content_html = EXCLUDED.content_html, content_md = EXCLUDED.content_md,
             char_count = EXCLUDED.char_count, updated_at = NOW(), updated_by = EXCLUDED.updated_by
       RETURNING updated_at`,
      [projectId, content, markdown, chars, userId],
    );
    await client.query('COMMIT');
    return { ok: true, updatedAt: new Date(r.updated_at).toISOString(), chars };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
