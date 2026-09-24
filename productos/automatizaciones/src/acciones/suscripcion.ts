'use server';

import { contextoApi } from '@/lib/inquilino';
import { estadoSuscripcionGcc } from '@/lib/suscripcionGcc';
import { leerSesionUsuario } from '@/lib/sesion';
import { prisma } from '@/lib/db';

export type ResultadoEnlace = { ok: true; url: string } | { ok: false; error: string };

/**
 * PEDIRLE A LA PLATAFORMA EL ENLACE PARA PAGAR UN MES.
 *
 * El producto no cobra: la pantalla de pago —tarjeta o transferencia con comprobante— es
 * la de la plataforma, que es donde se factura. Esto solo consigue la llave para entrar
 * en ella sin que el cliente tenga que identificarse otra vez.
 *
 * ⚠️ EL PERIODO NO LO ELIGE EL NAVEGADOR. Se calcula aquí, del estado real de la
 * suscripción: el más antiguo que quede por pagar. Si viniera del cliente, podría pedir un
 * enlace de un mes cualquiera y dejar los anteriores sin pagar — y la deuda quedaría igual
 * pero repartida de forma que nadie la ve.
 */
export async function enlaceDePago(slug: string): Promise<ResultadoEnlace> {
  const ctx = await contextoApi(slug);
  // ⚠️ `contextoApi` exige acceso, y quien necesita pagar es justo el que NO lo tiene.
  // Así que si no pasa por ahí, se comprueba la sesión a mano y se sigue.
  const sesion = ctx?.sesion ?? (await leerSesionUsuario());
  if (!sesion || sesion.slug !== slug) return { ok: false, error: 'No tienes sesión.' };

  const inquilino = await prisma.inquilino.findUnique({ where: { id: sesion.inquilinoId } });
  if (!inquilino || inquilino.slug !== slug) return { ok: false, error: 'Ese cliente no existe.' };
  if (!inquilino.gccSuscripcionId) {
    return { ok: false, error: 'Tu suscripción todavía no está enlazada. Escríbenos a hola@grupocc.org.' };
  }

  const estado = await estadoSuscripcionGcc(inquilino.gccSuscripcionId);
  if (!estado) return { ok: false, error: 'No encontramos tu suscripción.' };
  if (estado.esperandoConfirmacion) {
    return {
      ok: false,
      error: `Ya enviaste el comprobante de ${estado.esperandoConfirmacion.periodo}. Está esperando que alguien de GCC lo revise.`,
    };
  }
  const periodo = estado.pendientes[0];
  if (!periodo) return { ok: false, error: 'No tienes ningún mes pendiente de pago.' };

  const base = (process.env.GCC_URL || 'https://app.grupocc.org').replace(/\/$/, '');
  const token = process.env.CRON_TOKEN;
  if (!token) return { ok: false, error: 'Falta la configuración del enlace de pago.' };

  try {
    const r = await fetch(`${base}/api/productos/enlace-pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-token': token },
      body: JSON.stringify({
        suscripcionId: inquilino.gccSuscripcionId,
        periodo,
        pedidoPor: `${slug}/${sesion.nombre}`,
      }),
      cache: 'no-store',
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.url) return { ok: false, error: j?.error ?? 'No se pudo generar el enlace de pago.' };
    return { ok: true, url: j.url };
  } catch (e: any) {
    return { ok: false, error: 'No se pudo contactar con la plataforma de pagos.' };
  }
}
