/**
 * LOS ENLACES DE PAGO — canal 3, una sola definición para proyectos y tickets.
 *
 * `/api/projects/[id]/payment-link` y `/api/tickets/[id]/payment-link` son dos puertas a
 * esta misma lógica. La alternativa era copiar el endpoint y cambiarle la tabla, y eso son
 * dos generadores de llaves de cobro que se separan al primer arreglo — con la mala suerte
 * de que el que se quede viejo sigue generando enlaces válidos.
 */
import { randomBytes } from 'node:crypto';
import { pool } from '@/lib/db';
import { cotizarCobro, cobroPagadoDe, type OrigenCobro } from './intentos';
import { proveedorActivo } from './index';
import { sendPaymentLinkEmail } from '@/lib/integrations/email';

/** Tope duro de caducidad. Un enlace de pago eterno es una llave olvidada en la cerradura. */
export const MAX_HORAS_ENLACE = 24 * 30;

export type EnlaceCreado = {
  id: number;
  url: string;
  email: string;
  expiresAt: Date;
  importes: { neto: number; recargo: number; total: number };
  correoEnviado: boolean;
  avisoCorreo: string | null;
};

/** Los enlaces ya emitidos para algo, con su estado. */
export async function listarEnlaces(sourceType: OrigenCobro, sourceId: string) {
  const { rows } = await pool.query(
    `SELECT l.id, l.stage_id, l.email, l.expires_at, l.sent_at, l.opened_at, l.paid_at,
            l.revoked_at, l.created_at, e.name AS stage_name,
            (l.revoked_at IS NULL AND l.expires_at > NOW() AND l.paid_at IS NULL) AS vigente
       FROM gcc_world.payment_links l
       LEFT JOIN gcc_world.project_stages e ON e.id = l.stage_id
      WHERE l.source_type = $1 AND l.source_id = $2
      ORDER BY l.created_at DESC`,
    [sourceType, sourceId],
  );
  return rows;
}

/**
 * Crea el enlace y manda el correo.
 *
 * ⚠️ Cotiza ANTES de crear nada: así el importe que promete el correo sale del mismo
 * cálculo que luego se cobra. Un enlace que anuncia una cifra distinta de la que aparece al
 * pagar es una discusión con el cliente asegurada.
 */
export async function crearEnlaceDePago(opts: {
  sourceType: OrigenCobro;
  sourceId: string;
  stageId: number | null;
  email?: string | null;
  horas: number;
  createdBy: string;
  baseUrl: string;
  /**
   * `false` = solo generar el enlace, sin correo: el responsable lo copia y lo manda por
   * WhatsApp o por donde hable con su cliente. Es el «Generar enlace» del formulario, el
   * mismo par de botones que el de compartir una cotización.
   */
  enviar?: boolean;
}): Promise<EnlaceCreado> {
  const { sourceType, sourceId, stageId, horas, createdBy, baseUrl } = opts;
  const enviar = opts.enviar !== false;

  if (!Number.isFinite(horas) || horas < 1 || horas > MAX_HORAS_ENLACE) {
    throw new Error(`La duración debe estar entre 1 hora y ${MAX_HORAS_ENLACE / 24} días.`);
  }
  /**
   * ⚠️ UN PROYECTO SIN ETAPA YA NO ES UN ERROR (2026-09-28).
   *
   * Antes aquí se exigía la etapa, y un proyecto sin plan —la mayoría de los pequeños— no
   * tenía forma de mandarle a su cliente un enlace de pago: solo podía pagarlo el cliente
   * CON cuenta. Fernando lo pidió para el proyecto de Imadexa, «en revisión» y sin plan.
   *
   * Sin etapa se cobra el proyecto entero, y QUIÉN decide si se puede es
   * `cotizarProyectoSinEtapas` (en revisión o completado, con importe por facturar y SIN
   * plan). Validarlo aquí también sería una segunda definición de «esto se puede cobrar».
   */
  const yaPagado = await cobroPagadoDe({ sourceType, sourceId, stageId });
  if (yaPagado) {
    throw new Error(sourceType === 'ticket' ? 'Este ticket ya fue pagado.'
      : stageId ? 'Esta etapa ya fue pagada.' : 'Este proyecto ya fue pagado.');
  }

  const proveedor = proveedorActivo();
  const cobrable = await cotizarCobro({ sourceType, sourceId, stageId }, proveedor.nombre);

  /**
   * El correo: el que manden, y si no, el del cliente asociado.
   *
   * ⚠️ CADA ORIGEN BUSCA EN SU TABLA, y el `sourceId` de una SUSCRIPCIÓN no es un número:
   * es «<id>-<AAAA-MM>». Antes esta consulta solo distinguía ticket de proyecto, así que
   * una suscripción caía en la rama de proyectos e intentaba convertir «1-2026-09» a
   * entero — reventando antes de llegar a ninguna validación. Por eso no se podían crear
   * enlaces de pago de una suscripción.
   */
  const { rows: [duenio] } = await pool.query(
    sourceType === 'ticket'
      ? `SELECT c.email AS client_email, m.name AS responsable
           FROM gcc_world.tickets t
           LEFT JOIN gcc_world.clients c ON c.id = t.client_id
           LEFT JOIN gcc_world.members m ON m.id = t.member_id
          WHERE t.id = ($1)::bigint`
      : sourceType === 'subscription'
      ? `SELECT COALESCE(c.email, s.client_email_sri) AS client_email, NULL AS responsable
           FROM gcc_world.subscriptions s
           LEFT JOIN gcc_world.clients c ON c.id = s.client_id
          WHERE s.id = (split_part($1, '-', 1))::bigint`
      : `SELECT c.email AS client_email, m.name AS responsable
           FROM gcc_world.projects p
           LEFT JOIN gcc_world.clients c ON c.id = p.client_id
           LEFT JOIN gcc_world.members m ON m.id = p.assigned_member_id
          WHERE p.id = ($1)::bigint`,
    [sourceId],
  );

  const email = String(opts.email || duenio?.client_email || '').trim();
  // Sin correo solo se puede GENERAR: la columna lo exige, pero para copiar el enlace a
  // mano no hace falta, y pedirlo sería un campo obligatorio que no sirve para nada.
  if (enviar && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(
      `Hace falta el correo del cliente: esta ${
        sourceType === 'ticket' ? 'ticket' : sourceType === 'subscription' ? 'suscripción' : 'proyecto'
      } no tiene uno asociado.`,
    );
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + horas * 3600_000);

  const { rows: [enlace] } = await pool.query(
    `INSERT INTO gcc_world.payment_links
       (token, source_type, source_id, stage_id, email, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    // Un correo mal escrito en un enlace que no se envía no se guarda: la pantalla de pago lo
    // usaría como destino de la factura.
    [token, sourceType, sourceId, stageId, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : '', expiresAt, createdBy],
  );

  const url = `${baseUrl}/pagar/${token}`;

  let correoEnviado = false;
  let avisoCorreo: string | null = null;
  if (enviar) try {
    await sendPaymentLinkEmail({
      email,
      projectTitle: cobrable.title,
      stageName: cobrable.conceptName,
      queSePaga: sourceType === 'ticket' ? 'este ticket'
        : sourceType === 'subscription' ? 'esta suscripción'
        : sourceType === 'product' ? 'este producto'
        : stageId ? 'esta etapa del proyecto' : 'el proyecto',
      neto: cobrable.neto,
      recargo: cobrable.recargo,
      total: cobrable.total,
      url,
      expiresAt,
      responsibleName: duenio?.responsable || null,
    });
    await pool.query(`UPDATE gcc_world.payment_links SET sent_at = NOW() WHERE id = $1`, [enlace.id]);
    correoEnviado = true;
  } catch (e: any) {
    // El enlace YA existe y es válido: que el correo falle no lo invalida. Se devuelve
    // igualmente para que el responsable pueda copiarlo y mandarlo por donde quiera.
    avisoCorreo = e.message;
    console.error('[pagos] no se pudo enviar el enlace de pago:', e.message);
  }

  return {
    id: Number(enlace.id),
    url, email, expiresAt,
    importes: { neto: cobrable.neto, recargo: cobrable.recargo, total: cobrable.total },
    correoEnviado, avisoCorreo,
  };
}

/** Revoca un enlace. No borra: el rastro de que existió y a quién se mandó importa. */
export async function revocarEnlace(sourceType: OrigenCobro, sourceId: string, linkId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.payment_links SET revoked_at = NOW()
      WHERE id = $1 AND source_type = $2 AND source_id = $3 AND revoked_at IS NULL`,
    [linkId, sourceType, sourceId],
  );
  return Boolean(rowCount);
}
