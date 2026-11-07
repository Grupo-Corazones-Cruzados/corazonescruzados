import { pool } from '@/lib/db';
import { accessRoleOf, canAccessModule, type AccessRole } from '@/lib/dashboard/access';
import { miembroEnProyectoSql } from '@/lib/projects/permisos';

/**
 * LOS DATOS DE LA CUENTA (Fernando, 2026-11-06 y 2026-11-07). Miembros, candidatos y clientes leen solo
 * las filas asociadas a ellos, aunque su módulo les deje ver más; el administrador lee todo, salvo los
 * recordatorios, que son privados de cada persona. El filtro sale de la sesión del servidor, y del modelo
 * solo llegan el módulo y el texto a buscar. Nunca se reciben identificadores de otra persona.
 * Ver `gcc-hay-sesion-no-es-tuyo`.
 */

export type Cuenta = { userId: string; correo: string; nombre: string; rol: AccessRole; memberId: number | null; clienteIds: number[] };

export async function cargarCuenta(u: { userId: string; email: string; role: string }): Promise<Cuenta> {
  const { rows: [f] } = await pool.query(
    `SELECT first_name, last_name, member_id FROM gcc_world.users WHERE id = $1`, [u.userId],
  );
  const { rows: clientes } = await pool.query(
    `SELECT id::int, account_type FROM gcc_world.clients WHERE user_id = $1`, [u.userId],
  );
  const esCandidato = clientes.some((c: any) => c.account_type === 'candidate');
  return {
    userId: u.userId,
    correo: u.email,
    nombre: [f?.first_name, f?.last_name].filter(Boolean).join(' '),
    rol: accessRoleOf({ role: u.role, account_type: esCandidato ? 'candidate' : null } as any),
    memberId: f?.member_id != null ? Number(f.member_id) : null,
    clienteIds: clientes.map((c: any) => c.id),
  };
}

/** Cada consulta y la ruta del módulo que abre. Quien no entra al módulo tampoco lo consulta aquí. */
const MODULOS = {
  mis_tickets: '/dashboard/tickets',
  mis_proyectos: '/dashboard/projects',
  mis_clientes: '/dashboard/clients',
  mis_facturas: '/dashboard/invoices',
  mis_suscripciones: '/dashboard/subscriptions',
  mis_recordatorios: '/dashboard/recordatorios',
  mi_perfil: '/dashboard/settings',
} as const;
export type ModuloCuenta = keyof typeof MODULOS;

/** El cliente consulta lo suyo aunque no tenga el módulo: sus facturas, por ejemplo, le llegan por correo. */
const DEL_CLIENTE: ModuloCuenta[] = ['mis_tickets', 'mis_proyectos', 'mis_facturas', 'mis_suscripciones', 'mi_perfil'];

export const modulosDe = (rol: AccessRole): ModuloCuenta[] =>
  rol === 'client' ? DEL_CLIENTE : (Object.keys(MODULOS) as ModuloCuenta[]).filter((m) => canAccessModule(rol, MODULOS[m]));

export async function consultarCuenta(c: Cuenta, modulo: string, busqueda: string) {
  if (!modulosDe(c.rol).includes(modulo as ModuloCuenta)) return { error: 'Tu cuenta no tiene acceso a ese módulo.' };
  const q = `%${busqueda.trim()}%`;
  const LIMITE = 15;
  // El administrador ve todo: su condición de pertenencia es siempre verdadera.
  const todo = c.rol === 'admin';
  switch (modulo as ModuloCuenta) {
    case 'mis_tickets': {
      const { rows } = await pool.query(
        `SELECT t.id::int, t.title AS titulo, t.status AS estado, t.description AS descripcion, t.deadline AS fecha_limite,
                t.estimated_cost::float8 AS costo_estimado, cl.name AS cliente, m.name AS responsable,
                (SELECT array_agg(a.description ORDER BY a.created_at) FROM gcc_world.ticket_actions a WHERE a.ticket_id = t.id) AS acciones
           FROM gcc_world.tickets t
           LEFT JOIN gcc_world.clients cl ON cl.id = t.client_id
           LEFT JOIN gcc_world.members m ON m.id = t.member_id
          WHERE (${todo} OR t.user_id = $1::uuid OR ($2::bigint IS NOT NULL AND t.member_id = $2) OR t.client_id = ANY($3::bigint[]))
            AND (t.title ILIKE $4 OR t.description ILIKE $4)
          ORDER BY t.created_at DESC LIMIT ${LIMITE}`,
        [c.userId, c.memberId, c.clienteIds, q],
      );
      return { tickets: rows };
    }
    case 'mis_proyectos': {
      const { rows } = await pool.query(
        `SELECT p.id::int, p.title AS titulo, p.status AS estado, p.description AS descripcion, p.deadline AS fecha_limite,
                p.budget_min::float8 AS presupuesto_min, p.budget_max::float8 AS presupuesto_max, p.final_cost::float8 AS costo_final, cl.name AS cliente,
                (SELECT COUNT(*)::int FROM gcc_world.project_requirements r WHERE r.project_id = p.id) AS requerimientos,
                (SELECT COUNT(*)::int FROM gcc_world.project_requirements r WHERE r.project_id = p.id AND r.completed_at IS NOT NULL) AS requerimientos_completados,
                (SELECT array_agg(r.title ORDER BY r.id) FROM gcc_world.project_requirements r WHERE r.project_id = p.id) AS lista_requerimientos
           FROM gcc_world.projects p
           LEFT JOIN gcc_world.clients cl ON cl.id = p.client_id
          WHERE (${todo} OR p.created_by_user_id = $1::text OR p.client_id = ANY($2::bigint[])
                 OR ($3::bigint IS NOT NULL AND ${miembroEnProyectoSql('p', '$3::bigint')}))
            AND (p.title ILIKE $4 OR p.description ILIKE $4)
          ORDER BY p.created_at DESC LIMIT ${LIMITE}`,
        [c.userId, c.clienteIds, c.memberId, q],
      );
      return { proyectos: rows };
    }
    case 'mis_clientes': {
      const { rows } = await pool.query(
        `SELECT cl.name AS nombre, cl.company AS empresa, cl.email AS correo, cl.phone AS telefono
           FROM gcc_world.clients cl
          WHERE cl.user_id IS DISTINCT FROM $1
            AND (${todo} OR ($2::bigint IS NOT NULL AND cl.created_by_member_id = $2)
                 OR cl.id IN (SELECT client_id FROM gcc_world.tickets WHERE user_id = $1 AND client_id IS NOT NULL)
                 OR cl.id IN (SELECT client_id FROM gcc_world.projects WHERE created_by_user_id = $1::text AND client_id IS NOT NULL))
            AND (cl.name ILIKE $3 OR COALESCE(cl.company, '') ILIKE $3)
          ORDER BY cl.name LIMIT ${LIMITE}`,
        [c.userId, c.memberId, q],
      );
      return { clientes: rows };
    }
    case 'mis_facturas': {
      const { rows } = await pool.query(
        `SELECT i.invoice_number AS numero, i.status AS estado, i.sri_status AS estado_sri, i.total::float8 AS total, i.created_at::date AS fecha, i.client_name_sri AS cliente
           FROM gcc_world.invoices i
          WHERE (${todo} OR ($1::bigint IS NOT NULL AND i.member_id = $1) OR i.client_id = ANY($2::bigint[])
                 OR i.ticket_id IN (SELECT id FROM gcc_world.tickets WHERE user_id = $3::uuid OR ($1::bigint IS NOT NULL AND member_id = $1))
                 OR i.project_id IN (SELECT id FROM gcc_world.projects WHERE created_by_user_id = $3::text OR ($1::bigint IS NOT NULL AND assigned_member_id = $1)))
            AND (COALESCE(i.invoice_number, '') ILIKE $4 OR COALESCE(i.client_name_sri, '') ILIKE $4)
          ORDER BY i.created_at DESC LIMIT ${LIMITE}`,
        [c.memberId, c.clienteIds, c.userId, q],
      );
      return { facturas: rows };
    }
    case 'mis_suscripciones': {
      const { rows } = await pool.query(
        `SELECT s.title AS titulo, s.status AS estado, s.monthly_cost::float8 AS costo_mensual, s.currency AS moneda, s.start_date AS inicio
           FROM gcc_world.subscriptions s WHERE (${todo} OR s.client_id = ANY($1::bigint[])) AND s.title ILIKE $2
          ORDER BY s.start_date DESC LIMIT ${LIMITE}`,
        [c.clienteIds, q],
      );
      return { suscripciones: rows };
    }
    case 'mis_recordatorios': {
      const { rows } = await pool.query(
        `SELECT title AS titulo, notes AS notas, remind_at AS fecha, status AS estado, tasks AS tareas
           FROM gcc_world.reminders WHERE user_id = $1 AND title ILIKE $2 ORDER BY remind_at DESC LIMIT ${LIMITE}`,
        [c.userId, q],
      );
      return { recordatorios: rows };
    }
    case 'mi_perfil': {
      const base = { nombre: c.nombre, correo: c.correo, rol: c.rol, modulos_consultables: modulosDe(c.rol) };
      if (c.memberId == null) return base;
      const { rows: [p] } = await pool.query(
        `SELECT m.piso, m.paso, m.availability_status AS disponibilidad, cv.bio, cv.location AS ubicacion, cv.talents AS talentos, cv.languages AS idiomas,
                cv.job_status AS estado_laboral, cv.salary_min::float8 AS aspiracion_min, cv.salary_max::float8 AS aspiracion_max,
                (SELECT array_agg(i.title) FROM gcc_world.member_portfolio_items i WHERE i.member_id = m.id) AS portafolio
           FROM gcc_world.members m LEFT JOIN gcc_world.member_cv_profiles cv ON cv.member_id = m.id WHERE m.id = $1`,
        [c.memberId],
      );
      return { ...base, ...p };
    }
  }
}

/** Lo que el agente sabe de quién le habla. Va al final de las instrucciones, para no romper el caché. */
export function instruccionesDeCuenta(c: Cuenta): string {
  const modulos = modulosDe(c.rol);
  const quien = { candidate: 'candidato', member: 'miembro', admin: 'administrador', client: 'cliente' }[c.rol];
  const alcance = c.rol === 'admin'
    ? 'Es administrador: \`consultar_mi_cuenta\` le devuelve los datos de toda la organización (menos los recordatorios, que son solo suyos), y puedes contarle todo lo que traiga, incluidos clientes, costos y fechas.'
    : 'De ahí puedes contarle lo que su cuenta ya ve en la plataforma, incluidos los clientes de sus propios trabajos, sus fechas y sus costos: las reglas de «Lo que NUNCA compartes» siguen valiendo para todo lo que no sea de su cuenta.';
  return `\n\n## Quién te habla
Es un ${quien} con sesión iniciada${c.nombre ? `: ${c.nombre}` : ''}. Consulta sus datos con \`consultar_mi_cuenta\`, módulos: ${modulos.join(', ')}.
${alcance} Si la herramienta no trae algo, no lo tienes: no lo deduzcas ni digas que no existe, dile que lo revise en su módulo.
Solo puedes leer: no creas, cambias ni borras nada de su cuenta.`;
}
