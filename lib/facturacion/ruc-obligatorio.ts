import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * ⇒ SIN RUC NO SE TRABAJA EN TICKETS, PROYECTOS NI SUSCRIPCIONES (Fernando, 2026-11-14: «necesita tener un RUC en la
 * app registrado porque si no, no va a poder facturarse con su nombre»).
 *
 *  · A quién: a los MIEMBROS y CANDIDATOS. El administrador no (factura GCC); el cliente tampoco (es quien paga).
 *  · Qué es tener RUC: su cuenta de emisor HABILITADA (`sri_emisores.estado = 'activo'`), con la que de verdad sale
 *    una factura a su nombre. Un RUC guardado en borrador todavía no factura.
 *  · Qué se bloquea: crear, tomar, proponerse y hacerse responsable. Ver la lista sigue permitido.
 *  · Desde cuándo: el 2026-12-01 (hora de Ecuador). Hasta entonces solo se avisa, para que los miembros que ya
 *    trabajan tengan tiempo de registrarlo (el 2026-11-14 nadie lo tenía).
 *  · Las CUENTAS DE PRUEBA (revisores de tiendas, probadores) usan el RUC de GCC, el de lfgonzalezm0@grupocc.org:
 *    nunca tienen el suyo y no deben quedar bloqueadas (Fernando, 2026-11-14).
 */
export const RUC_OBLIGATORIO_DESDE = '2026-12-01T00:00:00-05:00';

/** Las cuentas de prueba facturan con el RUC de GCC. */
export const esCuentaDePrueba = (email: string | null | undefined) => {
  const e = String(email || '').trim().toLowerCase();
  return e.endsWith('@gcc.test') || e === 'revisor.meta@grupocc.org';
};

export type EstadoRuc = { requerido: boolean; tiene: boolean; bloquea: boolean; desde: string; deGcc: boolean };

export async function estadoRuc(user: { userId: string; email?: string | null; role?: string | null }): Promise<EstadoRuc> {
  const desde = RUC_OBLIGATORIO_DESDE;
  if (user.role === 'admin') return { requerido: false, tiene: true, bloquea: false, desde, deGcc: true };
  if (esCuentaDePrueba(user.email)) return { requerido: true, tiene: true, bloquea: false, desde, deGcc: true };
  const { rows: [r] } = await pool.query(
    `SELECT u.role, u.member_id,
            EXISTS (SELECT 1 FROM gcc_world.clients c WHERE c.user_id = u.id AND c.account_type = 'candidate') AS candidato,
            EXISTS (SELECT 1 FROM gcc_world.sri_emisores s WHERE s.user_id = u.id AND s.estado = 'activo') AS emisor
       FROM gcc_world.users u WHERE u.id = $1::uuid`,
    [String(user.userId)],
  ).catch(() => ({ rows: [] as any[] }));
  const requerido = !!r && (r.role === 'member' || r.candidato);
  const tiene = !!r?.emisor;
  const bloquea = requerido && !tiene && Date.now() >= new Date(desde).getTime();
  return { requerido, tiene, bloquea, desde, deGcc: false };
}

/** Para las rutas que crean, toman o proponen: `null` si puede seguir, o la respuesta 403 con el motivo. */
export async function rechazoSinRuc(user: { userId: string; email?: string | null; role?: string | null }): Promise<NextResponse | null> {
  const e = await estadoRuc(user);
  if (!e.bloquea) return null;
  return NextResponse.json({
    error: 'Para trabajar en tickets, proyectos y suscripciones necesitas tu RUC habilitado. Regístralo en Configuración ▸ Facturación.',
    codigo: 'ruc_requerido',
  }, { status: 403 });
}
