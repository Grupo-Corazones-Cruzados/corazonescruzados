import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { condicionesDeAcceso } from '@/lib/centralized/acceso';
import { systemPath } from '@/lib/centralized/systems';

export const dynamic = 'force-dynamic';

const HOY = `(now() AT TIME ZONE 'America/Guayaquil')::date`;

/**
 * Un número por sistema. `atender`: si es mayor que cero, algo espera a alguien (sale en rojo y suma a
 * «Por atender»). Solo cuentas: el detalle sigue en cada sistema, con sus propios permisos.
 */
const INDICADORES: Record<string, { etiqueta: string; sql: string; atender?: boolean }> = {
  'control-psicosocial': { etiqueta: 'Alertas abiertas', sql: `SELECT count(*)::int n FROM gcc_world.cp_alertas WHERE estado <> 'cerrada'`, atender: true },
  'solicitudes-y-denuncias': { etiqueta: 'Solicitudes', sql: `SELECT count(*)::int n FROM gcc_world.project_requests WHERE status = 'pending'`, atender: true },
  'reclutamiento-y-seleccion': { etiqueta: 'Propuestas', sql: `SELECT count(*)::int n FROM gcc_world.candidate_proposals WHERE decided_at IS NULL`, atender: true },
  'gestion-social': { etiqueta: 'Eventos', sql: `SELECT count(*)::int n FROM gcc_world.gs_events WHERE event_date >= ${HOY}` },
  'generacion-de-contenido': { etiqueta: 'Contenidos', sql: `SELECT count(*)::int n FROM gcc_world.gcont_contenidos` },
  'percepcion-social': { etiqueta: 'Capturas · 30 d', sql: `SELECT count(*)::int n FROM gcc_world.ps_capturas WHERE created_at > now() - interval '30 days'` },
  'gestion-de-datos': { etiqueta: 'Problemáticas', sql: `SELECT count(*)::int n FROM gcc_world.gd_problematicas` },
  'metodologia-condiciologica': { etiqueta: 'Tareas', sql: `SELECT count(*)::int n FROM gcc_world.mc_tasks` },
  'gestion-de-condiciones': { etiqueta: 'Condiciones', sql: `SELECT count(*)::int n FROM gcc_world.gc_condiciones` },
  'comandos-violeta': { etiqueta: 'Funciones', sql: `SELECT count(*)::int n FROM gcc_world.cv_functions` },
  'apoyo-y-autoayuda': { etiqueta: 'Problemas', sql: `SELECT count(*)::int n FROM gcc_world.aa_problems` },
};

/**
 * EL DASHBOARD DE CENTRALIZADO (Fernando, 2026-11-08). Los sistemas que la cuenta puede abrir —con la
 * misma regla que `/api/centralized/systems` (`condicionesDeAcceso`)— y un indicador por cada uno.
 * Un indicador cuya consulta falla va como `null` («—» en pantalla), nunca como un 0 inventado.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const params: unknown[] = [];
    const acceso = await condicionesDeAcceso(user, params);
    const { rows: [{ activos }] } = await pool.query(`SELECT count(*)::int AS activos FROM gcc_world.centralized_systems WHERE is_active`);
    if (acceso === null) return NextResponse.json({ activos, sistemas: [] });

    // Solo los activos, también para el admin: un sistema apagado no es parte de su alcance de hoy.
    const donde = `WHERE ${['s.is_active', ...acceso].join(' AND ')}`;
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.slug, s.piso, s.paso, s.cell_name, s.is_active FROM gcc_world.centralized_systems s ${donde} ORDER BY s.name`,
      params,
    );

    const sistemas = await Promise.all(rows.map(async (s: any) => {
      const def = INDICADORES[s.slug];
      let valor: number | null = null;
      if (def) {
        try { valor = (await pool.query(def.sql)).rows[0]?.n ?? 0; } catch (e: any) { console.error(`resumen ${s.slug}:`, e.message); }
      }
      return {
        id: s.id, nombre: s.name, slug: s.slug, piso: s.piso, paso: s.paso, celda: s.cell_name, activo: s.is_active,
        ruta: systemPath(s), etiqueta: def?.etiqueta ?? null, valor, atender: !!def?.atender,
      };
    }));
    return NextResponse.json({ activos, sistemas });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
