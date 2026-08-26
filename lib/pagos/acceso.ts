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
import { partesMesSuscripcion, partesAltaProducto, idAltaProducto } from './intentos';

export type Solicitante =
  | { tipo: 'staff'; userId: number; email: string; esAdmin: boolean }
  | { tipo: 'cliente'; userId: number; email: string; clientId: number }
  | { tipo: 'enlace'; linkId: number; email: string };

export type Autorizacion = {
  solicitante: Solicitante;
  canal: 'manual' | 'client' | 'link';
  sourceType: 'project' | 'ticket' | 'subscription' | 'product';
  sourceId: string;
  /** La etapa del plan. `null` en tickets, que se cobran enteros. */
  stageId: number | null;
  /** @deprecated Se conserva para el código que ya lo usaba; es `sourceId` cuando es proyecto. */
  projectId: number;
};

export class SinAcceso extends Error {
  constructor(mensaje: string, readonly status = 403) { super(mensaje); }
}

/** El enlace de pago, validado: existe, no está revocado, no ha caducado y sabe qué cobra. */
export async function validarEnlace(token: string): Promise<{
  id: number; sourceType: 'project' | 'ticket' | 'subscription' | 'product'; sourceId: string;
  stageId: number | null; email: string; expiresAt: string;
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
  // Un enlace de proyecto SIEMPRE cobra una etapa; uno de ticket cobra el ticket entero.
  // Exigirlo aquí evita que un enlace mal insertado a mano acabe cobrando algo distinto.
  if (l.source_type === 'project' && !l.stage_id) throw new SinAcceso('Enlace inválido.', 404);
  if (!['project', 'ticket', 'subscription', 'product'].includes(l.source_type)) {
    throw new SinAcceso('Enlace inválido.', 404);
  }
  return {
    id: Number(l.id),
    sourceType: l.source_type,
    sourceId: String(l.source_id),
    stageId: l.stage_id != null ? Number(l.stage_id) : null,
    email: l.email,
    expiresAt: l.expires_at,
  };
}

/**
 * Si esta suscripción es de este cliente.
 *
 * ⚠️ Se aceptan DOS vínculos porque en la base conviven los dos: las suscripciones creadas
 * desde el módulo guardan `client_id`, y las más antiguas solo tienen `client_email_sri`
 * (una de las dos que hay hoy no tiene `client_id`). Mirar solo uno dejaría fuera a la
 * mitad de los clientes sin que nadie entendiera por qué.
 */
async function suscripcionDelCliente(email: string, subId: string): Promise<number | null> {
  const { rows: [r] } = await pool.query(
    `SELECT COALESCE(s.client_id, c.id) AS client_id
       FROM gcc_world.subscriptions s
       LEFT JOIN gcc_world.clients c ON c.id = s.client_id
      WHERE s.id = ($2)::bigint
        AND (LOWER(c.email) = LOWER($1) OR LOWER(s.client_email_sri) = LOWER($1))
      LIMIT 1`,
    [email, subId],
  );
  return r ? Number(r.client_id) : null;
}

/** Si este usuario es el miembro al que está asignado el ticket. */
async function esResponsableDeTicket(userId: number, ticketId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.tickets t
       JOIN gcc_world.users u ON u.id = $1
      WHERE t.id = ($2)::bigint AND u.member_id IS NOT NULL AND t.member_id = u.member_id
      LIMIT 1`,
    [userId, ticketId],
  );
  return rows.length > 0;
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
  sourceType?: 'project' | 'ticket' | string | null;
  sourceId?: number | string | null;
  stageId?: number | string | null;
  linkToken?: string | null;
  /** @deprecated alias de `sourceId` con `sourceType: 'project'`. */
  projectId?: number | string | null;
}): Promise<Autorizacion> {
  if (opts.linkToken) {
    const enlace = await validarEnlace(opts.linkToken);
    // El enlace manda sobre lo que venga en el cuerpo de la petición: si alguien pide pagar
    // OTRA cosa con este token, se cobra la del token, no la que pidió.
    return {
      solicitante: { tipo: 'enlace', linkId: enlace.id, email: enlace.email },
      canal: 'link',
      sourceType: enlace.sourceType,
      sourceId: enlace.sourceId,
      stageId: enlace.stageId,
      projectId: Number(enlace.sourceId),
    };
  }

  const sourceType = (opts.sourceType || (opts.projectId ? 'project' : null)) as 'project' | 'ticket' | 'subscription' | 'product' | null;
  const sourceId = String(opts.sourceId ?? opts.projectId ?? '').trim();
  const stageId = opts.stageId != null && String(opts.stageId) !== '' ? Number(opts.stageId) : null;

  if (!sourceType || !['project', 'ticket', 'subscription', 'product'].includes(sourceType)) {
    throw new SinAcceso('Falta qué se va a cobrar.', 400);
  }
  if (!sourceId) throw new SinAcceso('Falta qué se va a cobrar.', 400);
  // Un proyecto se cobra POR ETAPA; un ticket, entero. Pedir lo contrario es una petición
  // mal formada, no un permiso denegado.
  if (sourceType === 'project' && !stageId) throw new SinAcceso('Falta la etapa del proyecto.', 400);

  const user = await getCurrentUser();
  if (!user) throw new SinAcceso('Inicia sesión para continuar.', 401);
  const userId = Number(user.userId);

  // ⚠️ UN PRODUCTO LO PUEDE CONTRATAR CUALQUIERA CON SESIÓN — no tiene dueño previo, esa es
  // la diferencia con los otros tres orígenes. Pero el identificador del cobro lleva dentro
  // al comprador, y **ese id se compone AQUÍ con la sesión**, nunca con lo que llegue de
  // fuera: aceptarlo del cliente dejaría pagar «en nombre de otro» y saltarse el candado que
  // impide contratar dos veces el mismo producto.
  if (sourceType === 'product') {
    const { itemId } = partesAltaProducto(sourceId);
    return {
      sourceType, stageId: null, projectId: 0,
      sourceId: idAltaProducto(itemId, String(user.userId)),
      solicitante: user.role === 'admin' || user.role === 'member'
        ? { tipo: 'staff', userId, email: String(user.email), esAdmin: user.role === 'admin' }
        : { tipo: 'cliente', userId, email: String(user.email), clientId: 0 },
      canal: 'client',
    };
  }

  const base = { sourceType, sourceId, stageId, projectId: Number(sourceId) || 0 };

  // Ni las suscripciones ni los productos tienen «responsable»: son cobros de la casa, así
  // que del lado del staff solo los gobierna el admin — igual que en sus módulos.
  const esStaff = user.role === 'admin' || (user.role === 'member' && (
    sourceType === 'ticket'
      ? await esResponsableDeTicket(userId, sourceId)
      : sourceType === 'project'
      ? await esResponsable(userId, Number(sourceId))
      : false
  ));
  if (esStaff) {
    return {
      ...base,
      solicitante: { tipo: 'staff', userId, email: String(user.email), esAdmin: user.role === 'admin' },
      canal: 'manual',
    };
  }

  if (user.role === 'client') {
    // ⚠️ El vínculo «esto es tuyo» se resuelve por el MISMO criterio que ya usa el resto de
    // la aplicación: `LOWER(clients.email) = LOWER(users.email)`. Un ticket admite además
    // el vínculo directo `tickets.user_id`, que es como se guarda cuando el propio cliente
    // lo solicita desde su cuenta.
    if (sourceType === 'subscription') {
      const { subId } = partesMesSuscripcion(sourceId);
      const clientId = await suscripcionDelCliente(String(user.email), subId);
      if (clientId == null) throw new SinAcceso('Esta suscripción no es tuya.');
      return {
        ...base,
        solicitante: { tipo: 'cliente', userId, email: String(user.email), clientId },
        canal: 'client',
      };
    }

    const { rows: [c] } = sourceType === 'ticket'
      ? await pool.query(
          `SELECT c.id
             FROM gcc_world.tickets t
             LEFT JOIN gcc_world.clients c ON c.id = t.client_id
            WHERE t.id = ($2)::bigint
              AND (LOWER(c.email) = LOWER($1) OR t.user_id = ($3)::uuid)
            LIMIT 1`,
          [user.email, sourceId, String(user.userId)],
        ).catch(() => pool.query(
          // `tickets.user_id` es UUID y `users.id` puede no serlo en todos los entornos: si
          // el casting falla, queda el vínculo por correo, que es el que siempre existe.
          `SELECT c.id FROM gcc_world.tickets t
             JOIN gcc_world.clients c ON c.id = t.client_id
            WHERE t.id = ($2)::bigint AND LOWER(c.email) = LOWER($1) LIMIT 1`,
          [user.email, sourceId],
        ))
      : await pool.query(
          `SELECT c.id
             FROM gcc_world.clients c
             JOIN gcc_world.projects p ON p.client_id = c.id
            WHERE LOWER(c.email) = LOWER($1) AND p.id = ($2)::bigint
            LIMIT 1`,
          [user.email, sourceId],
        );
    if (!c) throw new SinAcceso(sourceType === 'ticket' ? 'Este ticket no es tuyo.' : 'Este proyecto no es tuyo.');
    return {
      ...base,
      solicitante: { tipo: 'cliente', userId, email: String(user.email), clientId: Number(c.id) },
      canal: 'client',
    };
  }

  throw new SinAcceso('No tienes acceso a este cobro.');
}

/** Solo quien puede COMPARTIR un enlace: admin o el responsable de eso que se va a cobrar. */
export async function autorizarCompartir(
  sourceId: number | string,
  sourceType: 'project' | 'ticket' | 'subscription' = 'project',
): Promise<{ userId: number }> {
  const user = await getCurrentUser();
  if (!user) throw new SinAcceso('Inicia sesión para continuar.', 401);
  const userId = Number(user.userId);
  if (user.role === 'admin') return { userId };
  if (user.role === 'member' && sourceType !== 'subscription') {
    const ok = sourceType === 'ticket'
      ? await esResponsableDeTicket(userId, String(sourceId))
      : await esResponsable(userId, Number(sourceId));
    if (ok) return { userId };
  }
  throw new SinAcceso(`Solo el responsable ${sourceType === 'ticket' ? 'del ticket' : 'del proyecto'} puede compartir el enlace de pago.`);
}
