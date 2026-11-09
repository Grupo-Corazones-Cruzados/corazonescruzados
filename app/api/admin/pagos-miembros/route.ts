import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  personasPorPagar, pagosRegistrados, cobrosDe, detallePago, registrarPago, anularPago, contactoDe, ErrorPago,
} from '@/lib/pagos-miembros';
import { subir, aPapelera } from '@/lib/media/drive';
import { limpiarNombre, extension } from '@/lib/media';
import { createNotification } from '@/lib/notifications';
import { sendPagoRegistradoEmail } from '@/lib/integrations/email';
import { hoyEcuador, esFechaISO } from '@/lib/tickets/schema';
import { money } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ADMIN → PAGOS A MIEMBROS. Todo exige rol de administrador (un administrador que mira como otro pierde el rol:
 * ver `TokenPayload.suplantadoPor`).
 *
 *   GET                  → personas con algo ganado o pagado (con su saldo) y los pagos registrados.
 *   GET ?userId=<uuid>   → lo de esa persona: ganancias, pagos y saldo.
 *   GET ?pagoId=<id>     → un pago con lo que pagó y lo que descontó.
 *   POST (multipart)     → registra un pago: userId, esperado, referencia, fecha, nota, ids (JSON), comprobante.
 *   PATCH { id }         → anula un pago.
 *
 * La cuenta bancaria descifrada va aparte (`/cuenta`), para dejar escrito cada vez que alguien la mira.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMPROBANTE = 10 * 1024 * 1024;
const TIPOS_COMPROBANTE = /^(image\/(png|jpeg|webp|gif|heic|heif)|application\/pdf)$/;

async function admin() {
  const user = await getCurrentUser();
  return user && user.role === 'admin' ? user : null;
}

export async function GET(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const sp = req.nextUrl.searchParams;

  const userId = sp.get('userId');
  if (userId) {
    if (!UUID.test(userId)) return NextResponse.json({ error: 'Usuario no válido' }, { status: 400 });
    return NextResponse.json({ data: await cobrosDe(userId) });
  }

  const pagoId = sp.get('pagoId');
  if (pagoId) {
    const n = Number(pagoId);
    const d = Number.isSafeInteger(n) && n > 0 ? await detallePago(n) : null;
    if (!d) return NextResponse.json({ error: 'Ese pago no existe' }, { status: 404 });
    return NextResponse.json({ data: d });
  }

  const [personas, pagos] = await Promise.all([personasPorPagar(), pagosRegistrados()]);
  return NextResponse.json({ data: { personas, pagos } });
}

export async function POST(req: NextRequest) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Formulario no válido' }, { status: 400 });
  const userId = String(form.get('userId') ?? '');
  const referencia = String(form.get('referencia') ?? '').trim().slice(0, 120);
  const fecha = String(form.get('fecha') ?? '');
  const nota = String(form.get('nota') ?? '').trim().slice(0, 1000);
  const esperado = Number(form.get('esperado'));
  let ids: number[] | null = null;
  try {
    const crudo = form.get('ids');
    if (crudo) ids = (JSON.parse(String(crudo)) as unknown[]).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0);
  } catch { return NextResponse.json({ error: 'Selección no válida' }, { status: 400 }); }

  if (!UUID.test(userId)) return NextResponse.json({ error: 'Usuario no válido' }, { status: 400 });
  if (!referencia) return NextResponse.json({ error: 'Escribe la referencia de la transferencia.' }, { status: 400 });
  if (!esFechaISO(fecha) || fecha > hoyEcuador()) return NextResponse.json({ error: 'La fecha del pago no es válida.' }, { status: 400 });
  if (!Number.isFinite(esperado) || esperado <= 0) return NextResponse.json({ error: 'El total no es válido.' }, { status: 400 });

  const persona = await contactoDe(userId);
  if (!persona) return NextResponse.json({ error: 'Esa persona no existe' }, { status: 404 });

  // El comprobante sube ANTES de la transacción (no se sostienen candados mientras se habla con Drive) y, si el
  // pago no se registra, va a la papelera.
  let comprobante: { fileId: string; nombre: string; mime: string } | null = null;
  const archivo = form.get('comprobante');
  if (archivo && typeof archivo !== 'string' && archivo.size > 0) {
    const mime = archivo.type || 'application/octet-stream';
    if (!TIPOS_COMPROBANTE.test(mime)) return NextResponse.json({ error: 'El comprobante tiene que ser una imagen o un PDF.' }, { status: 400 });
    if (archivo.size > MAX_COMPROBANTE) return NextResponse.json({ error: 'El comprobante pasa de 10 MB.' }, { status: 400 });
    const nombre = `${limpiarNombre(`${fecha} · ${referencia}`) || 'comprobante'}.${extension(mime)}`;
    try {
      const sub = await subir({
        datos: Buffer.from(await archivo.arrayBuffer()), nombre, mime,
        ruta: ['Pagos a miembros', limpiarNombre(`${persona.nombre} · ${userId.slice(0, 8)}`)],
      });
      comprobante = { fileId: sub.id, nombre, mime };
    } catch (e: any) {
      console.error('[pagos-miembros] no se pudo subir el comprobante a Drive', e?.message);
      return NextResponse.json({ error: 'No se pudo guardar el comprobante en Drive.' }, { status: 502 });
    }
  }

  let r: { id: number; total: number };
  try {
    r = await registrarPago({ userId, ids, esperado, referencia, fecha, nota: nota || null, comprobante, actor: String(user.userId) });
  } catch (e: any) {
    if (comprobante) await aPapelera(comprobante.fileId).catch(() => {});
    if (e instanceof ErrorPago) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  // Avisos: el pago ya está registrado; si un aviso falla, se anota y no se deshace nada.
  const { saldo, pagos } = await cobrosDe(userId).catch(() => ({ saldo: null, pagos: [] as any[] }));
  const ultimos4 = pagos.find((p: any) => p.id === r.id)?.ultimos4 ?? null;
  await Promise.all([
    createNotification(userId, {
      type: 'payout', title: 'Te transfirieron un pago',
      message: `${money(r.total)} · ${referencia}`, link: '/dashboard/settings?tab=cobros',
    }).catch((e) => console.error('[pagos-miembros] campanita', userId, e?.message)),
    sendPagoRegistradoEmail({ email: persona.email, nombre: persona.nombre, total: r.total, referencia, fecha, ultimos4 })
      .catch((e) => console.error('[pagos-miembros] correo', userId, e?.message)),
  ]);

  return NextResponse.json({ data: { id: r.id, total: r.total, saldo } }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) return NextResponse.json({ error: 'Pago no válido' }, { status: 400 });
  try {
    await anularPago(n, String(user.userId));
  } catch (e: any) {
    if (e instanceof ErrorPago) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
