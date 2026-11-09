import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { cuentaDe, guardarCuenta, puedeCobrar, contactoDe } from '@/lib/pagos-miembros';
import { sendCuentaCobroCambiadaEmail } from '@/lib/integrations/email';

export const dynamic = 'force-dynamic';

/** GET /api/cobros/cuenta — mi cuenta de cobro, sin el número (solo los 4 últimos). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  return NextResponse.json({ data: await cuentaDe(String(user.userId)) });
}

/**
 * PUT /api/cobros/cuenta — registra o cambia MI cuenta de cobro. Solo su dueño: no hay forma de pasar otro
 * usuario, y un administrador que mira como otro (`suplantadoPor`) no puede: sería la vía para desviar los
 * pagos de alguien a otra cuenta. Cada cambio queda en el registro y se le avisa por correo.
 */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (user.suplantadoPor) {
    return NextResponse.json({ error: 'La cuenta de cobro solo la cambia su dueño, no se puede mirando como otro.' }, { status: 403 });
  }
  const userId = String(user.userId);
  if (!(await puedeCobrar(userId))) return NextResponse.json({ error: 'Tu cuenta no recibe pagos.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const r = await guardarCuenta(userId, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  if (r.cambios.length > 0) {
    const c = await contactoDe(userId);
    if (c) {
      await sendCuentaCobroCambiadaEmail({ email: c.email, nombre: c.nombre, ultimos4: r.cuenta.ultimos4, nueva: r.nueva })
        .catch((e) => console.error('[cobros] no se pudo avisar del cambio de cuenta', userId, e?.message));
    }
  }
  return NextResponse.json({ data: r.cuenta });
}
