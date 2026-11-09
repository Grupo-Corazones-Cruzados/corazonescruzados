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

/**
 * El emisor de una factura ya guardada: el suyo, o GCC si no tiene (todas las anteriores a la migración 089).
 *
 * ⚠️ CON EL AMBIENTE DE LA FACTURA, no el que tenga hoy el emisor (paso 4). Una factura emitida mientras el miembro
 * estaba `en_pruebas` se firmó para el ambiente 1, y así se reenvía, se consulta y se anula aunque el emisor ya
 * esté `activo` (ambiente 2). `sri_ambiente` NULL = producción, que es lo que son todas las anteriores.
 */
export async function emisorDeFactura(
  factura: { emisor_id?: number | string | null; sri_ambiente?: string | null },
  db?: Consulta,
): Promise<Emisor> {
  const e = factura.emisor_id != null ? await cargarEmisor(Number(factura.emisor_id), db) : await cargarEmisor('gcc', db);
  const amb = factura.sri_ambiente != null ? String(factura.sri_ambiente).trim() : null;
  return amb === '1' || amb === '2' ? (amb === e.ambiente ? e : { ...e, ambiente: amb }) : e;
}

/** El ambiente en el que emite un emisor: el de pruebas mientras está `en_pruebas`, el suyo si está `activo`. */
export function ambienteDeEmision(e: Emisor): Ambiente {
  return e.estado === 'en_pruebas' ? '1' : e.ambiente;
}

/**
 * ⭐ LA CUENTA DE EMISOR CON LA QUE FACTURA UN USUARIO (paso 4), o `null` si todavía factura GCC por él.
 *
 * Solo una cuenta `activo` (producción), con firma registrada y sin vencer, y que no sea de GCC. Una `en_pruebas`
 * NO se lleva la factura de un cobro real (2026-11-09): saldría en el ambiente 1 del SRI y el cliente, que pagó de
 * verdad, se quedaría sin comprobante válido de esa parte; mientras tanto la factura GCC por él.
 */
export async function emisorHabilitadoDe(userId: string, db: Consulta = pool): Promise<Emisor | null> {
  if (!(await hayTabla(db))) return null;
  const { rows: [r] } = await db.query(
    `SELECT ${COLUMNAS_EMISOR} FROM gcc_world.sri_emisores
      WHERE user_id = $1::uuid AND estado = 'activo' AND NOT firma_desde_entorno
        AND p12_enc IS NOT NULL AND p12_ruc_coincide IS DISTINCT FROM false
        AND (p12_vence IS NULL OR p12_vence > (NOW() AT TIME ZONE 'America/Guayaquil')::date)
      LIMIT 1`,
    [userId],
  );
  if (!r) return null;
  const e = filaAEmisor(r);
  const amb = ambienteDeEmision(e);
  return amb === e.ambiente ? e : { ...e, ambiente: amb };
}

export const esGcc = (e: Emisor) => e.userId === null;

// ── La numeración ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ¿Ya se aplicó la migración 090 (numeración por ambiente)? Hasta entonces el contador y el MAX no miran el
 * ambiente, exactamente como antes, y nadie emite en pruebas (el reparto en facturas de miembros la exige).
 */
let hay090: boolean | null = null;
export async function numeracionPorAmbiente(db: Consulta = pool): Promise<boolean> {
  if (hay090) return true;
  const { rows: [r] } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'gcc_world' AND table_name = 'sri_secuenciales' AND column_name = 'ambiente') AS hay`,
  );
  if (r?.hay) hay090 = true;
  return !!r?.hay;
}

/**
 * El número más alto YA USADO por el emisor en su serie, mirando lo guardado. Las facturas de GCC anteriores a la
 * migración no tienen `emisor_id`: cuentan como suyas. Es la misma consulta que hacía `getNextSecuencial` (y la
 * ruta de anular, para las notas de crédito), acotada al emisor y a su serie.
 */
async function maximoUsado(db: Consulta, e: Emisor, tipo: TipoDoc): Promise<number> {
  const serie = `${e.establecimiento}-${e.puntoEmision}-`;
  const delEmisor = esGcc(e) ? `(emisor_id IS NULL OR emisor_id = $2)` : `emisor_id = $2`;
  // Con la 090, solo lo del MISMO ambiente: las de pruebas no empujan la numeración de producción ni al revés.
  // Todas las facturas anteriores tienen `sri_ambiente` NULL (= producción): para GCC el MAX es el de siempre.
  const porAmbiente = await numeracionPorAmbiente(db);
  const delAmbiente = porAmbiente ? ` AND COALESCE(sri_ambiente, '2') = $3` : '';
  const params = porAmbiente ? [e.id, e.ambiente] : [e.id];
  const { rows: [r] } = tipo === '01'
    ? await db.query(
        `SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)), 0) AS m
           FROM gcc_world.invoices WHERE invoice_number LIKE $1 || '%' AND ${delEmisor}${delAmbiente}`, [serie, ...params])
    : await db.query(
        `SELECT COALESCE(MAX(CAST(SPLIT_PART((sri_response::json->'credit_note'->>'numero'), '-', 4) AS INTEGER)), 0) AS m
           FROM gcc_world.invoices
          WHERE sri_response IS NOT NULL AND sri_response::text LIKE '%credit_note%'
            AND sri_response::text LIKE '%' || $1 || '%' AND ${delEmisor}${delAmbiente}`, [`NC-${serie}`, ...params]);
  return Number(r?.m) || 0;
}

/** La clave de la fila del contador: con la 090 lleva el ambiente. */
async function claveContador(db: Consulta, emisor: Emisor, tipo: TipoDoc) {
  const porAmbiente = await numeracionPorAmbiente(db);
  const valores: any[] = [emisor.id, emisor.establecimiento, emisor.puntoEmision, tipo];
  if (porAmbiente) valores.push(emisor.ambiente);
  return {
    valores,
    columnas: porAmbiente ? 'emisor_id, estab, pto_emi, tipo_doc, ambiente' : 'emisor_id, estab, pto_emi, tipo_doc',
    marcadores: porAmbiente ? '$1, $2, $3, $4, $5' : '$1, $2, $3, $4',
    donde: `emisor_id = $1 AND estab = $2 AND pto_emi = $3 AND tipo_doc = $4${porAmbiente ? ' AND ambiente = $5' : ''}`,
    n: valores.length,
  };
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
    const k = await claveContador(cli, emisor, tipo);
    await cli.query(
      `INSERT INTO gcc_world.sri_secuenciales (${k.columnas}, ultimo)
       VALUES (${k.marcadores}, 0) ON CONFLICT DO NOTHING`, k.valores,
    );
    const { rows: [fila] } = await cli.query(
      `SELECT ultimo FROM gcc_world.sri_secuenciales WHERE ${k.donde} FOR UPDATE`, k.valores,
    );
    const siguiente = Math.max(Number(fila.ultimo) || 0, await maximoUsado(cli, emisor, tipo)) + 1;
    const resultado = await usar(siguiente, cli);
    await cli.query(
      `UPDATE gcc_world.sri_secuenciales SET ultimo = GREATEST(ultimo, $${k.n + 1}), updated_at = NOW()
        WHERE ${k.donde}`, [...k.valores, siguiente],
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
  const k = await claveContador(db, emisor, tipo);
  const { rows: [fila] } = await db.query(`SELECT ultimo FROM gcc_world.sri_secuenciales WHERE ${k.donde}`, k.valores);
  return Math.max(Number(fila?.ultimo) || 0, await maximoUsado(db, emisor, tipo)) + 1;
}

/** Deja constancia de que `numero` ya se usó (nunca baja el contador). */
export async function anotarSecuencialUsado(emisor: Emisor, tipo: TipoDoc, numero: number, db: Consulta = pool): Promise<void> {
  if (emisor.id === null) return;
  const k = await claveContador(db, emisor, tipo);
  await db.query(
    `INSERT INTO gcc_world.sri_secuenciales (${k.columnas}, ultimo) VALUES (${k.marcadores}, $${k.n + 1})
     ON CONFLICT (${k.columnas}) DO UPDATE SET ultimo = GREATEST(gcc_world.sri_secuenciales.ultimo, EXCLUDED.ultimo), updated_at = NOW()`,
    [...k.valores, numero],
  );
}

/**
 * Quién emitió una factura, para enseñarlo (correo, pantalla): lo que la factura guardó al emitirse
 * (`ruc_emisor`, `razon_social_emisor`) y, si no lo guardó, GCC. Escapado para HTML.
 */
export function emisorVisibleHtml(factura: { ruc_emisor?: string | null; razon_social_emisor?: string | null }): { ruc: string; razonSocial: string } {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return {
    ruc: esc(factura.ruc_emisor || EMISOR_GCC_RESPALDO.ruc),
    razonSocial: esc(factura.razon_social_emisor || EMISOR_GCC_RESPALDO.razonSocial),
  };
}
