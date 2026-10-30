/**
 * ⭐ LOS GASTOS DEL SRI, AL PULSAR UN BOTÓN (Fernando, 2026-10-30: «algún botón que ejecute la
 * actualización de los gastos del SRI, para las fechas no revisadas todavía»).
 *
 * El SRI no tiene API para listar los comprobantes RECIBIDOS, y su pantalla de recibidos lleva un
 * reCAPTCHA invisible que rechaza a un Chrome sin ventana. Railway no puede abrir una ventana, así
 * que el trabajo lo hace el M1 de Fernando (`services/m1-sri/`), que tiene sesión de macOS iniciada:
 *
 *   1. El botón del Inicio deja un trabajo «pendiente» (`encolarSincronizacion`).
 *   2. El M1 pregunta cada 30 s (`/api/finance/sri/trabajador`, con su token). Al tomarlo recibe
 *      el RUC, la clave descifrada y los MESES NO REVISADOS (`mesesPendientes`).
 *   3. Abre Chrome, consulta mes a mes facturas y notas de crédito, y devuelve las filas.
 *   4. `registrarResultado` carga lo nuevo como egresos `sri_recibida` (la clave de acceso es el
 *      origen: lo repetido se descarta solo) y marca los meses como revisados.
 *
 * Un mes queda REVISADO cuando se consultó pasados 15 días de su cierre: hasta entonces todavía
 * pueden llegar comprobantes con fecha de ese mes, así que el mes en curso y el anterior (hasta el
 * día 15) se vuelven a mirar siempre.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { pool } from '@/lib/db';
import { cifrar, descifrar } from '@/lib/cifrado';
import { ensureFinanceTables, ensureMonth, recalcMonth } from '@/lib/finance';

export const RUC_SRI = '0930095922001';
const CONTEXTO_CLAVE = 'sri:clave-principal';
/** Primer mes que se sincroniza: el SRI se barrió a mano desde enero de 2025 (2026-10-30). */
const DESDE = { year: 2025, month: 1 };
/** Un trabajo «en curso» que no responde en este tiempo se da por perdido y vuelve a la cola. */
const MINUTOS_PERDIDO = 30;

let tablasListas: Promise<void> | null = null;
/** DDL una sola vez por proceso, no en cada petición (ver la memoria «listas sin DDL»). */
export function ensureSriTables(): Promise<void> {
  tablasListas ??= (async () => {
    await ensureFinanceTables();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gcc_world.sri_sync_config (
        id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        clave_cifrada TEXT,
        clave_actualizada_en TIMESTAMPTZ,
        trabajador_token_hash TEXT,
        trabajador_visto_en TIMESTAMPTZ
      );
      INSERT INTO gcc_world.sri_sync_config (id) VALUES (1) ON CONFLICT DO NOTHING;
      CREATE TABLE IF NOT EXISTS gcc_world.sri_sync_trabajos (
        id SERIAL PRIMARY KEY,
        pedido_por TEXT,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        tomado_en TIMESTAMPTZ,
        terminado_en TIMESTAMPTZ,
        meses JSONB,
        nuevos INT,
        mensaje TEXT
      );
      CREATE TABLE IF NOT EXISTS gcc_world.sri_sync_meses (
        year INT NOT NULL,
        month INT NOT NULL,
        revisado_en TIMESTAMPTZ NOT NULL,
        comprobantes INT NOT NULL DEFAULT 0,
        PRIMARY KEY (year, month)
      );
    `);
  })().catch((e) => { tablasListas = null; throw e; });
  return tablasListas;
}

export type Mes = { year: number; month: number };
export type EstadoTrabajo = 'pendiente' | 'en_curso' | 'hecho' | 'error' | 'captcha';

/** Los meses que todavía no se pueden dar por revisados, del más antiguo al actual (hora de Ecuador). */
export async function mesesPendientes(): Promise<Mes[]> {
  await ensureSriTables();
  const { rows } = await pool.query(
    `WITH hoy AS (SELECT (NOW() AT TIME ZONE 'America/Guayaquil')::date AS d),
          meses AS (
            SELECT generate_series(make_date($1, $2, 1), date_trunc('month', (SELECT d FROM hoy))::date, interval '1 month')::date AS inicio
          )
     SELECT EXTRACT(YEAR FROM m.inicio)::int AS year, EXTRACT(MONTH FROM m.inicio)::int AS month
       FROM meses m
       LEFT JOIN gcc_world.sri_sync_meses r
              ON r.year = EXTRACT(YEAR FROM m.inicio) AND r.month = EXTRACT(MONTH FROM m.inicio)
      WHERE r.revisado_en IS NULL
         OR (r.revisado_en AT TIME ZONE 'America/Guayaquil')::date < (m.inicio + interval '1 month' + interval '14 days')::date
      ORDER BY m.inicio`,
    [DESDE.year, DESDE.month],
  );
  return rows.map((r: any) => ({ year: Number(r.year), month: Number(r.month) }));
}

export async function claveConfigurada(): Promise<boolean> {
  await ensureSriTables();
  const { rows: [c] } = await pool.query(`SELECT clave_cifrada IS NOT NULL AS ok FROM gcc_world.sri_sync_config WHERE id = 1`);
  return !!c?.ok;
}

export async function guardarClave(clave: string): Promise<void> {
  await ensureSriTables();
  await pool.query(
    `UPDATE gcc_world.sri_sync_config SET clave_cifrada = $1, clave_actualizada_en = NOW() WHERE id = 1`,
    [cifrar(clave, CONTEXTO_CLAVE)],
  );
}

/** Lo que enseña el Inicio: el último trabajo, si el M1 está atento y qué falta por revisar. */
export async function estadoSincronizacion() {
  await ensureSriTables();
  const { rows: [c] } = await pool.query(
    `SELECT clave_cifrada IS NOT NULL AS clave, clave_actualizada_en, trabajador_visto_en,
            trabajador_token_hash IS NOT NULL AS trabajador
       FROM gcc_world.sri_sync_config WHERE id = 1`,
  );
  const { rows: [t] } = await pool.query(
    `SELECT id, estado, creado_en, tomado_en, terminado_en, meses, nuevos, mensaje
       FROM gcc_world.sri_sync_trabajos ORDER BY id DESC LIMIT 1`,
  );
  return {
    claveConfigurada: !!c?.clave,
    claveActualizadaEn: c?.clave_actualizada_en ?? null,
    trabajadorInstalado: !!c?.trabajador,
    trabajadorVistoEn: c?.trabajador_visto_en ?? null,
    ultimo: t ? { ...t, id: Number(t.id) } : null,
    pendientes: await mesesPendientes(),
  };
}

/** Deja un trabajo en la cola. Si ya hay uno esperando o en curso, devuelve ese: pulsar dos veces no duplica. */
export async function encolarSincronizacion(pedidoPor: string) {
  await ensureSriTables();
  const { rows: [abierto] } = await pool.query(
    `SELECT id FROM gcc_world.sri_sync_trabajos WHERE estado IN ('pendiente', 'en_curso') ORDER BY id DESC LIMIT 1`,
  );
  if (abierto) return { id: Number(abierto.id), yaEnCola: true };
  const { rows: [n] } = await pool.query(
    `INSERT INTO gcc_world.sri_sync_trabajos (pedido_por) VALUES ($1) RETURNING id`, [pedidoPor],
  );
  return { id: Number(n.id), yaEnCola: false };
}

// ── El trabajador (M1) ────────────────────────────────────────────────────────────────

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

/** Crea (o rota) el token del M1. Se guarda solo su huella; el token se enseña una vez. */
export async function nuevoTokenTrabajador(): Promise<string> {
  await ensureSriTables();
  const token = randomBytes(32).toString('base64url');
  await pool.query(`UPDATE gcc_world.sri_sync_config SET trabajador_token_hash = $1 WHERE id = 1`, [hash(token)]);
  return token;
}

/** ¿Es el M1? Compara huellas en tiempo constante y, si lo es, anota que está atento. */
export async function esTrabajador(authorization: string | null): Promise<boolean> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  await ensureSriTables();
  const { rows: [c] } = await pool.query(`SELECT trabajador_token_hash AS h FROM gcc_world.sri_sync_config WHERE id = 1`);
  if (!c?.h) return false;
  const a = Buffer.from(hash(token)), b = Buffer.from(String(c.h));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  await pool.query(`UPDATE gcc_world.sri_sync_config SET trabajador_visto_en = NOW() WHERE id = 1`);
  return true;
}

/**
 * El M1 toma el trabajo más antiguo de la cola. Recibe la clave DESCIFRADA (viaja por HTTPS y no
 * se guarda en el M1) y los meses que tiene que consultar. `null` si no hay nada que hacer.
 */
export async function tomarTrabajo(): Promise<{ id: number; ruc: string; clave: string; meses: Mes[] } | null> {
  await ensureSriTables();
  // Un trabajo que se quedó «en curso» (el M1 se apagó a medias) vuelve a la cola.
  await pool.query(
    `UPDATE gcc_world.sri_sync_trabajos SET estado = 'pendiente', tomado_en = NULL
      WHERE estado = 'en_curso' AND tomado_en < NOW() - ($1 || ' minutes')::interval`,
    [String(MINUTOS_PERDIDO)],
  );
  const { rows: [c] } = await pool.query(`SELECT clave_cifrada FROM gcc_world.sri_sync_config WHERE id = 1`);
  const meses = await mesesPendientes();
  const { rows: [t] } = await pool.query(
    `UPDATE gcc_world.sri_sync_trabajos SET estado = 'en_curso', tomado_en = NOW(), meses = $1
      WHERE id = (SELECT id FROM gcc_world.sri_sync_trabajos WHERE estado = 'pendiente'
                   ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING id`,
    [JSON.stringify(meses)],
  );
  if (!t) return null;
  if (!c?.clave_cifrada) {
    await terminar(Number(t.id), 'error', 0, 'Falta la clave del SRI: guárdala desde el botón del Inicio.');
    return null;
  }
  return { id: Number(t.id), ruc: RUC_SRI, clave: descifrar(c.clave_cifrada, CONTEXTO_CLAVE), meses };
}

async function terminar(id: number, estado: EstadoTrabajo, nuevos: number, mensaje: string | null) {
  await pool.query(
    `UPDATE gcc_world.sri_sync_trabajos SET estado = $2, terminado_en = NOW(), nuevos = $3, mensaje = $4 WHERE id = $1`,
    [id, estado, nuevos, mensaje],
  );
}

/** Una fila de la consulta de recibidos, tal como la lee el M1. */
export type ComprobanteRecibido = {
  tipo: 1 | 3;            // 1 factura, 3 nota de crédito
  emisor: string;          // «0993032158001 PACHAKAY S.A.S.»
  comprobante: string;     // «Factura 001-003-000004770»
  clave: string;           // clave de acceso (49 dígitos)
  total: string;           // «50.0»
};
export type ResultadoMes = Mes & { ok: boolean; comprobantes: ComprobanteRecibido[]; mensaje?: string };

/**
 * Carga lo que trajo el M1. Cada comprobante es un egreso `sri_recibida` en el mes CONSULTADO (la
 * consulta del SRI filtra por fecha de emisión); una nota de crédito resta. Lo repetido lo descarta
 * el índice único de origen. Solo se marcan revisados los meses que se consultaron bien.
 */
export async function registrarResultado(id: number, meses: ResultadoMes[], error?: string | null) {
  await ensureSriTables();
  const { rows: [t] } = await pool.query(`SELECT estado FROM gcc_world.sri_sync_trabajos WHERE id = $1`, [id]);
  if (!t || t.estado !== 'en_curso') throw new Error('Ese trabajo no está en curso.');

  let nuevos = 0;
  const tocados = new Set<number>();
  for (const m of meses) {
    if (!m.ok) continue;
    const monthId = await ensureMonth(m.year, m.month);
    for (const c of m.comprobantes) {
      if (!/^\d{49}$/.test(c.clave)) continue;
      const total = Math.abs(Number(String(c.total).replace(',', '.')) || 0);
      const emisor = c.emisor.replace(/^\d{10,13}\s+/, '').trim();
      const { rowCount } = await pool.query(
        `INSERT INTO gcc_world.finance_items (month_id, type, description, amount, sort_order, source_type, source_id)
         VALUES ($1, 'expense', $2, $3,
                 (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM gcc_world.finance_items WHERE month_id = $1),
                 'sri_recibida', $4)
         ON CONFLICT (source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL DO NOTHING`,
        [monthId, `${c.comprobante} — ${emisor}`, c.tipo === 3 ? -total : total, c.clave],
      );
      if (rowCount) { nuevos++; tocados.add(monthId); }
    }
    await pool.query(
      `INSERT INTO gcc_world.sri_sync_meses (year, month, revisado_en, comprobantes) VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (year, month) DO UPDATE SET revisado_en = NOW(), comprobantes = EXCLUDED.comprobantes`,
      [m.year, m.month, m.comprobantes.length],
    );
  }
  for (const monthId of tocados) await recalcMonth(monthId);

  const fallidos = meses.filter((m) => !m.ok);
  const captcha = fallidos.some((m) => /captcha/i.test(m.mensaje || '')) || /captcha/i.test(error || '');
  const estado: EstadoTrabajo = error ? (captcha ? 'captcha' : 'error') : fallidos.length ? (captcha ? 'captcha' : 'error') : 'hecho';
  const mensaje = error
    || (fallidos.length
      ? `No se pudieron revisar ${fallidos.map((m) => `${String(m.month).padStart(2, '0')}/${m.year}`).join(', ')}: ${fallidos[0].mensaje || 'error del SRI'}`
      : null);
  await terminar(id, estado, nuevos, mensaje);
  return { estado, nuevos };
}

/** El 2026-10-30 se barrieron a mano enero de 2025 a octubre de 2026: esos meses ya están vistos ese día. */
export async function sembrarMesesRevisados(hasta: Mes, en: string) {
  await ensureSriTables();
  await pool.query(
    `INSERT INTO gcc_world.sri_sync_meses (year, month, revisado_en, comprobantes)
     SELECT EXTRACT(YEAR FROM d)::int, EXTRACT(MONTH FROM d)::int, $3::timestamptz,
            (SELECT count(*) FROM gcc_world.finance_items fi JOIN gcc_world.finance_months fm ON fm.id = fi.month_id
              WHERE fi.source_type = 'sri_recibida' AND fm.year = EXTRACT(YEAR FROM d) AND fm.month = EXTRACT(MONTH FROM d))
       FROM generate_series(make_date($1, $2, 1), make_date($4, $5, 1), interval '1 month') d
     ON CONFLICT (year, month) DO NOTHING`,
    [DESDE.year, DESDE.month, en, hasta.year, hasta.month],
  );
}
