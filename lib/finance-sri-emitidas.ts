/**
 * ⭐ COTEJAR LAS FACTURAS EMITIDAS CONTRA EL SRI (Fernando, 2026-11-05: «que esté como botón permanente
 * en la pantalla de inicio»).
 *
 * El M1 consulta el mes elegido día por día, con la misma puerta que los gastos (`lib/finance-sri.ts`), y aquí
 * se compara con la plataforma. **Solo informa:** no toca facturas ni ingresos. Una diferencia con el SRI la
 * decide Fernando, porque corregirla puede ser un tema fiscal y no un dato que se pise solo.
 *
 * El WS público no sirve para esto: con facturas de hace meses contesta «error en la estructura de la clave»
 * aunque la clave esté bien (visto con la 001-021, de marzo de 2026). El portal es la fuente.
 */
import { pool } from '@/lib/db';
import { ensureSriTables, terminar, type EstadoTrabajo } from '@/lib/finance-sri';

export type EmitidaSri = { comprobante: string; clave: string; total: string };
export type DiaEmitido = { dia: string; ok: boolean; comprobantes: EmitidaSri[]; mensaje?: string };
export type FacturaPlataforma = { id: number; invoice_number: string | null; total: string | number; status: string; sri_status: string | null; access_key: string | null; cliente: string | null };

export type Diferencia = { numero: string; clave?: string; sri?: number; plataforma?: number; cliente?: string | null; estado?: string | null };
export type ResultadoEmitidas = {
  coinciden: number;
  /** Autorizadas en el SRI y anuladas aquí con nota de crédito: es lo normal, se cuentan aparte. */
  anuladas: number;
  /** En el SRI y no en la plataforma. */
  faltan: Diferencia[];
  importes: Diferencia[];
  /** En el SRI están autorizadas y aquí figuran de otra forma. */
  estados: Diferencia[];
  /** Autorizadas aquí con fecha de un día consultado, y el SRI no las lista. */
  soloPlataforma: Diferencia[];
  diasFallidos: string[];
  dias: number;
};

const numero = (c: string) => (c.match(/\d{3}-\d{3}-\d{9}/) || [''])[0];
const importe = (t: string | number) => Number(String(t).replace(',', '.')) || 0;
/** La fecha de emisión son los 8 primeros dígitos de la clave: `ddmmaaaa`. */
const diaDeClave = (c: string) => `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4, 8)}`;

export function compararEmitidas(dias: DiaEmitido[], plataforma: FacturaPlataforma[]): ResultadoEmitidas {
  const r: ResultadoEmitidas = { coinciden: 0, anuladas: 0, faltan: [], importes: [], estados: [], soloPlataforma: [], diasFallidos: dias.filter((d) => !d.ok).map((d) => d.dia), dias: dias.length };
  const porClave = new Map(plataforma.filter((f) => f.access_key).map((f) => [f.access_key as string, f]));
  // Por número, solo las que no tienen clave. El número se repite: la 001-001-000000001 existe en 2025 y
  // en marzo de 2026, porque la numeración se reinició. Con otra clave es otra factura, no otro importe.
  const porNumero = new Map(plataforma.filter((f) => f.invoice_number && !f.access_key).map((f) => [f.invoice_number as string, f]));
  const vistas = new Set<number>();

  for (const d of dias) {
    if (!d.ok) continue;
    for (const c of d.comprobantes) {
      const num = numero(c.comprobante);
      const f = porClave.get(c.clave) ?? porNumero.get(num);
      const sri = importe(c.total);
      if (!f) { r.faltan.push({ numero: num, clave: c.clave, sri }); continue; }
      vistas.add(Number(f.id));
      if (f.status === 'cancelled') { r.anuladas++; continue; }
      const aqui = importe(f.total);
      if (Math.abs(aqui - sri) > 0.009) { r.importes.push({ numero: num, sri, plataforma: aqui, cliente: f.cliente }); continue; }
      if (f.sri_status !== 'authorized') { r.estados.push({ numero: num, sri, plataforma: aqui, cliente: f.cliente, estado: f.sri_status }); continue; }
      r.coinciden++;
    }
  }

  // Solo se acusa a una factura de faltar en el SRI si su día se consultó bien.
  const consultados = new Set(dias.filter((d) => d.ok).map((d) => d.dia));
  for (const f of plataforma) {
    if (vistas.has(Number(f.id)) || f.status === 'cancelled' || f.sri_status !== 'authorized') continue;
    if (!/^\d{49}$/.test(f.access_key || '') || !consultados.has(diaDeClave(f.access_key as string))) continue;
    r.soloPlataforma.push({ numero: f.invoice_number || `#${f.id}`, plataforma: importe(f.total), cliente: f.cliente });
  }
  return r;
}

/** Los días del mes hasta hoy, en hora de Ecuador: el futuro no se consulta. */
export function diasDelMes(year: number, month: number, hoy: Date = new Date()): string[] {
  const ec = new Date(hoy.getTime() - 5 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dias: string[] = [];
  for (let d = 1; d <= ultimo; d++) {
    if (Date.UTC(year, month - 1, d) > Date.UTC(ec.getUTCFullYear(), ec.getUTCMonth(), ec.getUTCDate())) break;
    dias.push(`${pad(d)}/${pad(month)}/${year}`);
  }
  return dias;
}

export async function estadoEmitidas() {
  await ensureSriTables();
  const { rows: [t] } = await pool.query(
    `SELECT id, estado, creado_en, terminado_en, meses, resultado, mensaje
       FROM gcc_world.sri_sync_trabajos WHERE tipo = 'emitidos' ORDER BY id DESC LIMIT 1`,
  );
  const { rows: [c] } = await pool.query(
    `SELECT clave_cifrada IS NOT NULL AS clave, trabajador_visto_en FROM gcc_world.sri_sync_config WHERE id = 1`,
  );
  return { claveConfigurada: !!c?.clave, trabajadorVistoEn: c?.trabajador_visto_en ?? null, ultimo: t ? { ...t, id: Number(t.id) } : null };
}

export async function encolarEmitidas(pedidoPor: string, year: number, month: number) {
  await ensureSriTables();
  const { rows: [abierto] } = await pool.query(
    `SELECT id FROM gcc_world.sri_sync_trabajos WHERE tipo = 'emitidos' AND estado IN ('pendiente', 'en_curso') ORDER BY id DESC LIMIT 1`,
  );
  if (abierto) return { id: Number(abierto.id), yaEnCola: true };
  const dias = diasDelMes(year, month);
  if (!dias.length) throw new Error('Ese mes todavía no ha empezado.');
  const { rows: [n] } = await pool.query(
    `INSERT INTO gcc_world.sri_sync_trabajos (pedido_por, tipo, meses) VALUES ($1, 'emitidos', $2::jsonb) RETURNING id`,
    [pedidoPor, JSON.stringify([{ year, month, dias }])],
  );
  return { id: Number(n.id), yaEnCola: false };
}

/** Coteja lo que trajo el M1 y lo deja en el trabajo. Las facturas se leen sin modificarlas. */
export async function registrarEmitidas(id: number, dias: DiaEmitido[], error?: string | null) {
  await ensureSriTables();
  const { rows: [t] } = await pool.query(`SELECT estado, tipo FROM gcc_world.sri_sync_trabajos WHERE id = $1`, [id]);
  if (!t || t.estado !== 'en_curso' || t.tipo !== 'emitidos') throw new Error('Ese trabajo no está en curso.');

  const claves = dias.flatMap((d) => d.comprobantes.map((c) => c.clave)).filter((c) => /^\d{49}$/.test(c));
  const numeros = dias.flatMap((d) => d.comprobantes.map((c) => numero(c.comprobante))).filter(Boolean);
  const prefijos = dias.filter((d) => d.ok).map((d) => d.dia.replace(/\//g, ''));
  const { rows } = await pool.query(
    `SELECT id, invoice_number, total, status, sri_status, access_key, client_name_sri AS cliente
       FROM gcc_world.invoices
      WHERE access_key = ANY($1::text[]) OR invoice_number = ANY($2::text[]) OR LEFT(access_key, 8) = ANY($3::text[])`,
    [claves, numeros, prefijos],
  );
  const resultado = compararEmitidas(dias, rows);
  const captcha = /captcha/i.test(error || '') || dias.some((d) => /captcha/i.test(d.mensaje || ''));
  const fallo = !!error || resultado.diasFallidos.length > 0;
  const estado: EstadoTrabajo = !fallo ? 'hecho' : captcha ? 'captcha' : 'error';
  await pool.query(`UPDATE gcc_world.sri_sync_trabajos SET resultado = $2::jsonb WHERE id = $1`, [id, JSON.stringify(resultado)]);
  await terminar(id, estado, 0, error || (resultado.diasFallidos.length ? `No se pudieron consultar ${resultado.diasFallidos.length} días.` : null));
  return { estado };
}
