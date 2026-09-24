import { pool } from './db';

/**
 * LA SUSCRIPCIÓN DEL CLIENTE, LEÍDA DE LA PLATAFORMA.
 *
 * ── POR QUÉ SE LEE Y NO SE COPIA (Fernando, 2026-09-23) ──────────────────────────
 * «Es la misma, enlázala, para que pagar aquí o en el módulo de suscripciones sea lo
 * mismo». Copiar el estado de allí a la columna `pagado_hasta` de aquí habría sido más
 * fácil y habría durado hasta el primer pago que alguien registrara sin que el otro lado
 * se enterara: el cliente viendo «pagado» en una pantalla y «debiendo» en la otra, y
 * nadie sabiendo cuál miente.
 *
 * Así que hay **un solo dueño** —la plataforma, que es donde se factura— y el producto
 * lee. Es la misma tubería que ya usa `cuentaGcc.ts` para la contraseña, y por los mismos
 * motivos: misma base, solo lectura, y acotado a lo que hace falta.
 *
 * ── EL MES DE ESPERA ─────────────────────────────────────────────────────────────
 * «Máximo le podemos esperar 1 mes al cliente para que pague, caso contrario el tenant
 * debe bloquearse». Así que el acceso no se corta el día del corte: se corta **un mes
 * después** del último periodo pagado. Un cliente que paga con unos días de retraso no se
 * queda sin servicio; uno que lleva dos meses sin pagar, sí.
 */

export type EstadoSuscripcionGcc = {
  /** La suscripción en `gcc_world.subscriptions`. */
  id: number;
  titulo: string;
  costoMensual: number;
  moneda: string;
  /** 'active' | 'paused' | 'cancelled' — lo que diga la plataforma. */
  estado: string;
  /** El último periodo PAGADO, como 'AAAA-MM'. Nulo si no ha pagado ninguno. */
  ultimoPagado: string | null;
  /** El periodo que toca pagar ahora, como 'AAAA-MM'. */
  periodoActual: string;
  /** ¿Está pagado el periodo en curso? */
  alDiaEsteMes: boolean;
  /** Hasta cuándo llega lo pagado: el último día del último mes pagado. */
  cubiertoHasta: Date | null;
  /** Cuándo se cierra la puerta: un mes después de `cubiertoHasta`. */
  seBloqueaEl: Date | null;
  /** Días de retraso sobre el fin del mes cubierto. 0 si está al día. */
  diasDeRetraso: number;
  /** Los periodos que faltan por pagar, del más antiguo al más nuevo. */
  pendientes: string[];
  /** Un cobro ya subido esperando que alguien lo confirme. */
  esperandoConfirmacion: { intentId: number; periodo: string; subidoEl: Date | null } | null;
};

const periodoDe = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const finDeMes = (periodo: string) => {
  const [a, m] = periodo.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0, 23, 59, 59));
};
const sumaMeses = (d: Date, n: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate(), 23, 59, 59));

/** Todos los periodos entre dos, inclusive. */
function periodosEntre(desde: string, hasta: string): string[] {
  const [a1, m1] = desde.split('-').map(Number);
  const [a2, m2] = hasta.split('-').map(Number);
  const salida: string[] = [];
  for (let a = a1, m = m1; a < a2 || (a === a2 && m <= m2); m === 12 ? (m = 1, a++) : m++) {
    salida.push(`${a}-${String(m).padStart(2, '0')}`);
  }
  return salida;
}

export async function estadoSuscripcionGcc(suscripcionId: number): Promise<EstadoSuscripcionGcc | null> {
  const { rows: [s] } = await pool.query(
    `SELECT id, title, monthly_cost, currency, status, start_date
       FROM gcc_world.subscriptions WHERE id = $1`,
    [suscripcionId],
  );
  if (!s) return null;

  const { rows: pagos } = await pool.query(
    `SELECT to_char(period, 'YYYY-MM') AS periodo
       FROM gcc_world.subscription_payments
      WHERE subscription_id = $1 AND paid
      ORDER BY period`,
    [suscripcionId],
  );
  const pagados = new Set(pagos.map((p: { periodo: string }) => p.periodo));
  const ultimoPagado = pagos.length ? pagos[pagos.length - 1].periodo : null;

  const hoy = new Date();
  const periodoActual = periodoDe(hoy);
  const inicio = s.start_date ? periodoDe(new Date(s.start_date)) : periodoActual;

  // Lo que falta por pagar desde que empezó la suscripción hasta el mes en curso.
  const pendientes = periodosEntre(inicio, periodoActual).filter((p) => !pagados.has(p));

  const cubiertoHasta = ultimoPagado ? finDeMes(ultimoPagado) : null;
  const seBloqueaEl = cubiertoHasta ? sumaMeses(cubiertoHasta, 1) : null;
  const diasDeRetraso = cubiertoHasta && hoy > cubiertoHasta
    ? Math.floor((hoy.getTime() - cubiertoHasta.getTime()) / 86_400_000)
    : 0;

  // Un comprobante ya subido y a la espera. `source_id` de una suscripción es
  // «<id>-<AAAA-MM>» (ver `partesMesSuscripcion` en la plataforma).
  const { rows: [espera] } = await pool.query(
    `SELECT id, source_id, proof_at
       FROM gcc_world.payment_intents
      WHERE source_type = 'subscription' AND source_id LIKE $1 || '-%' AND status = 'awaiting'
      ORDER BY id DESC LIMIT 1`,
    [String(suscripcionId)],
  );

  return {
    id: s.id,
    titulo: s.title,
    costoMensual: Number(s.monthly_cost ?? 0),
    moneda: s.currency ?? 'USD',
    estado: s.status,
    ultimoPagado,
    periodoActual,
    alDiaEsteMes: pagados.has(periodoActual),
    cubiertoHasta,
    seBloqueaEl,
    diasDeRetraso,
    pendientes,
    esperandoConfirmacion: espera
      ? {
          intentId: espera.id,
          periodo: String(espera.source_id).slice(String(suscripcionId).length + 1),
          subidoEl: espera.proof_at ?? null,
        }
      : null,
  };
}

/**
 * ¿Se le abre la puerta?
 *
 * Se le espera **un mes entero** desde el fin del último periodo pagado. Pasado eso, se
 * bloquea. Si nunca ha pagado nada, se mira la fecha de alta con la misma regla: un
 * cliente recién dado de alta tiene su primer mes para pagar.
 */
export function accesoSegunGcc(e: EstadoSuscripcionGcc | null): 'ok' | 'vencido' | 'suspendido' | 'sin-pago' {
  if (!e) return 'sin-pago';
  if (e.estado === 'cancelled') return 'suspendido';
  if (!e.cubiertoHasta) return 'sin-pago';
  if (!e.seBloqueaEl) return 'sin-pago';
  return new Date() <= e.seBloqueaEl ? 'ok' : 'vencido';
}
