import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { cuentaDescifrada } from '@/lib/pagos-miembros';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pagos-miembros/cuenta?userId=<uuid> — la cuenta de cobro CON el número, para transferir. Solo
 * administradores, y cada consulta queda en `member_bank_account_log` ('viewed'). La pide el panel de registrar
 * un pago al abrirse; en ningún otro sitio se enseña el número entero.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const userId = req.nextUrl.searchParams.get('userId') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: 'Usuario no válido' }, { status: 400 });
  }
  try {
    const cuenta = await cuentaDescifrada(userId, String(user.userId));
    return NextResponse.json({ data: cuenta }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('[pagos-miembros] no se pudo descifrar la cuenta', userId, e?.message);
    return NextResponse.json({ error: 'No se pudo leer el número de cuenta. Pide a la persona que lo vuelva a registrar.' }, { status: 500 });
  }
}
