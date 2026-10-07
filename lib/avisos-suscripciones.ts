import { pool } from '@/lib/db';
import { ensureSubscriptionTables, toYMD } from '@/lib/subscriptions';
import { createNotification } from '@/lib/notifications';
import { avisarUsuarios } from '@/lib/push/avisos';

/**
 * SUSCRIPCIONES POR VENCER → AVISO (Fernando, 2026-10-07).
 *
 * A quién: al CLIENTE que paga y a quien OFRECIÓ la suscripción. No hay columna de
 * «responsable»: se guarda el correo de quien la creó (`created_by`), y ese es. Si no
 * corresponde a ninguna cuenta, a los administradores — un cobro no se queda sin dueño.
 * El cliente se encuentra como en el resto de la plataforma: su cuenta enlazada
 * (`clients.user_id`) o, en las antiguas, por correo (`clients.email` / `client_email_sri`).
 *
 * Cuándo: el corte de cada mes es el día de `start_date` (recortado al último día del mes).
 * Etapas: a 7 días o menos («proximo»), el día anterior, el mismo día y, una vez, al vencer
 * (solo si venció hace 3 días o menos: al estrenar esto no puede llover un aviso por cada mes
 * viejo sin pagar). Cada etapa, una vez (`subscription_alerts`).
 *
 * El «hoy» es el de ECUADOR: el servidor corre en UTC, y a las 21:00 de Guayaquil ya es
 * mañana para él. Y solo de 8:00 a 20:00 de Ecuador: un cobro no despierta a nadie.
 *
 * Además del teléfono, deja el aviso en la campanita de la plataforma (`createNotification`).
 */

const ZONA = 'America/Guayaquil';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function hoyEcuador(): { y: number; m: number; d: number; hora: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hora: Number(p.hour) };
}
const diasDelMes = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dias = (a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }) =>
  Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86_400_000);

type Etapa = 'proximo' | 'manana' | 'hoy' | 'vencida';

/**
 * `simular`: no inserta ni envía; devuelve lo que enviaría HOY (y sin mirar la hora). Para
 * comprobar contra la base real sin avisar a nadie.
 */
export async function avisarSuscripcionesPorVencer(simular = false): Promise<{ revisadas: number; enviados: number; simulacion?: any[] }> {
  const hoy = hoyEcuador();
  if (!simular && (hoy.hora < 8 || hoy.hora >= 20)) return { revisadas: 0, enviados: 0 };
  const simulacion: any[] = [];
  await ensureSubscriptionTables();

  const { rows: subs } = await pool.query(
    `SELECT s.id, s.title, s.start_date, s.created_by, s.client_email_sri,
            c.user_id AS cliente_user_id, c.email AS cliente_email
       FROM gcc_world.subscriptions s
       LEFT JOIN gcc_world.clients c ON c.id = s.client_id
      WHERE s.status = 'active'`,
  );
  let enviados = 0;

  for (const s of subs) {
    const inicio = toYMD(s.start_date).split('-').map(Number);
    const corte = inicio[2];
    const { rows: pagos } = await pool.query(
      `SELECT period FROM gcc_world.subscription_payments WHERE subscription_id = $1 AND paid = true`, [s.id],
    );
    const pagados = new Set(pagos.map((p: any) => toYMD(p.period).slice(0, 7)));

    // Del mes de inicio al mes que viene (el corte del mes próximo puede caer en 7 días).
    const avisos: { periodo: string; etapa: Etapa; vence: { y: number; m: number; d: number } }[] = [];
    let y = inicio[0], m = inicio[1];
    const fin = (hoy.m === 12 ? hoy.y + 1 : hoy.y) * 12 + (hoy.m === 12 ? 0 : hoy.m);
    while (y * 12 + (m - 1) <= fin) {
      const clave = `${y}-${String(m).padStart(2, '0')}`;
      const vence = { y, m, d: Math.min(corte, diasDelMes(y, m)) };
      const faltan = dias(vence, hoy);
      if (!pagados.has(clave)) {
        let etapa: Etapa | null = null;
        if (faltan < 0 && faltan >= -3) etapa = 'vencida';
        else if (faltan === 0) etapa = 'hoy';
        else if (faltan === 1) etapa = 'manana';
        else if (faltan >= 2 && faltan <= 7) etapa = 'proximo';
        if (etapa) avisos.push({ periodo: `${clave}-01`, etapa, vence });
      }
      m++; if (m > 12) { m = 1; y++; }
    }
    if (!avisos.length) continue;

    const destinatarios = await quienes(s);
    for (const a of avisos) {
      if (simular) {
        const { rows: ya } = await pool.query(
          `SELECT 1 FROM gcc_world.subscription_alerts WHERE subscription_id = $1 AND period = $2 AND stage = $3`,
          [s.id, a.periodo, a.etapa],
        );
        simulacion.push({ suscripcion: s.id, titulo: s.title, periodo: a.periodo, etapa: a.etapa, yaEnviado: ya.length > 0,
          clientes: destinatarios.clientes.length, responsables: destinatarios.responsables.length });
        continue;
      }
      const { rowCount } = await pool.query(
        `INSERT INTO gcc_world.subscription_alerts (subscription_id, period, stage) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [s.id, a.periodo, a.etapa],
      );
      if (!rowCount) continue; // ya salió
      const fecha = `${a.vence.d} de ${MESES[a.vence.m - 1]}`;
      const cuando = a.etapa === 'vencida' ? `venció el ${fecha}`
        : a.etapa === 'hoy' ? 'vence hoy'
        : a.etapa === 'manana' ? 'vence mañana'
        : `vence el ${fecha}`;
      const ruta = '/dashboard/subscriptions';
      const alCliente = { titulo: 'Tu suscripción ' + cuando, cuerpo: `«${s.title}» · ${fecha}. Págala para no perder el servicio.`, ruta };
      const alResponsable = { titulo: `Suscripción por cobrar: ${cuando}`, cuerpo: `«${s.title}» · ${fecha}.`, ruta };
      await Promise.all([
        avisarUsuarios(destinatarios.clientes, alCliente),
        avisarUsuarios(destinatarios.responsables, alResponsable),
        // La campanita no puede tumbar el resto: la fila de `subscription_alerts` ya está puesta.
        ...destinatarios.clientes.map((u) => createNotification(u, { type: 'subscription', title: alCliente.titulo, message: alCliente.cuerpo, link: ruta }).catch((e) => console.error('Campanita (suscripción):', e?.message))),
        ...destinatarios.responsables.map((u) => createNotification(u, { type: 'subscription', title: alResponsable.titulo, message: alResponsable.cuerpo, link: ruta }).catch((e) => console.error('Campanita (suscripción):', e?.message))),
      ]);
      enviados++;
    }
  }
  return { revisadas: subs.length, enviados, ...(simular ? { simulacion } : {}) };
}

async function quienes(s: any): Promise<{ clientes: string[]; responsables: string[] }> {
  const correosCliente = [s.cliente_email, s.client_email_sri].filter(Boolean).map((e: string) => e.toLowerCase());
  const { rows: cli } = await pool.query(
    `SELECT id FROM gcc_world.users WHERE id = $1::uuid OR LOWER(email) = ANY($2::text[])`,
    [s.cliente_user_id || null, correosCliente],
  );
  let { rows: resp } = await pool.query(
    `SELECT id FROM gcc_world.users WHERE LOWER(email) = LOWER($1)`, [s.created_by || ''],
  );
  if (!resp.length) resp = (await pool.query(`SELECT id FROM gcc_world.users WHERE role = 'admin'`)).rows;
  const clientes = cli.map((r: any) => String(r.id));
  // Si quien ofreció es también el cliente (raro), que no reciba los dos textos.
  const responsables = resp.map((r: any) => String(r.id)).filter((id: string) => !clientes.includes(id));
  return { clientes, responsables };
}
