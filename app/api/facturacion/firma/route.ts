import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { guardarFirma, puedeFacturar, MAX_P12_BYTES } from '@/lib/facturacion-emisores';
import { contactoDe } from '@/lib/pagos-miembros';
import { sendFirmaRegistradaEmail } from '@/lib/integrations/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST (multipart: `archivo` = el .p12, `clave` = su contraseña) — sube o cambia MI firma electrónica.
 *
 * Solo su dueño, y nunca mirando como otro. El servidor abre el archivo con la clave como lo abrirá el firmador,
 * lo guarda cifrado y responde solo titular y vencimiento: ni el archivo ni la clave vuelven al navegador. Cada
 * cambio queda en `sri_emisor_log` y se avisa por correo.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (user.suplantadoPor) {
    return NextResponse.json({ error: 'La firma electrónica solo la cambia su dueño, no se puede mirando como otro.' }, { status: 403 });
  }
  const userId = String(user.userId);
  if (!(await puedeFacturar(userId))) return NextResponse.json({ error: 'Tu cuenta no factura.' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const archivo = form?.get('archivo');
  const clave = form?.get('clave');
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'Sube el archivo .p12 de tu firma.' }, { status: 400 });
  if (archivo.size > MAX_P12_BYTES) return NextResponse.json({ error: 'El archivo pesa demasiado para ser una firma .p12.' }, { status: 400 });
  if (typeof clave !== 'string' || clave.length === 0 || clave.length > 200) {
    return NextResponse.json({ error: 'Escribe la contraseña de tu firma.' }, { status: 400 });
  }

  const r = await guardarFirma(userId, Buffer.from(await archivo.arrayBuffer()), clave);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  const c = await contactoDe(userId);
  if (c && r.emisor.firma) {
    await sendFirmaRegistradaEmail({ email: c.email, nombre: c.nombre, titular: r.emisor.firma.titular, vence: r.emisor.firma.vence, nueva: r.nueva })
      .catch((e) => console.error('[facturacion] no se pudo avisar del cambio de firma', userId, e?.message));
  }
  return NextResponse.json({ data: r.emisor }, { headers: { 'Cache-Control': 'no-store' } });
}
