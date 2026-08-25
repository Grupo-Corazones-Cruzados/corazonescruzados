/**
 * QUIÉN PUEDE PAGAR QUÉ — una sola definición para los tres canales.
 *
 * Es el archivo que hay que leer con desconfianza, porque un fallo aquí no da un error
 * feo: deja que alguien pague la etapa de otro, o que vea el detalle de un proyecto
 * ajeno. Por eso los tres caminos terminan en la misma función y ninguno resuelve el
 * acceso por su cuenta.
 *
 * Los tres caminos:
 *   · `staff`   — admin, o el miembro responsable del proyecto. Es quien comparte el enlace.
 *   · `cliente` — un usuario con sesión cuyo correo coincide con el cliente del proyecto.
 *                 ⚠️ El vínculo por correo NO es invención de este archivo: es el que ya
 *                 usan `/api/projects` y `/api/projects/[id]`. Inventar aquí otro criterio
 *                 sería crear una segunda definición de «este proyecto es tuyo», y esas
 *                 dos se separan al primer cambio.
 *   · `enlace`  — sin cuenta: un token de un solo proyecto y una sola etapa, con la
 *                 caducidad que puso el responsable.
 */
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';

export type Solicitante =
  | { tipo: 'staff'; userId: number; email: string; esAdmin: boolean }
  | { tipo: 'cliente'; userId: number; email: string; clientId: number }
  | { tipo: 'enlace'; linkId: number; email: string };

export type Autorizacion = {
  solicitante: Solicitante;
  canal: 'manual' | 'client' | 'link';
  projectId: number;
  stageId: number;
};

export class SinAcceso extends Error {
  constructor(mensaje: string, readonly status = 403) { super(mensaje); }
}

/** El enlace de pago, validado: existe, no está revocado, no ha caducado y es de esta etapa. */
export async function validarEnlace(token: string): Promise<{
  id: number; projectId: number; stageId: number; email: string; expiresAt: string;
}> {
  if (!token || token.length < 20) throw new SinAcceso('Enlace inválido.', 404);
  const { rows: [l] } = await pool.query(
    `SELECT id, source_type, source_id, stage_id, email, expires_at, revoked_at
       FROM gcc_world.payment_links WHERE token = $1`,
    [token],
  );
  if (!l) throw new SinAcceso('Este enlace de pago no existe.', 404);
  if (l.revoked_at) throw new SinAcceso('Este enlace de pago fue anulado.', 410);
  if (new Date(l.expires_at) < new Date()) {
    throw new SinAcceso('Este enlace de pago ya caducó. Pídele uno nuevo a tu contacto en GCC.', 410);
  }
  if (l.source_type !== 'project' || !l.stage_id) throw new SinAcceso('Enlace inválido.', 404);
  return {
    id: Number(l.id),
    projectId: Number(l.source_id),
    stageId: Number(l.stage_id),
    email: l.email,
    expiresAt: l.expires_at,
  };
}

/** Si este usuario es el responsable del proyecto (o participa en él como responsable). */
async function esResponsable(userId: number, projectId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1
       FROM gcc_world.projects p
       JOIN gcc_world.users u ON u.id = $1
      WHERE p.id = ($2)::bigint
        AND u.member_id IS NOT NULL
        AND (p.assigned_member_id = u.member_id
             OR EXISTS (SELECT 1 FROM gcc_world.project_members pm
                         WHERE pm.project_id = p.id AND pm.member_id = u.member_id
                           AND pm.role = 'responsible'))
      LIMIT 1`,
    [userId, String(projectId)],
  );
  return rows.length > 0;
}

/**
 * Autoriza una operación de cobro sobre una etapa.
 *
 * Con `linkToken` gana el enlace y NO se mira la sesión: el cliente que abre el correo no
 * tiene cuenta, y exigirle una sería romper justo lo que Fernando pidió.
 */
export async function autorizarCobro(opts: {
  projectId?: number | string;
  stageId?: number | string;
  linkToken?: string | null;
}): Promise<Autorizacion> {
  if (opts.linkToken) {
    const enlace = await validarEnlace(opts.linkToken);
    // El enlace manda sobre lo que venga en el cuerpo de la petición: si alguien pide
    // pagar OTRA etapa con este token, se cobra la del token, no la que pidió.
    return {
      solicitante: { tipo: 'enlace', linkId: enlace.id, email: enlace.email },
      canal: 'link',
      projectId: enlace.projectId,
      stageId: enlace.stageId,
    };
  }

  const projectId = Number(opts.projectId);
  const stageId = Number(opts.stageId);
  if (!projectId || !stageId) throw new SinAcceso('Falta el proyecto o la etapa.', 400);

  const user = await getCurrentUser();
  if (!user) throw new SinAcceso('Inicia sesión para continuar.', 401);
  const userId = Number(user.userId);

  if (user.role === 'admin' || (user.role === 'member' && await esResponsable(userId, projectId))) {
    return {
      solicitante: { tipo: 'staff', userId, email: String(user.email), esAdmin: user.role === 'admin' },
      canal: 'manual',
      projectId, stageId,
    };
  }

  if (user.role === 'client') {
    const { rows: [c] } = await pool.query(
      `SELECT c.id
         FROM gcc_world.clients c
         JOIN gcc_world.projects p ON p.client_id = c.id
        WHERE LOWER(c.email) = LOWER($1) AND p.id = ($2)::bigint
        LIMIT 1`,
      [user.email, String(projectId)],
    );
    if (!c) throw new SinAcceso('Este proyecto no es tuyo.');
    return {
      solicitante: { tipo: 'cliente', userId, email: String(user.email), clientId: Number(c.id) },
      canal: 'client',
      projectId, stageId,
    };
  }

  throw new SinAcceso('No tienes acceso a este cobro.');
}

/** Solo quien puede COMPARTIR un enlace: admin o el responsable del proyecto. */
export async function autorizarCompartir(projectId: number | string): Promise<{ userId: number }> {
  const user = await getCurrentUser();
  if (!user) throw new SinAcceso('Inicia sesión para continuar.', 401);
  const userId = Number(user.userId);
  if (user.role === 'admin') return { userId };
  if (user.role === 'member' && await esResponsable(userId, Number(projectId))) return { userId };
  throw new SinAcceso('Solo el responsable del proyecto puede compartir el enlace de pago.');
}
