import { NextRequest, NextResponse } from 'next/server';
import { icalDelMiembro } from '@/lib/calendar/ical';

type Ctx = { params: Promise<{ archivo: string }> };

/**
 * GET /api/calendario/ical/<token>.ics — el calendario de Mi día en iCal, para suscribirse desde
 * otras apps (portarretrato, Google Calendar → Alexa, Apple, Outlook). Sin sesión: el token secreto
 * ES el acceso. Ver `lib/calendar/ical.ts`.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { archivo } = await ctx.params;
  const token = archivo.replace(/\.ics$/i, '');
  if (!/^[a-f0-9]{48}$/.test(token)) return new NextResponse('No encontrado', { status: 404 });
  try {
    const r = await icalDelMiembro(token);
    if (!r) return new NextResponse('Enlace desactivado o regenerado', { status: 404 });
    return new NextResponse(r.ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="gcc-world.ics"',
        'Cache-Control': 'private, max-age=300',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (err: any) {
    console.error('iCal:', err.message);
    return new NextResponse('Error', { status: 500 });
  }
}
