import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { getStats, lastRun } from '@/lib/centralized/pensamientos-db';

export const dynamic = 'force-dynamic';

/** GET — series para los gráficos del usuario + cuándo corrió por última vez el etiquetado. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const subject = await resolveSubject(user);
    if (!subject) {
      return NextResponse.json({ data: { days: [], months: [], totals: { count: 0, chars: 0, uncategorized: 0 }, lastRun: null } });
    }
    const [stats, run] = await Promise.all([getStats(subject), lastRun()]);
    return NextResponse.json({ data: { ...stats, lastRun: run } });
  } catch (err: any) {
    console.error('Pensamientos stats:', err.message);
    return NextResponse.json({ error: 'No se pudieron cargar las estadísticas.' }, { status: 500 });
  }
}
