import { pool } from '@/lib/db';

/**
 * Esquema del módulo de COTIZACIONES (Fase 1). Tablas nuevas, creadas idempotentemente
 * (patrón `CREATE TABLE IF NOT EXISTS`) — el estado `cotizacion` vive en la propia
 * `gcc_world.projects.status` (TEXT libre), no requiere DDL.
 *
 * - `quote_sessions`   : una por proyecto-cotización. Guarda el agente usado, la sesión
 *                        persistente del worker (`worker_session_id`) para reanudar el chat,
 *                        el modelo, el servicio elegido y los textos de entrada.
 * - `quote_versions`   : historial de versiones de la cotización (v1, v2, …). Cada
 *                        generación/cambio del agente inserta una versión (payload JSONB).
 * - `project_observations`: observaciones del cliente/externo sobre el proyecto (reemplaza
 *                        las que antes venían de DigiMundo). Ligadas a `projects.id`.
 */
let ensuring: Promise<void> | null = null;

export function ensureQuoteTables(): Promise<void> {
  if (!ensuring) {
    ensuring = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gcc_world.quote_sessions (
          id BIGSERIAL PRIMARY KEY,
          project_id BIGINT NOT NULL UNIQUE,
          agent_key VARCHAR(64) NOT NULL DEFAULT 'cotizaciones-software',
          worker_session_id TEXT,
          model VARCHAR(64),
          status VARCHAR(16) NOT NULL DEFAULT 'active',
          service_id BIGINT,
          service_name TEXT,
          service_rate NUMERIC,
          detail TEXT,
          instructions TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gcc_world.quote_versions (
          id BIGSERIAL PRIMARY KEY,
          project_id BIGINT NOT NULL,
          version INT NOT NULL,
          payload JSONB NOT NULL,
          note TEXT,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(project_id, version)
        )`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gcc_world.project_observations (
          id BIGSERIAL PRIMARY KEY,
          project_id BIGINT NOT NULL,
          author_user_id TEXT,
          author_name TEXT,
          author_email TEXT,
          body TEXT NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'open',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_quote_versions_project ON gcc_world.quote_versions(project_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_project_observations_project ON gcc_world.project_observations(project_id)`);
    })().catch((e) => { ensuring = null; throw e; });
  }
  return ensuring;
}

/** Estructura de una cotización generada por el agente (la salida validada). */
export type QuoteRequirement = {
  title: string;
  description?: string;
  hours?: number;
  cost: number;
  subtasks: string[];
};
export type QuotePayload = {
  title?: string;
  summary?: string;
  deadline?: string | null;   // ISO date
  requirements: QuoteRequirement[];
  total?: number;
};

/** Normaliza/valida el payload que devuelve el agente (defensivo). */
export function normalizeQuotePayload(raw: any): QuotePayload {
  const reqs: QuoteRequirement[] = Array.isArray(raw?.requirements) ? raw.requirements.map((r: any) => ({
    title: String(r?.title || '').trim() || 'Requerimiento',
    description: r?.description ? String(r.description) : '',
    hours: r?.hours != null && !Number.isNaN(Number(r.hours)) ? Number(r.hours) : undefined,
    cost: Number(r?.cost) || 0,
    subtasks: Array.isArray(r?.subtasks) ? r.subtasks.map((s: any) => String(typeof s === 'string' ? s : s?.title || '').trim()).filter(Boolean) : [],
  })).filter((r: QuoteRequirement) => r.title) : [];
  const total = reqs.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  let deadline: string | null = null;
  if (raw?.deadline) {
    const d = new Date(raw.deadline);
    if (!Number.isNaN(d.getTime())) deadline = d.toISOString();
  }
  return { title: raw?.title ? String(raw.title).slice(0, 200) : '', summary: raw?.summary ? String(raw.summary) : '', deadline, requirements: reqs, total };
}
