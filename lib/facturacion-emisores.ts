import { pool } from '@/lib/db';
import fs from 'fs';
import { DUENO_FINANZAS_GCC } from '@/lib/finance';
import { cifrar, contextoFirmaEmisor } from '@/lib/cifrado';
import { cedulaValida } from '@/lib/pagos/identificacion';
import { LEYENDA_REGIMEN, invalidarEmisor, type EstadoEmisor, type Regimen } from '@/lib/integrations/sri/emisor';
import { revisarP12 } from '@/lib/integrations/sri/xades-signer';
import { SRI_MAX } from '@/lib/integrations/sri/text';
import { createNotification } from '@/lib/notifications';
import { sendFirmaPorVencerEmail } from '@/lib/integrations/email';

/**
 * ⭐ LA CUENTA DE EMISOR DE CADA PERSONA — fase 4, paso 3 del modelo económico (Fernando, 2026-11-09).
 *
 * «Todo miembro y candidato saca su RUC al completar un servicio: la plataforma implementa su cuenta de emisor y
 * guarda la firma electrónica de todos para hacer sus facturas.» Aquí viven sus datos tributarios y su .p12
 * (Configuración › Facturación) y la lista del administrador (Admin › Emisores). EMITIR con ellos es el paso 4:
 * hoy una cuenta nace `borrador` y solo el administrador la pasa a `en_pruebas` / `activo`.
 *
 *   · La cuenta de GCC (`user_id` NULL) es la de Fernando: la ve en su Configuración, pero no se edita desde aquí
 *     (su firma está en el entorno del servidor y sus datos son los de todas las facturas emitidas).
 *   · El .p12 y su clave se guardan CIFRADOS (`lib/cifrado.ts`) y nunca vuelven al navegador: solo titular y
 *     vencimiento. Cada cambio queda en `sri_emisor_log` (quién y cuándo, nunca el archivo) y se avisa por correo.
 *
 * ⚠️ Las tablas las crea la migración 089; aquí no hay DDL.
 */

export type EmisorVisible = {
  id: number;
  esGcc: boolean;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  dirMatriz: string;
  dirEstablecimiento: string;
  estab: string;
  ptoEmi: string;
  obligadoContabilidad: boolean;
  regimen: Regimen;
  leyenda: string;
  cobraIva: boolean;
  tarifaIva: string;
  ambiente: '1' | '2';
  estado: EstadoEmisor;
  firma: { titular: string; vence: string; coincide: boolean | null; actualizada: string | null; enServidor: boolean } | null;
  actualizado: string;
};

export type EmisorDeLista = EmisorVisible & { userId: string | null; persona: string; email: string | null };

const COLUMNAS = `e.id, e.user_id, e.ruc, e.razon_social, e.nombre_comercial, e.dir_matriz, e.dir_establecimiento, e.estab, e.pto_emi,
  e.obligado_contabilidad, e.regimen, e.leyenda_rimpe, e.cobra_iva, e.tarifa_iva, e.ambiente, e.estado, e.firma_desde_entorno,
  e.p12_titular, e.p12_vence, e.p12_ruc_coincide, e.p12_actualizada, (e.p12_enc IS NOT NULL) AS tiene_p12, e.updated_at`;

const dia = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));

/** Titular y vencimiento del .p12 del entorno (el de GCC). Se lee una vez por proceso. */
let firmaEntorno: { titular: string; vence: string } | null | undefined;
function firmaDelEntorno(): { titular: string; vence: string } | null {
  if (firmaEntorno !== undefined) return firmaEntorno;
  try {
    const ruta = process.env.SRI_P12_PATH || '';
    const archivo = process.env.SRI_P12_BASE64 ? Buffer.from(process.env.SRI_P12_BASE64, 'base64')
      : ruta && fs.existsSync(ruta) ? fs.readFileSync(ruta) : null;
    const r = archivo ? revisarP12(archivo, process.env.SRI_P12_PASSWORD || '') : null;
    firmaEntorno = r?.ok ? { titular: r.titular, vence: r.vence } : null;
  } catch { firmaEntorno = null; }
  return firmaEntorno;
}

function visible(r: any): EmisorVisible {
  const esGcc = r.user_id == null;
  const entorno = r.firma_desde_entorno ? firmaDelEntorno() : null;
  return {
    id: Number(r.id), esGcc, ruc: r.ruc, razonSocial: r.razon_social, nombreComercial: r.nombre_comercial ?? '',
    dirMatriz: r.dir_matriz, dirEstablecimiento: r.dir_establecimiento, estab: String(r.estab).trim(), ptoEmi: String(r.pto_emi).trim(),
    obligadoContabilidad: !!r.obligado_contabilidad, regimen: r.regimen, leyenda: r.leyenda_rimpe ?? '',
    cobraIva: !!r.cobra_iva, tarifaIva: String(r.tarifa_iva), ambiente: String(r.ambiente).trim() === '2' ? '2' : '1',
    estado: r.estado,
    firma: r.firma_desde_entorno
      ? (entorno ? { ...entorno, coincide: true, actualizada: null, enServidor: true } : null)
      : r.tiene_p12
        ? { titular: r.p12_titular, vence: dia(r.p12_vence), coincide: r.p12_ruc_coincide ?? null, actualizada: r.p12_actualizada ? new Date(r.p12_actualizada).toISOString() : null, enServidor: false }
        : null,
    actualizado: new Date(r.updated_at).toISOString(),
  };
}

/** ¿Puede tener cuenta de emisor? Quien tiene ficha de miembro: miembros, candidatos y el admin (como Cobros). */
export async function puedeFacturar(userId: string): Promise<boolean> {
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1::uuid`, [userId]);
  return u?.member_id != null;
}

/** La cuenta de emisor de `userId` (para Fernando, la de GCC). `null` si aún no la registró. */
export async function emisorDe(userId: string): Promise<EmisorVisible | null> {
  const { rows: [r] } = userId === DUENO_FINANZAS_GCC
    ? await pool.query(`SELECT ${COLUMNAS} FROM gcc_world.sri_emisores e WHERE e.user_id IS NULL`)
    : await pool.query(`SELECT ${COLUMNAS} FROM gcc_world.sri_emisores e WHERE e.user_id = $1::uuid`, [userId]);
  return r ? visible(r) : null;
}

// ── Validación ─────────────────────────────────────────────────────────────────────────────────────────────

const REGIMENES: Regimen[] = ['rimpe_negocio_popular', 'rimpe_emprendedor', 'general'];
const TARIFAS = ['0', '4', '5'];
const texto = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ');

/**
 * RUC de Ecuador: 13 dígitos, provincia 01-24 (o 30, exterior), terminado en 001 (el establecimiento matriz).
 * Persona natural (tercer dígito < 6): los 10 primeros son su cédula, válida. Sociedades y públicos (6 y 9): se
 * comprueba solo la forma. Es lo mismo que exige `xml-builder.ts` a un comprador.
 */
export function errorRuc(ruc: string): string | null {
  if (!/^\d{13}$/.test(ruc)) return 'El RUC tiene 13 dígitos.';
  if (!ruc.endsWith('001')) return 'El RUC termina en 001.';
  const provincia = Number(ruc.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return 'Los dos primeros dígitos del RUC no son de una provincia.';
  const tercero = Number(ruc[2]);
  if (tercero < 6 && !cedulaValida(ruc.slice(0, 10))) return 'Los 10 primeros dígitos del RUC no son una cédula válida.';
  if (tercero === 7 || tercero === 8) return 'El tercer dígito del RUC no es válido.';
  return null;
}

export type DatosEmisor = {
  ruc?: unknown; razonSocial?: unknown; nombreComercial?: unknown; dirMatriz?: unknown; dirEstablecimiento?: unknown;
  estab?: unknown; ptoEmi?: unknown; obligadoContabilidad?: unknown; regimen?: unknown; cobraIva?: unknown; tarifaIva?: unknown;
};

/** Lo que se puede cambiar solo mientras la cuenta es un borrador: con ello se numeran y firman las facturas. */
const BLOQUEADOS_TRAS_BORRADOR = ['ruc', 'estab', 'pto_emi'];

/**
 * Registra o cambia la cuenta de emisor de `userId` (la llama SOLO su dueño: ver `/api/facturacion`). Devuelve la
 * cuenta visible y qué cambió, o el error para la pantalla.
 */
export async function guardarEmisor(userId: string, datos: DatosEmisor): Promise<
  { ok: true; emisor: EmisorVisible; cambios: string[]; nueva: boolean } | { ok: false; error: string }
> {
  if (userId === DUENO_FINANZAS_GCC) return { ok: false, error: 'La cuenta de emisor de GCC no se cambia desde aquí.' };

  const ruc = String(datos.ruc ?? '').replace(/\D/g, '');
  const razon = texto(datos.razonSocial).toUpperCase();
  const comercial = texto(datos.nombreComercial);
  const matriz = texto(datos.dirMatriz);
  const establecimiento = texto(datos.dirEstablecimiento) || matriz;
  const estab = String(datos.estab ?? '001').replace(/\D/g, '').padStart(3, '0');
  const pto = String(datos.ptoEmi ?? '001').replace(/\D/g, '').padStart(3, '0');
  const obligado = datos.obligadoContabilidad === true;
  const regimen = String(datos.regimen ?? '') as Regimen;
  const cobraIva = datos.cobraIva === true;
  const tarifa = cobraIva ? String(datos.tarifaIva ?? '4') : '0';

  const eRuc = errorRuc(ruc);
  if (eRuc) return { ok: false, error: eRuc };
  if (razon.length < 3 || razon.length > SRI_MAX.razonSocial) return { ok: false, error: 'Escribe la razón social tal como está en tu RUC.' };
  if (comercial.length > SRI_MAX.nombreComercial) return { ok: false, error: 'El nombre comercial es demasiado largo.' };
  if (matriz.length < 5 || matriz.length > SRI_MAX.dirMatriz) return { ok: false, error: 'Escribe la dirección de la matriz.' };
  if (establecimiento.length > SRI_MAX.dirEstablecimiento) return { ok: false, error: 'La dirección del establecimiento es demasiado larga.' };
  if (!/^\d{3}$/.test(estab) || estab === '000') return { ok: false, error: 'El establecimiento son 3 dígitos (001).' };
  if (!/^\d{3}$/.test(pto) || pto === '000') return { ok: false, error: 'El punto de emisión son 3 dígitos (001).' };
  if (!REGIMENES.includes(regimen)) return { ok: false, error: 'Elige tu régimen.' };
  if (!TARIFAS.includes(tarifa) || (cobraIva && tarifa === '0')) return { ok: false, error: 'Elige la tarifa de IVA.' };
  // El Negocio Popular no cobra IVA (sus ventas van con tarifa 0 %).
  if (regimen === 'rimpe_negocio_popular' && cobraIva) return { ok: false, error: 'El RIMPE Negocio Popular no cobra IVA.' };

  const nuevo: Record<string, unknown> = {
    ruc, razon_social: razon, nombre_comercial: comercial || null, dir_matriz: matriz, dir_establecimiento: establecimiento,
    estab, pto_emi: pto, obligado_contabilidad: obligado, regimen, leyenda_rimpe: LEYENDA_REGIMEN[regimen] || null,
    cobra_iva: cobraIva, tarifa_iva: tarifa,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [antes] } = await client.query(
      `SELECT id, estado, ${Object.keys(nuevo).join(', ')} FROM gcc_world.sri_emisores WHERE user_id = $1::uuid FOR UPDATE`, [userId],
    );
    const cambios = Object.keys(nuevo).filter((k) => {
      if (!antes) return true;
      const a = antes[k]; const b = nuevo[k];
      return (typeof a === 'string' ? a.trim() : a ?? null) !== (b ?? null);
    });
    if (antes && antes.estado !== 'borrador') {
      const bloqueado = cambios.find((c) => BLOQUEADOS_TRAS_BORRADOR.includes(c));
      if (bloqueado) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Tu cuenta ya está habilitada: el RUC, el establecimiento y el punto de emisión solo los cambia el administrador.' };
      }
    }

    let id: number;
    if (!antes) {
      const cols = Object.keys(nuevo);
      const { rows: [r] } = await client.query(
        `INSERT INTO gcc_world.sri_emisores (user_id, ${cols.join(', ')}, estado, ambiente, updated_by)
         VALUES ($1::uuid, ${cols.map((_, i) => `$${i + 2}`).join(', ')}, 'borrador', '1', $1::uuid) RETURNING id`,
        [userId, ...cols.map((c) => nuevo[c])],
      );
      id = Number(r.id);
    } else {
      id = Number(antes.id);
      if (cambios.length > 0) {
        await client.query(
          `UPDATE gcc_world.sri_emisores SET ${cambios.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW(), updated_by = $${cambios.length + 2}::uuid
            WHERE id = $1`,
          [id, ...cambios.map((c) => nuevo[c]), userId],
        );
        // Si cambió el RUC, la firma que había deja de estar comprobada contra él.
        if (cambios.includes('ruc')) {
          await client.query(`UPDATE gcc_world.sri_emisores SET p12_ruc_coincide = CASE WHEN p12_identificacion IS NULL THEN NULL
              ELSE (p12_identificacion = $2 OR p12_identificacion = LEFT($2, 10)) END WHERE id = $1`, [id, ruc]);
        }
      }
    }
    if (cambios.length > 0) {
      await client.query(
        `INSERT INTO gcc_world.sri_emisor_log (emisor_id, action, changed_fields, actor_user_id) VALUES ($1, $2, $3::text[], $4::uuid)`,
        [id, antes ? 'updated' : 'created', cambios, userId],
      );
    }
    await client.query('COMMIT');
    invalidarEmisor();
    return { ok: true, emisor: (await emisorDe(userId))!, cambios, nueva: !antes };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Tamaño máximo del .p12: los de las certificadoras pesan 5-15 KB. */
export const MAX_P12_BYTES = 200 * 1024;

/**
 * Guarda la firma electrónica (.p12 + contraseña) de `userId`. Comprueba en el servidor que la contraseña abre el
 * archivo como lo abre el firmador, que no está vencido y —si el certificado trae cédula o RUC— que es de quien
 * dice el RUC. La guarda cifrada; nunca se devuelve.
 */
export async function guardarFirma(userId: string, archivo: Buffer, password: string): Promise<
  { ok: true; emisor: EmisorVisible; nueva: boolean } | { ok: false; error: string }
> {
  if (userId === DUENO_FINANZAS_GCC) return { ok: false, error: 'La firma de GCC está en el servidor y no se cambia desde aquí.' };
  if (archivo.length === 0 || archivo.length > MAX_P12_BYTES) return { ok: false, error: 'Sube el archivo .p12 de tu firma (máximo 200 KB).' };

  const { rows: [e] } = await pool.query(`SELECT id, ruc, p12_enc FROM gcc_world.sri_emisores WHERE user_id = $1::uuid`, [userId]);
  if (!e) return { ok: false, error: 'Primero guarda los datos de tu RUC.' };

  const rev = revisarP12(archivo, password);
  if (!rev.ok) return rev;

  const cedula = String(e.ruc).slice(0, 10);
  const propia = rev.identificaciones.find((x) => x === e.ruc || x === cedula) ?? null;
  if (rev.identificaciones.length > 0 && !propia) {
    return { ok: false, error: `Este certificado es de ${rev.titular} y no corresponde al RUC ${e.ruc}.` };
  }

  const id = Number(e.id);
  await pool.query(
    `UPDATE gcc_world.sri_emisores
        SET p12_enc = $2, p12_password_enc = $3, p12_vence = $4::date, p12_titular = $5, p12_identificacion = $6,
            p12_ruc_coincide = $7, p12_actualizada = NOW(), p12_aviso_vence = NULL, updated_at = NOW(), updated_by = $8::uuid
      WHERE id = $1`,
    [id, cifrar(archivo.toString('base64'), contextoFirmaEmisor(id, 'p12')),
     password ? cifrar(password, contextoFirmaEmisor(id, 'p12_password')) : null,
     rev.vence, rev.titular, propia ?? rev.identificaciones[0] ?? null, propia ? true : null, userId],
  );
  await pool.query(
    `INSERT INTO gcc_world.sri_emisor_log (emisor_id, action, changed_fields, detalle, actor_user_id)
     VALUES ($1, 'firma', ARRAY['p12','p12_password'], $2, $3::uuid)`,
    [id, `${rev.titular} · vence ${rev.vence}`, userId],
  );
  invalidarEmisor();
  return { ok: true, emisor: (await emisorDe(userId))!, nueva: !e.p12_enc };
}

// ── Administración ─────────────────────────────────────────────────────────────────────────────────────────

/** Todas las cuentas de emisor, GCC primero. Para Admin › Emisores. */
export async function listarEmisores(): Promise<EmisorDeLista[]> {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS}, u.email, NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS persona
       FROM gcc_world.sri_emisores e LEFT JOIN gcc_world.users u ON u.id = e.user_id
      ORDER BY (e.user_id IS NULL) DESC, e.updated_at DESC`,
  );
  return rows.map((r: any) => ({
    ...visible(r), userId: r.user_id ?? null, email: r.email ?? null,
    persona: r.user_id == null ? 'Grupo Corazones Cruzados' : (r.persona || r.email || 'Sin nombre'),
  }));
}

export const ESTADOS_ADMIN: EstadoEmisor[] = ['en_pruebas', 'activo', 'suspendido'];

export class ErrorEmisor extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

/**
 * El administrador habilita (`en_pruebas` → ambiente de pruebas del SRI, `activo` → producción) o suspende una
 * cuenta. Habilitar exige firma vigente y comprobada contra el RUC. La de GCC no se toca.
 */
export async function cambiarEstado(id: number, estado: EstadoEmisor, actor: string): Promise<void> {
  if (!ESTADOS_ADMIN.includes(estado)) throw new ErrorEmisor('Estado no válido.', 400);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [e] } = await client.query(
      `SELECT id, user_id, estado, p12_enc, p12_vence, p12_ruc_coincide FROM gcc_world.sri_emisores WHERE id = $1 FOR UPDATE`, [id],
    );
    if (!e) throw new ErrorEmisor('Esa cuenta de emisor no existe.', 404);
    if (e.user_id == null) throw new ErrorEmisor('La cuenta de GCC no se cambia desde aquí.');
    if (e.estado === estado) { await client.query('ROLLBACK'); return; }
    if (estado !== 'suspendido') {
      if (!e.p12_enc) throw new ErrorEmisor('Falta la firma electrónica.');
      if (dia(e.p12_vence) <= hoyEcuador()) throw new ErrorEmisor('La firma electrónica está vencida.');
      if (e.p12_ruc_coincide === false) throw new ErrorEmisor('La firma no corresponde al RUC.');
    }
    await client.query(
      `UPDATE gcc_world.sri_emisores
          SET estado = $2::text,
              ambiente = CASE $2::text WHEN 'en_pruebas' THEN '1' WHEN 'activo' THEN '2' ELSE ambiente END,
              activo_desde = CASE WHEN $2::text = 'activo' THEN COALESCE(activo_desde, NOW()) ELSE activo_desde END,
              updated_at = NOW(), updated_by = $3::uuid
        WHERE id = $1`, [id, estado, actor],
    );
    await client.query(
      `INSERT INTO gcc_world.sri_emisor_log (emisor_id, action, changed_fields, detalle, actor_user_id)
       VALUES ($1, 'estado', ARRAY['estado'], $2, $3::uuid)`, [id, `${e.estado} → ${estado}`, actor],
    );
    await client.query('COMMIT');
    invalidarEmisor();
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ── Aviso de firma por vencer ──────────────────────────────────────────────────────────────────────────────

const DIAS_AVISO = 30;

function hoyEcuador(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);

/**
 * Avisa (campanita + correo) a quien tenga la firma a 30 días o menos de vencer, una vez por certificado
 * (`p12_aviso_vence`). La de GCC se lee del entorno y se le avisa a Fernando. Lo llama el cron nocturno
 * (`/api/facturacion/cron/firmas`). `simular`: no avisa ni guarda; devuelve a quién avisaría.
 */
export async function avisarFirmasPorVencer(simular = false): Promise<{ revisadas: number; avisadas: number; sinMigracion?: true; simulacion?: any[] }> {
  const hoy = hoyEcuador();
  // Mientras no se aplique la migración 089 no hay emisores que revisar: se dice tal cual, sin fingir un error.
  const { rows: [t] } = await pool.query(`SELECT to_regclass('gcc_world.sri_emisores') IS NOT NULL AS hay`);
  if (!t?.hay) return { revisadas: 0, avisadas: 0, sinMigracion: true };
  const { rows } = await pool.query(
    `SELECT e.id, e.user_id, e.firma_desde_entorno, e.p12_vence, e.p12_aviso_vence, u.email,
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS nombre
       FROM gcc_world.sri_emisores e LEFT JOIN gcc_world.users u ON u.id = COALESCE(e.user_id, $1::uuid)
      WHERE e.estado <> 'suspendido' AND (e.firma_desde_entorno OR e.p12_enc IS NOT NULL)`, [DUENO_FINANZAS_GCC],
  );
  const simulacion: any[] = [];
  let avisadas = 0;
  for (const r of rows) {
    const vence = r.firma_desde_entorno ? firmaDelEntorno()?.vence : dia(r.p12_vence);
    if (!vence) continue;
    const dias = diasEntre(hoy, vence);
    if (dias > DIAS_AVISO || dias < 0) continue;
    if (r.p12_aviso_vence && dia(r.p12_aviso_vence) === vence) continue;
    const destinatario = r.user_id ?? DUENO_FINANZAS_GCC;
    if (simular) { simulacion.push({ emisor: Number(r.id), destinatario, vence, dias }); continue; }

    // Primero se marca: si el correo falla, mañana no llueve otro aviso en la campanita.
    const { rowCount } = await pool.query(
      `UPDATE gcc_world.sri_emisores SET p12_aviso_vence = $2::date WHERE id = $1 AND p12_aviso_vence IS DISTINCT FROM $2::date`, [r.id, vence],
    );
    if (!rowCount) continue;
    const titulo = dias === 0 ? 'Tu firma electrónica vence hoy' : `Tu firma electrónica vence en ${dias} día${dias === 1 ? '' : 's'}`;
    await createNotification(destinatario, {
      type: 'firma', title: titulo, message: `Vence el ${vence}. Sube la nueva para seguir facturando.`,
      link: '/dashboard/settings?tab=facturacion',
    }).catch((e) => console.error('[firmas] campanita', r.id, e?.message));
    if (r.email) {
      await sendFirmaPorVencerEmail({ email: r.email, nombre: r.nombre || r.email, vence, dias })
        .catch((e) => console.error('[firmas] correo', r.id, e?.message));
    }
    avisadas++;
  }
  return { revisadas: rows.length, avisadas, ...(simular ? { simulacion } : {}) };
}
