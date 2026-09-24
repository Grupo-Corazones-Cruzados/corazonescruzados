/**
 * UN ENLACE DE PAGO PARA UN PRODUCTO QUE LO PIDE.
 *
 * ── POR QUÉ EXISTE (Fernando, 2026-09-23) ────────────────────────────────────────
 * «Que ya sea el pago se haga aquí o en el módulo de suscripciones sea lo mismo». La
 * pantalla de pago —tarjeta con la pasarela, o transferencia con comprobante que un humano
 * confirma— **ya existe y es esta**. Lo que faltaba era una forma de llegar a ella desde
 * un producto, donde el cliente tiene su sesión del producto y no la de la plataforma.
 *
 * De las tres salidas posibles, esta es la que NO duplica la facturación:
 *   · rehacer el pago dentro del producto → dos implementaciones del cobro. Descartada.
 *   · mandarlo a iniciar sesión aquí → funciona, pero le pide identificarse otra vez.
 *   · **darle un enlace con token** → entra directo a la pantalla de siempre. Esta.
 *
 * ── LO QUE ESTE ENDPOINT *NO* HACE ───────────────────────────────────────────────
 * No cobra, no confirma y no toca facturas. Solo crea el mismo enlace que el equipo GCC
 * crea a mano desde el panel, con la misma función (`crearEnlaceDePago`) y por tanto con
 * las mismas comprobaciones: que el periodo no esté ya pagado, que haya correo del
 * cliente, y la cotización con el recargo de la pasarela.
 *
 * ── LA AUTENTICACIÓN ─────────────────────────────────────────────────────────────
 * Secreto compartido en `CRON_TOKEN`, el mismo que ya usa el worker del agente. Se reusa a
 * propósito: es el mismo mecanismo, ya está desplegado en los dos servicios, y un secreto
 * menos es un secreto menos que rotar y que olvidar.
 *
 * Y lo que se puede hacer con él aquí es acotado: generar un enlace para PAGAR una
 * suscripción. Quien lo tuviera no podría cobrar a nadie ni darse nada por pagado — lo
 * único que conseguiría es una página donde pagarle a GCC.
 *
 * Fail-closed: sin `CRON_TOKEN` en el servidor, 503.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { crearEnlaceDePago } from '@/lib/pagos/enlaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cuánto dura el enlace. Un mes: es lo que se le espera al cliente para pagar. */
const HORAS = 24 * 30;

export async function POST(req: NextRequest) {
  if (!cronTokenConfigured()) {
    return NextResponse.json({ error: 'Falta CRON_TOKEN en el servidor' }, { status: 503 });
  }
  if (!checkCronToken(req)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  const cuerpo = await req.json().catch(() => ({}));
  const suscripcionId = Number(cuerpo.suscripcionId);
  const periodo = String(cuerpo.periodo || '').trim();
  const pedidoPor = String(cuerpo.pedidoPor || 'producto').trim();

  if (!Number.isInteger(suscripcionId) || suscripcionId <= 0) {
    return NextResponse.json({ error: 'Falta la suscripción.' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return NextResponse.json({ error: 'El periodo tiene que ser AAAA-MM.' }, { status: 400 });
  }

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const enlace = await crearEnlaceDePago({
      sourceType: 'subscription',
      // Es el formato que entiende `partesMesSuscripcion`: «<id>-<AAAA-MM>».
      sourceId: `${suscripcionId}-${periodo}`,
      stageId: null,
      horas: HORAS,
      // Queda escrito QUIÉN pidió el enlace: si mañana hay que auditar un cobro, la
      // diferencia entre «lo generó el equipo» y «lo pidió el cliente desde su producto»
      // es justo lo que se querrá saber.
      createdBy: `producto:${pedidoPor}`,
      baseUrl: base,
    });
    return NextResponse.json({ ok: true, url: enlace.url, expiraEn: enlace.expiresAt });
  } catch (e: any) {
    // El mensaje se devuelve tal cual: los de `crearEnlaceDePago` están escritos para que
    // los lea una persona («esta suscripción no tiene correo asociado»), y esconderlos
    // detrás de un «error» genérico obligaría a mirar los registros para algo que el
    // propio cliente puede resolver.
    return NextResponse.json({ error: e?.message ?? 'No se pudo crear el enlace.' }, { status: 400 });
  }
}
