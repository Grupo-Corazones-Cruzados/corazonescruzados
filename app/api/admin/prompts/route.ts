import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { listPromptProjects } from '@/lib/admin/prompts';

export const dynamic = 'force-dynamic';

/** GET — los proyectos del módulo Proyectos con lo que lleva escrito su documento (solo admin). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listPromptProjects() });
  } catch (err: any) {
    console.error('Prompts list:', err.message);
    return NextResponse.json({ error: 'No se pudieron cargar los proyectos.' }, { status: 500 });
  }
}
