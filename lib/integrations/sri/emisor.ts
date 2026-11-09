import { pool } from '@/lib/db';
import { LEYENDA_REGIMEN, type Regimen, type EstadoEmisor } from './regimen';

/**
 * ⭐ EL EMISOR DE UN COMPROBANTE — fase 4, paso 3 del modelo económico (Fernando, 2026-11-09; MEMORIA.md ›
 * «EL MODELO ECONÓMICO DE LA PLATAFORMA» › «Reparto»).
 *
 * Hasta hoy había un solo emisor escrito en código (`SRI_CONFIG`). Ahora cada miembro o candidato tiene su cuenta
 * de emisor en `gcc_world.sri_emisores` (migración 089) y TODO lo que arma, firma, numera o pinta un comprobante
 * —xml-builder, access-key, credit-note-builder, ride-pdf, soap-client, xades-signer, detalle-servicios— recibe el
 * `Emisor` que toca. Nada de eso vuelve a leer una constante.
 *
 * GCC (Fernando) es la fila con `user_id` NULL y firma con el .p12 del entorno (`firmaDesdeEntorno`). Sus valores
 * son los de `SRI_CONFIG` al 2026-11-09, al carácter: está probado que el XML y la clave de acceso salen idénticos.
 *
 * Si la migración 089 aún no se aplicó (la tabla no existe), `cargarEmisor('gcc')` devuelve `EMISOR_GCC_RESPALDO`
 * —los mismos valores— y la numeración sigue con la consulta de siempre. Así el código puede desplegarse antes
 * que la migración sin cambiar nada para Fernando.
 */

export type { Regimen, EstadoEmisor } from './regimen';
export { LEYENDA_REGIMEN } from './regimen';
export type Ambiente = '1' | '2';
export type TipoDoc = '01' | '04';

export type Emisor = {
  /** `null` = el respaldo en código (la tabla todavía no existe). */
  id: number | null;
  /** `null` = GCC. */
  userId: string | null;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  dirMatriz: string;
  dirEstablecimiento: string;
  establecimiento: string;
  puntoEmision: string;
  obligadoContabilidad: 'SI' | 'NO';
  regimen: Regimen;
  /** La leyenda del régimen tal como va en el comprobante ('' en el general). */
  contribuyenteRimpe: string;
  agenteRetencion: string;
  contribuyenteEspecial: string;
  /** Régimen de microempresas: derogado por el RIMPE, nunca aplica. Se conserva por el XML de factura. */
  regimenMicroempresas: '';
  ambiente: Ambiente;
  tipoEmision: '1';
  moneda: 'DOLAR';
  cobraIva: boolean;
  /** `codigoPorcentaje` del SRI de la tarifa que cobra: '0' | '4' (15 %) | '5' (5 %). */
  tarifaIva: string;
  estado: EstadoEmisor;
  firmaDesdeEntorno: boolean;
};

/** GCC tal como estaba en `SRI_CONFIG` el 2026-11-09. Es la semilla de la migración 089 y el respaldo sin ella. */
export const EMISOR_GCC_RESPALDO: Emisor = Object.freeze({
  id: null,
  userId: null,
  ruc: '0930095922001',
  razonSocial: 'GONZALEZ MUYULEMA LUIS FERNANDO',
  nombreComercial: 'GRUPO CORAZONES CRUZADOS',
  dirMatriz: 'Barrio 7 Lagos, Calle Tabacundo #12, Guasmo Central',
  dirEstablecimiento: 'Barrio 7 Lagos, Calle Tabacundo #12, Guasmo Central',
  establecimiento: '001',
  puntoEmision: '001',
  obligadoContabilidad: 'NO',
  regimen: 'rimpe_negocio_popular',
  contribuyenteRimpe: LEYENDA_REGIMEN.rimpe_negocio_popular,
  agenteRetencion: '',
  contribuyenteEspecial: '',
  regimenMicroempresas: '',
  ambiente: '2',
  tipoEmision: '1',
  moneda: 'DOLAR',
  cobraIva: false,
  tarifaIva: '0',
  estado: 'activo',
  firmaDesdeEntorno: true,
}) as Emisor;

type Consulta = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

export const COLUMNAS_EMISOR = `id, user_id, ruc, razon_social, nombre_comercial, dir_matriz, dir_establecimiento, estab, pto_emi,
  obligado_contabilidad, regimen, leyenda_rimpe, agente_retencion, contribuyente_especial, ambiente, cobra_iva,
  tarifa_iva, estado, firma_desde_entorno`;

export function filaAEmisor(r: any): Emisor {
  return {
    id: Number(r.id),
    userId: r.user_id ?? null,
    ruc: r.ruc,
    razonSocial: r.razon_social,
    nombreComercial: r.nombre_comercial ?? '',
    dirMatriz: r.dir_matriz,
    dirEstablecimiento: r.dir_establecimiento,
    establecimiento: String(r.estab).trim(),
    puntoEmision: String(r.pto_emi).trim(),
    obligadoContabilidad: r.obligado_contabilidad ? 'SI' : 'NO',
    regimen: r.regimen,
    contribuyenteRimpe: r.leyenda_rimpe ?? '',
    agenteRetencion: r.agente_retencion ?? '',
    contribuyenteEspecial: r.contribuyente_especial ?? '',
    regimenMicroempresas: '',
    ambiente: String(r.ambiente).trim() === '2' ? '2' : '1',
    tipoEmision: '1',
    moneda: 'DOLAR',
    cobraIva: !!r.cobra_iva,
    tarifaIva: String(r.tarifa_iva ?? '0'),
    estado: r.estado,
    firmaDesdeEntorno: !!r.firma_desde_entorno,
  };
}

// ── Caché por proceso ────────────────────────────────────────────────────────────────────────────────────────
// Se invalida al guardar (`invalidarEmisor`) y, por si hay más de una instancia, caduca sola a los 5 minutos.
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { emisor: Emisor; hasta: number }>();
let tablaExiste: boolean | null = null;

export function invalidarEmisor(): void {
  cache.clear();
}

async function hayTabla(db: Consulta): Promise<boolean> {
  if (tablaExiste) return true;
  const { rows: [r] } = await db.query(`SELECT to_regclass('gcc_world.sri_emisores') IS NOT NULL AS hay`);
  // Solo se recuerda el «sí»: el «no» se vuelve a preguntar, para que aplicar la migración surta efecto sin reiniciar.
  if (r?.hay) tablaExiste = true;
  return !!r?.hay;
}

/**
 * El emisor `id`, o el de GCC con `'gcc'`. Lanza si no existe: emitir con otro emisor que el pedido sería peor que
 * no emitir. `db` permite leerlo dentro de una transacción (pruebas, y el paso 4).
 */
export async function cargarEmisor(id: number | 'gcc', db?: Consulta): Promise<Emisor> {
  const clave = String(id);
  if (!db) {
    const c = cache.get(clave);
    if (c && c.hasta > Date.now()) return c.emisor;
  }
  const conn = db ?? pool;
  if (!(await hayTabla(conn))) {
    if (id === 'gcc') return EMISOR_GCC_RESPALDO;
    throw new Error(`No existe el emisor ${id} (falta la migración 089)`);
  }
  const { rows: [r] } = id === 'gcc'
    ? await conn.query(`SELECT ${COLUMNAS_EMISOR} FROM gcc_world.sri_emisores WHERE user_id IS NULL LIMIT 1`)
    : await conn.query(`SELECT ${COLUMNAS_EMISOR} FROM gcc_world.sri_emisores WHERE id = $1`, [id]);
  if (!r) throw new Error(id === 'gcc' ? 'Falta la cuenta de emisor de GCC en sri_emisores' : `No existe el emisor ${id}`);
  const emisor = filaAEmisor(r);
  if (!db) cache.set(clave, { emisor, hasta: Date.now() + TTL_MS });
  return emisor;
}

/** El emisor de una factura ya guardada: el suyo, o GCC si no tiene (todas las anteriores a la migración 089). */
export function emisorDeFactura(factura: { emisor_id?: number | string | null }, db?: Consulta): Promise<Emisor> {
  return factura.emisor_id != null ? cargarEmisor(Number(factura.emisor_id), db) : cargarEmisor('gcc', db);
}

export const esGcc = (e: Emisor) => e.userId === null;

// ── La numeración ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * El número más alto YA USADO por el emisor en su serie, mirando lo guardado. Las facturas de GCC anteriores a la
 * migración no tienen `emisor_id`: cuentan como suyas. Es la misma consulta que hacía `getNextSecuencial` (y la
 * ruta de anular, para las notas de crédito), acotada al emisor y a su serie.
 */
async function maximoUsado(db: Consulta, e: Emisor, tipo: TipoDoc): Promise<number> {
  const serie = `${e.establecimiento}-${e.puntoEmision}-`;
  const delEmisor = esGcc(e) ? `(emisor_id IS NULL OR emisor_id = $2)` : `emisor_id = $2`;
  const { rows: [r] } = tipo === '01'
    ? await db.query(
        `SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)), 0) AS m
           FROM gcc_world.invoices WHERE invoice_number LIKE $1 || '%' AND ${delEmisor}`, [serie, e.id])
    : await db.query(
        `SELECT COALESCE(MAX(CAST(SPLIT_PART((sri_response::json->'credit_note'->>'numero'), '-', 4) AS INTEGER)), 0) AS m
           FROM gcc_world.invoices
          WHERE sri_response IS NOT NULL AND sri_response::text LIKE '%credit_note%'
            AND sri_response::text LIKE '%' || $1 || '%' AND ${delEmisor}`, [`NC-${serie}`, e.id]);
  return Number(r?.m) || 0;
}

/** Lo de antes de la migración 089, tal cual: la factura sigue al MAX global con mínimo 23; la nota de crédito, al suyo. */
async function siguienteSinTabla(db: Consulta, tipo: TipoDoc): Promise<number> {
  if (tipo === '01') {
    const { rows } = await db.query(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)), 0) + 1 as next
       FROM gcc_world.invoices`,
    );
    return Math.max(rows[0].next, 23);
  }
  const { rows: [{ next }] } = await db.query(
    `SELECT COALESCE(MAX(
              CAST(SPLIT_PART((sri_response::json->'credit_note'->>'numero'), '-', 4) AS INTEGER)
            ), 0) + 1 AS next
     FROM gcc_world.invoices
     WHERE sri_response IS NOT NULL
       AND sri_response::text LIKE '%credit_note%'`,
  );
  return Math.max(next, 1);
}

/**
 * TOMA EL SIGUIENTE NÚMERO de `emisor` para `tipo` y ejecuta `usar(numero, db)` con la fila del contador
 * bloqueada (`FOR UPDATE`) en una transacción con su propio cliente (gcc-pool-transaccion-un-cliente). Lo que
 * `usar` escribe con `db` (el INSERT de la factura) va en la MISMA transacción: si falla, el número no se gasta.
 *
 * Siguiente = GREATEST(ultimo, MAX ya emitido) + 1. Con el contador sembrado al MAX de hoy, para GCC da el mismo
 * número que la consulta de siempre; y si algo se emitiera por fuera del contador, el MAX lo cubre.
 *
 * `cliente`: una transacción ya abierta (se usa un SAVEPOINT dentro de ella en vez de abrir otra).
 */
export async function conSecuencial<T>(
  emisor: Emisor,
  tipo: TipoDoc,
  usar: (secuencial: number, db: Consulta) => Promise<T>,
  opciones: { cliente?: any } = {},
): Promise<T> {
  if (emisor.id === null) {
    // Sin la migración 089: exactamente lo de antes (sin candado, como era).
    const db = opciones.cliente ?? pool;
    return usar(await siguienteSinTabla(db, tipo), db);
  }

  const propio = !opciones.cliente;
  const cli = opciones.cliente ?? (await pool.connect());
  const abrir = propio ? 'BEGIN' : 'SAVEPOINT secuencial';
  const cerrar = propio ? 'COMMIT' : 'RELEASE SAVEPOINT secuencial';
  const deshacer = propio ? 'ROLLBACK' : 'ROLLBACK TO SAVEPOINT secuencial';
  try {
    await cli.query(abrir);
    const clave = [emisor.id, emisor.establecimiento, emisor.puntoEmision, tipo];
    await cli.query(
      `INSERT INTO gcc_world.sri_secuenciales (emisor_id, estab, pto_emi, tipo_doc, ultimo)
       VALUES ($1, $2, $3, $4, 0) ON CONFLICT DO NOTHING`, clave,
    );
    const { rows: [fila] } = await cli.query(
      `SELECT ultimo FROM gcc_world.sri_secuenciales
        WHERE emisor_id = $1 AND estab = $2 AND pto_emi = $3 AND tipo_doc = $4 FOR UPDATE`, clave,
    );
    const siguiente = Math.max(Number(fila.ultimo) || 0, await maximoUsado(cli, emisor, tipo)) + 1;
    const resultado = await usar(siguiente, cli);
    await cli.query(
      `UPDATE gcc_world.sri_secuenciales SET ultimo = GREATEST(ultimo, $5), updated_at = NOW()
        WHERE emisor_id = $1 AND estab = $2 AND pto_emi = $3 AND tipo_doc = $4`, [...clave, siguiente],
    );
    await cli.query(cerrar);
    return resultado;
  } catch (e) {
    await cli.query(deshacer).catch(() => {});
    throw e;
  } finally {
    if (propio) cli.release();
  }
}

/**
 * El siguiente número SIN gastarlo. Para la nota de crédito, que se numera, se envía al SRI y solo se guarda si
 * la autoriza (segundos de red: no se puede tener la fila bloqueada mientras tanto). Al autorizarse se anota con
 * `anotarSecuencialUsado`. Es lo que hacía la ruta de anular: un rechazo no gasta el número.
 */
export async function siguienteSecuencial(emisor: Emisor, tipo: TipoDoc, db: Consulta = pool): Promise<number> {
  if (emisor.id === null) return siguienteSinTabla(db, tipo);
  const { rows: [fila] } = await db.query(
    `SELECT ultimo FROM gcc_world.sri_secuenciales
      WHERE emisor_id = $1 AND estab = $2 AND pto_emi = $3 AND tipo_doc = $4`,
    [emisor.id, emisor.establecimiento, emisor.puntoEmision, tipo],
  );
  return Math.max(Number(fila?.ultimo) || 0, await maximoUsado(db, emisor, tipo)) + 1;
}

/** Deja constancia de que `numero` ya se usó (nunca baja el contador). */
export async function anotarSecuencialUsado(emisor: Emisor, tipo: TipoDoc, numero: number, db: Consulta = pool): Promise<void> {
  if (emisor.id === null) return;
  await db.query(
    `INSERT INTO gcc_world.sri_secuenciales (emisor_id, estab, pto_emi, tipo_doc, ultimo) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (emisor_id, estab, pto_emi, tipo_doc) DO UPDATE SET ultimo = GREATEST(gcc_world.sri_secuenciales.ultimo, EXCLUDED.ultimo), updated_at = NOW()`,
    [emisor.id, emisor.establecimiento, emisor.puntoEmision, tipo, numero],
  );
}
