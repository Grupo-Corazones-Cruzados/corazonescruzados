/**
 * LA BASE DE DATOS, SOLO PARA LEER. Lo que pide el agente nace de lo que se oye en una reunión, y eso lo
 * puede decir cualquiera. Por eso no basta con la instrucción: la transacción es de solo lectura y se
 * rechaza todo lo que no sea un SELECT o toque credenciales. Es la base de producción.
 */
const COLUMNA_SECRETA = /pass|token|secret|clave|hash|private|api_?key|credential|certific|otp|cookie|refresh|cifrad|encrypt/i;
const PROHIBIDO = /\b(pg_\w+|dblink\w*|lo_\w+|query_to_\w+|table_to_\w+|copy|set_config|current_setting)\b/i;

export function validarConsulta(sql) {
  const t = String(sql || '').trim().replace(/;\s*$/, '');
  if (!t) throw new Error('Consulta vacía.');
  if (t.includes(';')) throw new Error('Solo una consulta a la vez.');
  if (!/^(select|with)\b/i.test(t)) throw new Error('Solo se permite SELECT.');
  if (PROHIBIDO.test(t)) throw new Error('Esa función no está permitida.');
  if (COLUMNA_SECRETA.test(t)) throw new Error('No se pueden consultar credenciales.');
  return t;
}

/** Por si un `SELECT *` las trae: lo secreto nunca llega al modelo. */
export function limpiarFilas(filas) {
  return filas.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !COLUMNA_SECRETA.test(k))));
}

export async function consultarBd(pool, sql) {
  const t = validarConsulta(sql);
  const c = await pool.connect();
  try {
    await c.query('BEGIN TRANSACTION READ ONLY');
    await c.query(`SET LOCAL statement_timeout = 4000`);
    const r = await c.query(t);
    return limpiarFilas(r.rows.slice(0, 40));
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    c.release();
  }
}
