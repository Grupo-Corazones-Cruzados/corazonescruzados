import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { cobrosDe, cuentaDe } from '@/lib/pagos-miembros';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cobros — «Mis cobros» (Configuración → Cobros): las ganancias, los pagos, el saldo y la cuenta
 * bancaria (sin el número) de QUIEN PREGUNTA. No admite otro usuario: el de la sesión y punto.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const userId = String(user.userId);
  const [cobros, cuenta] = await Promise.all([cobrosDe(userId), cuentaDe(userId)]);
  return NextResponse.json({ data: { ...cobros, cuenta } });
}
