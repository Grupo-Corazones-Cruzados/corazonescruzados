#!/usr/bin/env node
/**
 * Trae a Carliza Hotel de su servidor propio (`velmort-stays`, base en Neon) al producto
 * Reservas de GCC World, como el inquilino `carliza-hotel` (decisión de Fernando, 2026-10-13).
 * Ver Aprendizaje.md (objetivo del 2026-10-13, «Carliza Hotel pasa al producto Reservas»).
 *
 *   ORIGEN_URL=<postgres de Neon> node scripts/migrar-carliza-reservas.mjs             → PRUEBA, no escribe
 *   ORIGEN_URL=<postgres de Neon> node scripts/migrar-carliza-reservas.mjs --ejecutar  → migra / sincroniza
 *
 * SE PUEDE REPETIR. El hotel sigue trabajando en la app vieja hasta el corte, así que cada
 * pasada trae solo lo nuevo o lo cambiado allá (`reservas.migracion_origen` recuerda qué fila
 * de aquí es cada fila de allá y su `updatedAt`). Lo que no cambió allá no se toca aquí.
 *
 * Qué hace:
 *  1. Inquilino «Carliza Hotel» (#C9952C, logo de la app vieja → Drive de la empresa).
 *  2. Suscripción del plan Estándar, pagada hasta donde pagó en la plataforma (suscripción id 2
 *     «Servidor Carliza Hotel»), con esos pagos copiados. Desde aquí paga en el producto.
 *  3. Usuarios con su MISMA contraseña (los dos usan bcryptjs), menos `lfgonzalezm0`, que es del
 *     equipo GCC y entra como operador.
 *  4. Ubicaciones y suites; sus fotos de Cloudinary → Drive (Productos / Reservas / carliza-hotel).
 *  5. Reservas. La app vieja nunca cerraba una estancia: las que ya terminaron entran como
 *     FINALIZADA (si no, contarían como vivas en la agenda y en los choques de horario).
 *     Las horas ya son instantes UTC en los dos lados (la vieja hace `toISOString()` en el
 *     navegador; el producto, desde su migración 006): se copian tal cual.
 */
// Antes que nada: `pg` lee los TIMESTAMP sin zona con la hora local de la máquina. Las dos
// bases guardan instantes UTC, así que el proceso tiene que vivir en UTC o las reservas que
// «ya terminaron» se calcularían con 5 horas de error (esta Mac está en Ecuador).
process.env.TZ = 'UTC';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { crearDrive } from './lib/drive-empresa.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config({ path: path.join(ROOT, '.env') });

const EJECUTAR = process.argv.includes('--ejecutar');
const ORIGEN = 'velmort-stays';
const SLUG = 'carliza-hotel';
const SUSCRIPCION_PLATAFORMA = 2; // gcc_world.subscriptions «Servidor Carliza Hotel»
const LOGO = path.join(ROOT, '..', '..', 'Gestión de Reservas', 'velmort-stays', 'public', 'logo.png');
const EXCLUIR_USUARIOS = new Set(['lfgonzalezm0']);
const BASE_PUBLICA = 'https://app.grupocc.org';

if (!process.env.ORIGEN_URL) { console.error('✖ Falta ORIGEN_URL (la base de Neon de la app vieja)'); process.exit(1); }

const origen = new pg.Client({ connectionString: process.env.ORIGEN_URL.replace('&channel_binding=require', '').replace('sslmode=require', 'sslmode=verify-full') });
const destino = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
// Los disparadores del escaparate de `reservas` buscan sus tablas SIN esquema.
destino.on('connect', (c) => c.query('SET search_path TO reservas, public'));
const q = (sql, v) => destino.query(sql, v);
const D = crearDrive(ROOT);

const ROL = { ADMIN: 'ADMIN', MANAGER: 'GERENTE', VIEWER: 'CONSULTA' };
const PAGO = { PENDING: 'PENDIENTE', PAID: 'PAGADO' };
const ahora = new Date();
function estadoReserva(r) {
  if (r.status === 'DELETED') return 'ELIMINADA';
  if (r.status === 'FINALIZED') return 'FINALIZADA';
  if (r.status === 'CHECKOUT') return 'POR_SALIR';
  return new Date(r.checkOut) < ahora ? 'FINALIZADA' : 'OCUPADA';
}

const cuenta = {};
const sumar = (k) => { cuenta[k] = (cuenta[k] || 0) + 1; };

async function mapa(tipo) {
  const { rows } = await q(`SELECT id_origen, id_destino, actualizado_origen FROM migracion_origen WHERE origen = $1 AND tipo = $2`, [ORIGEN, tipo]);
  return new Map(rows.map((r) => [r.id_origen, r]));
}
async function recordar(tipo, idOrigen, idDestino, inquilinoId, actualizado) {
  await q(`INSERT INTO migracion_origen (origen, tipo, id_origen, id_destino, inquilino_id, actualizado_origen)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (origen, tipo, id_origen) DO UPDATE SET id_destino = EXCLUDED.id_destino, actualizado_origen = EXCLUDED.actualizado_origen, migrado_en = NOW()`,
    [ORIGEN, tipo, idOrigen, idDestino, inquilinoId, actualizado]);
}
/** Ha cambiado allá desde la última pasada (o nunca se trajo). */
const cambio = (m, r) => !m || !m.actualizado_origen || new Date(m.actualizado_origen).getTime() !== new Date(r.updatedAt).getTime();

/** Foto de Cloudinary → Drive (una sola vez por URL). Devuelve la URL nueva. */
async function fotoADrive(url, base, inquilinoId) {
  if (!url) return null;
  if (/\/api\/media\//.test(url)) return url;
  const { rows: [ya] } = await q(`SELECT file_id FROM gcc_world.media_drive WHERE origen = $1 AND borrado_en IS NULL LIMIT 1`, [`cloudinary:${url}`]);
  if (ya) return `${BASE_PUBLICA}/api/media/${ya.file_id}`;
  if (!EJECUTAR) { sumar('fotos a Drive'); return url; }
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} al bajar ${url}`);
  const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const id = await D.subir(q, { datos: Buffer.from(await res.arrayBuffer()), mime, base, ruta: ['Productos', 'Reservas', SLUG, 'Ubicaciones y suites'], modulo: 'reserva_foto', referencia: `${SLUG}/lugares`, origen: `cloudinary:${url}` });
  sumar('fotos a Drive');
  return `${BASE_PUBLICA}/api/media/${id}`;
}

async function main() {
  // Todo lo de allá se lee AL PRINCIPIO y se cierra la conexión: Neon corta las conexiones
  // ociosas, y mientras se suben las fotos a Drive la de origen se quedaba parada hasta
  // morir (ETIMEDOUT a media migración, 2026-10-13). Son pocos datos.
  await origen.connect();
  const leer = async (sql) => (await origen.query(sql)).rows;
  const V = {
    usuarios: await leer(`SELECT * FROM "User" ORDER BY id`),
    ubicaciones: await leer(`SELECT * FROM "Location" ORDER BY id`),
    suites: await leer(`SELECT s.*, l.name AS ubicacion FROM "Suite" s JOIN "Location" l ON l.id = s."locationId" ORDER BY s.id`),
    reservas: await leer(`SELECT * FROM "Reservation" ORDER BY id`),
  };
  await origen.end();
  console.log(EJECUTAR ? '▶ EJECUTANDO' : '▶ PRUEBA (no se escribe nada; usa --ejecutar)');

  // 1. Inquilino
  let { rows: [inq] } = await q(`SELECT id, logo_url FROM inquilinos WHERE slug = $1`, [SLUG]);
  if (!inq) {
    console.log('· inquilino nuevo «Carliza Hotel»');
    if (!EJECUTAR) inq = { id: -1, logo_url: null };
    else ({ rows: [inq] } = await q(
      `INSERT INTO inquilinos (slug, nombre, color_acento, tema, moneda, zona_horaria, estado, actualizado_en)
       VALUES ($1, 'Carliza Hotel', '#C9952C', 'CLARO', 'USD', 'America/Guayaquil', 'ACTIVO', NOW()) RETURNING id, logo_url`, [SLUG]));
  }
  if (!inq.logo_url && fs.existsSync(LOGO)) {
    console.log('· logo → Drive');
    if (EJECUTAR) {
      const id = await D.subir(q, { datos: fs.readFileSync(LOGO), mime: 'image/png', base: 'Carliza Hotel · logo', ruta: ['Productos', 'Reservas', SLUG, 'Marca'], modulo: 'reserva_foto', referencia: `${SLUG}/marca`, origen: 'velmort-stays:public/logo.png' });
      await q(`UPDATE inquilinos SET logo_url = $2, actualizado_en = NOW() WHERE id = $1`, [inq.id, `${BASE_PUBLICA}/api/media/${id}`]);
    }
  }

  // 2. Suscripción del producto, pagada hasta donde pagó en la plataforma
  const { rows: pagosPlataforma } = await q(
    `SELECT to_char(period, 'YYYY-MM') AS periodo, amount, paid_at, invoice_id FROM gcc_world.subscription_payments
      WHERE subscription_id = $1 AND paid_at IS NOT NULL ORDER BY period`, [SUSCRIPCION_PLATAFORMA]);
  const ultimo = pagosPlataforma.at(-1)?.periodo; // 'AAAA-MM'
  const pagadoHasta = ultimo ? new Date(Date.UTC(Number(ultimo.slice(0, 4)), Number(ultimo.slice(5, 7)), 0)).toISOString().slice(0, 10) : null;
  let { rows: [sus] } = await q(`SELECT id FROM suscripciones WHERE inquilino_id = $1`, [inq.id]);
  if (!sus) {
    console.log(`· suscripción Estándar, pagada hasta ${pagadoHasta} (último mes pagado en la plataforma: ${ultimo})`);
    if (EJECUTAR) ({ rows: [sus] } = await q(
      `INSERT INTO suscripciones (inquilino_id, plan_id, estado, inicio, pagado_hasta, metodo_pago, notas, actualizado_en)
       VALUES ($1, (SELECT id FROM planes WHERE slug = 'estandar'), 'ACTIVA', '2026-06-05', $2, 'AUTOSERVICIO',
               'Viene de la suscripción id ${SUSCRIPCION_PLATAFORMA} de la plataforma («Servidor Carliza Hotel»). Desde la migración paga en el producto.', NOW())
       RETURNING id`, [inq.id, pagadoHasta]));
  }
  if (EJECUTAR && sus) {
    for (const p of pagosPlataforma) {
      const r = await q(`INSERT INTO pagos_mensuales (inquilino_id, suscripcion_id, periodo, monto, estado, referencia, pagado_en, registrado_por)
                         VALUES ($1,$2,$3,$4,'PAGADO',$5,$6,'migración desde la plataforma') ON CONFLICT (suscripcion_id, periodo) DO NOTHING`,
        [inq.id, sus.id, p.periodo, p.amount, `Plataforma GCC World · suscripción ${SUSCRIPCION_PLATAFORMA} · factura #${p.invoice_id}`, p.paid_at]);
      if (r.rowCount) sumar('pagos');
    }
  }

  // 3. Usuarios (misma contraseña)
  const mU = await mapa('usuario');
  for (const u of V.usuarios) {
    if (EXCLUIR_USUARIOS.has(u.username)) continue;
    const m = mU.get(u.id);
    if (!cambio(m, u)) continue;
    sumar(m ? 'usuarios actualizados' : 'usuarios nuevos');
    if (!EJECUTAR) continue;
    const { rows: [n] } = await q(
      `INSERT INTO usuarios (inquilino_id, usuario, nombre, password_hash, rol, activo, creado_en, actualizado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (inquilino_id, usuario) DO UPDATE SET nombre = EXCLUDED.nombre, password_hash = EXCLUDED.password_hash,
         rol = EXCLUDED.rol, activo = EXCLUDED.activo, actualizado_en = NOW()
       RETURNING id`, [inq.id, u.username, u.name, u.password, ROL[u.role] || 'CONSULTA', u.active, u.createdAt]);
    await recordar('usuario', u.id, n.id, inq.id, u.updatedAt);
  }

  // 4. Ubicaciones y suites
  const mL = await mapa('ubicacion');
  const ubic = new Map([...mL].map(([k, v]) => [k, v.id_destino]));
  for (const l of V.ubicaciones) {
    const m = mL.get(l.id);
    if (!cambio(m, l)) continue;
    sumar(m ? 'ubicaciones actualizadas' : 'ubicaciones nuevas');
    const foto = await fotoADrive(l.photoUrl, `${l.name}`, inq.id);
    if (!EJECUTAR) continue;
    const { rows: [n] } = await q(
      `INSERT INTO ubicaciones (inquilino_id, nombre, foto_url, orden, creado_en, actualizado_en) VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (inquilino_id, nombre) DO UPDATE SET foto_url = EXCLUDED.foto_url, actualizado_en = NOW() RETURNING id`,
      [inq.id, l.name, foto, l.id, l.createdAt]);
    ubic.set(l.id, n.id);
    await recordar('ubicacion', l.id, n.id, inq.id, l.updatedAt);
  }
  const mS = await mapa('suite');
  const suites = new Map([...mS].map(([k, v]) => [k, v.id_destino]));
  for (const s of V.suites) {
    const m = mS.get(s.id);
    if (!cambio(m, s)) continue;
    sumar(m ? 'suites actualizadas' : 'suites nuevas');
    const foto = await fotoADrive(s.photoUrl, `${s.ubicacion} · ${s.unitName}`, inq.id);
    if (!EJECUTAR) continue;
    const ubicacionId = ubic.get(s.locationId);
    if (!ubicacionId) throw new Error(`La suite ${s.id} es de una ubicación que no se trajo (${s.locationId})`);
    const { rows: [n] } = await q(
      `INSERT INTO suites (inquilino_id, ubicacion_id, nombre, foto_url, orden, creado_en, actualizado_en) VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (ubicacion_id, nombre) DO UPDATE SET foto_url = EXCLUDED.foto_url, actualizado_en = NOW() RETURNING id`,
      [inq.id, ubicacionId, s.unitName, foto, s.id, s.createdAt]);
    suites.set(s.id, n.id);
    await recordar('suite', s.id, n.id, inq.id, s.updatedAt);
  }

  // 5. Reservas
  const mR = await mapa('reserva');
  const vistas = new Set();
  for (const r of V.reservas) {
    vistas.add(r.id);
    const m = mR.get(r.id);
    if (!cambio(m, r)) continue;
    const estado = estadoReserva(r);
    sumar(`${m ? 'reservas actualizadas' : 'reservas nuevas'} · ${estado}`);
    if (!EJECUTAR) continue;
    const suiteId = suites.get(r.suiteId);
    if (!suiteId) throw new Error(`La reserva ${r.id} es de una suite que no se trajo (${r.suiteId})`);
    const valores = [inq.id, suiteId, r.clientName, r.phone, r.checkIn, r.checkOut, r.totalPrice, r.deposit, PAGO[r.paymentStatus] || 'PENDIENTE', estado, r.comments, r.createdAt];
    let id;
    if (m) {
      await q(`UPDATE reservas SET suite_id=$2, cliente_nombre=$3, telefono=$4, entrada=$5, salida=$6, precio_total=$7, anticipo=$8,
                 estado_pago=$9, estado=$10, comentarios=$11, actualizado_en=NOW() WHERE id=$12 AND inquilino_id=$1`, [...valores.slice(0, 11), m.id_destino]);
      id = m.id_destino;
    } else {
      ({ rows: [{ id }] } = await q(
        `INSERT INTO reservas (inquilino_id, suite_id, cliente_nombre, telefono, entrada, salida, precio_total, anticipo, estado_pago, estado, comentarios, creado_por, creado_en, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'migración',$12,NOW()) RETURNING id`, valores));
    }
    await recordar('reserva', r.id, id, inq.id, r.updatedAt);
  }
  // Borradas DEL TODO allá (no marcadas): aquí quedan como eliminadas, nunca se borran.
  const desaparecidas = [...mR.keys()].filter((k) => !vistas.has(k));
  if (desaparecidas.length) {
    cuenta['reservas que ya no existen allá → ELIMINADA'] = desaparecidas.length;
    if (EJECUTAR) await q(`UPDATE reservas SET estado = 'ELIMINADA', actualizado_en = NOW() WHERE id = ANY($1::int[]) AND inquilino_id = $2`, [desaparecidas.map((k) => mR.get(k).id_destino), inq.id]);
  }

  console.log('\nResumen:', JSON.stringify(cuenta, null, 1));

  // 6. Comprobación: lo de allá contra lo de aquí
  if (EJECUTAR) {
    const a = { reservas: V.reservas.length, no_eliminadas: V.reservas.filter((r) => r.status !== 'DELETED').length };
    const { rows: [b] } = await q(`SELECT count(*)::int reservas, count(*) FILTER (WHERE estado <> 'ELIMINADA')::int no_eliminadas FROM reservas WHERE inquilino_id = $1`, [inq.id]);
    const ua = { n: V.usuarios.filter((u) => !EXCLUIR_USUARIOS.has(u.username)).length };
    const { rows: [ub] } = await q(`SELECT count(*)::int n FROM usuarios WHERE inquilino_id = $1`, [inq.id]);
    const sa = { ubicaciones: V.ubicaciones.length, suites: V.suites.length };
    const { rows: [sb] } = await q(`SELECT (SELECT count(*) FROM ubicaciones WHERE inquilino_id = $1)::int ubicaciones, (SELECT count(*) FROM suites WHERE inquilino_id = $1)::int suites`, [inq.id]);
    const ok = a.reservas === b.reservas && a.no_eliminadas === b.no_eliminadas && ua.n === ub.n && sa.ubicaciones === sb.ubicaciones && sa.suites === sb.suites;
    console.log(`\n${ok ? '✔ CUADRA' : '✖ NO CUADRA'} · reservas ${a.reservas}/${b.reservas} (vivas o pasadas ${a.no_eliminadas}/${b.no_eliminadas}) · usuarios ${ua.n}/${ub.n} · ubicaciones ${sa.ubicaciones}/${sb.ubicaciones} · suites ${sa.suites}/${sb.suites}`);
    if (!ok) process.exitCode = 1;
  }
}

try { await main(); } finally { await origen.end().catch(() => {}); await destino.end(); }
