import crypto from 'crypto';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureIncidentTables, loadOwnerForIncidents, canManageIncidents, loadCategories, setIncidentsToken,
  COLUMNA_DUENO, INCIDENT_SEVERITIES, INCIDENT_STATUSES, type IncidentOwnerType, type IncidentOwner,
} from '@/lib/incidents/schema';

/**
 * LAS RUTAS DE INCIDENTES — una definición para proyecto y ticket (2026-09-30).
 *
 * `/api/projects/[id]/incidents/…` y `/api/tickets/[id]/incidents/…` exportan estos
 * manejadores con su tipo de dueño. Antes vivían copiados dentro de las rutas del proyecto.
 */

type Ctx = { params: Promise<{ id: string; incidentId?: string }> };
const NO_ENCONTRADO: Record<IncidentOwnerType, string> = { project: 'Proyecto no encontrado', ticket: 'Ticket no encontrado' };

/** Sesión + dueño; con `gestionar`, además el permiso de gestión. Devuelve la respuesta de error si falla. */
async function acceso(tipo: IncidentOwnerType, ctx: Ctx, gestionar: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const { id, incidentId } = await ctx.params;
  const owner = await loadOwnerForIncidents(tipo, id);
  if (!owner) return { error: NextResponse.json({ error: NO_ENCONTRADO[tipo] }, { status: 404 }) };
  const canManage = await canManageIncidents(user, owner);
  if (gestionar && !canManage) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  return { user, owner, canManage, incidentId: incidentId || '' };
}

const LISTA_SQL = `id, title, severity, status, category, subcategory, reporter_name,
  created_at, updated_at, COALESCE(array_length(images, 1), 0) AS image_count`;

/** Sanea imágenes: solo data-URIs de imagen; máximo 8. */
export function sanitizeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.filter((s): s is string => typeof s === 'string' && s.startsWith('data:image/')).slice(0, 8);
}

export async function listarIncidentes(owner: IncidentOwner) {
  const { rows } = await pool.query(
    `SELECT ${LISTA_SQL} FROM gcc_world.project_incidents WHERE ${COLUMNA_DUENO[owner.tipo]} = $1 ORDER BY created_at DESC`,
    [owner.id],
  );
  return rows;
}

/** Crea un incidente con lo que manda el formulario (panel o portal público). */
export async function crearIncidente(owner: IncidentOwner, body: any, createdBy: string | null) {
  const title = String(body.title || '').trim();
  if (!title) return { error: 'El título es obligatorio' };
  const severity = INCIDENT_SEVERITIES.includes(body.severity) ? body.severity : 'medium';
  await ensureIncidentTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.project_incidents
       (${COLUMNA_DUENO[owner.tipo]}, title, description, severity, status, images, category, subcategory, reporter_name, created_by)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
     RETURNING ${LISTA_SQL}`,
    [
      owner.id, title, String(body.description || '').trim(), severity, sanitizeImages(body.images),
      body.category ? String(body.category).trim() : null,
      body.subcategory ? String(body.subcategory).trim() : null,
      body.reporter_name ? String(body.reporter_name).trim().slice(0, 120) : null,
      createdBy,
    ],
  );
  return { data: rows[0] };
}

export function rutasIncidentes(tipo: IncidentOwnerType) {
  const col = COLUMNA_DUENO[tipo];
  const fallo = (donde: string, err: any, msg = 'Error') => {
    console.error(`Incidents ${donde} error:`, err.message);
    return NextResponse.json({ error: msg }, { status: 500 });
  };

  return {
    /** `…/incidents`: lista + catálogo + token + permiso (GET) y alta (POST). */
    lista: {
      GET: async (_req: NextRequest, ctx: Ctx) => {
        try {
          const a = await acceso(tipo, ctx, false);
          if (a.error) return a.error;
          return NextResponse.json({
            incidents: await listarIncidentes(a.owner),
            categories: await loadCategories(a.owner),
            token: a.canManage ? a.owner.incidents_token : null,
            canManage: a.canManage,
          });
        } catch (err: any) { return fallo('GET', err); }
      },
      POST: async (req: NextRequest, ctx: Ctx) => {
        try {
          const a = await acceso(tipo, ctx, false);
          if (a.error) return a.error;
          const r = await crearIncidente(a.owner, await req.json(), a.user.userId || null);
          if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
          return NextResponse.json({ data: r.data }, { status: 201 });
        } catch (err: any) { return fallo('POST', err, 'Error al crear el incidente'); }
      },
    },

    /** `…/incidents/[incidentId]`: detalle, edición y borrado. */
    uno: {
      GET: async (_req: NextRequest, ctx: Ctx) => {
        try {
          const a = await acceso(tipo, ctx, false);
          if (a.error) return a.error;
          const { rows } = await pool.query(
            `SELECT * FROM gcc_world.project_incidents WHERE id = $1 AND ${col} = $2`, [Number(a.incidentId) || 0, a.owner.id]);
          if (!rows[0]) return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 });
          return NextResponse.json({ data: rows[0] });
        } catch (err: any) { return fallo('detail GET', err); }
      },
      PATCH: async (req: NextRequest, ctx: Ctx) => {
        try {
          const a = await acceso(tipo, ctx, true);
          if (a.error) return a.error;
          const body = await req.json();
          const sets: string[] = [];
          const values: any[] = [];
          let i = 1;
          const push = (c: string, val: any) => { sets.push(`${c} = $${i++}`); values.push(val); };
          if (typeof body.status === 'string' && INCIDENT_STATUSES.includes(body.status)) push('status', body.status);
          if (typeof body.severity === 'string' && INCIDENT_SEVERITIES.includes(body.severity)) push('severity', body.severity);
          if (typeof body.title === 'string' && body.title.trim()) push('title', body.title.trim());
          if (typeof body.description === 'string') push('description', body.description);
          if ('category' in body) push('category', body.category ? String(body.category).trim() : null);
          if ('subcategory' in body) push('subcategory', body.subcategory ? String(body.subcategory).trim() : null);
          if (Array.isArray(body.images)) push('images', sanitizeImages(body.images));
          if (sets.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
          values.push(Number(a.incidentId) || 0, a.owner.id);
          const { rows } = await pool.query(
            `UPDATE gcc_world.project_incidents SET ${sets.join(', ')}, updated_at = NOW()
              WHERE id = $${i++} AND ${col} = $${i} RETURNING *`,
            values,
          );
          if (!rows[0]) return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 });
          return NextResponse.json({ data: rows[0] });
        } catch (err: any) { return fallo('PATCH', err); }
      },
      DELETE: async (_req: NextRequest, ctx: Ctx) => {
        try {
          const a = await acceso(tipo, ctx, true);
          if (a.error) return a.error;
          await pool.query(`DELETE FROM gcc_world.project_incidents WHERE id = $1 AND ${col} = $2`, [Number(a.incidentId) || 0, a.owner.id]);
          return NextResponse.json({ ok: true });
        } catch (err: any) { return fallo('DELETE', err); }
      },
    },

    /**
     * `…/incidents/categories`: el catálogo categorías → subcategorías. El PUT lo reemplaza
     * entero. Los incidentes guardan la categoría por NOMBRE, así que renombrar o reordenar el
     * catálogo no afecta a los ya creados.
     */
    categorias: {
      GET: async (_req: NextRequest, ctx: Ctx) => {
        try {
          const a = await acceso(tipo, ctx, false);
          if (a.error) return a.error;
          return NextResponse.json({ categories: await loadCategories(a.owner) });
        } catch (err: any) { return fallo('categories GET', err); }
      },
      PUT: async (req: NextRequest, ctx: Ctx) => {
        try {
          const a = await acceso(tipo, ctx, true);
          if (a.error) return a.error;
          const { categories } = await req.json();
          if (!Array.isArray(categories)) return NextResponse.json({ error: 'categories requerido' }, { status: 400 });
          await ensureIncidentTables();
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(`DELETE FROM gcc_world.project_incident_categories WHERE ${col} = $1`, [a.owner.id]);
            let ci = 0;
            for (const cat of categories) {
              const name = String(cat?.name || '').trim();
              if (!name) continue;
              const { rows } = await client.query(
                `INSERT INTO gcc_world.project_incident_categories (${col}, name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
                [a.owner.id, name, ci++],
              );
              let si = 0;
              for (const sub of Array.isArray(cat.subcategories) ? cat.subcategories : []) {
                const sname = String(sub?.name || '').trim();
                if (!sname) continue;
                await client.query(
                  `INSERT INTO gcc_world.project_incident_subcategories (category_id, name, sort_order) VALUES ($1, $2, $3)`,
                  [rows[0].id, sname, si++],
                );
              }
            }
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            throw e;
          } finally {
            client.release();
          }
          return NextResponse.json({ categories: await loadCategories(a.owner) });
        } catch (err: any) { return fallo('categories PUT', err); }
      },
    },

    /**
     * `…/incidents/token`: el enlace revocable del portal público. POST lo genera o lo
     * devuelve ({ regenerate: true } fuerza uno nuevo); DELETE lo revoca.
     */
    token: {
      POST: async (req: NextRequest, ctx: Ctx) => {
        try {
          const a = await acceso(tipo, ctx, true);
          if (a.error) return a.error;
          const body = await req.json().catch(() => ({}));
          let token = a.owner.incidents_token;
          if (!token || body.regenerate) {
            token = crypto.randomBytes(32).toString('hex');
            await setIncidentsToken(a.owner, token);
          }
          return NextResponse.json({ token });
        } catch (err: any) { return fallo('token POST', err); }
      },
      DELETE: async (_req: NextRequest, ctx: Ctx) => {
        try {
          const a = await acceso(tipo, ctx, true);
          if (a.error) return a.error;
          await setIncidentsToken(a.owner, null);
          return NextResponse.json({ ok: true });
        } catch (err: any) { return fallo('token DELETE', err); }
      },
    },
  };
}
