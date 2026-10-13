import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { nombresDe } from '@/lib/media';

export const dynamic = 'force-dynamic';

// GET /api/incidents/[id] — single incident with full images
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // `nombres` de las fotos en Drive y si quien mira puede renombrarlas (solo el equipo: el
  // portal es público y a un cliente no se le enseña un lápiz que le daría error).
  const user = await getCurrentUser().catch(() => null);
  return NextResponse.json({
    ...incident,
    nombres: await nombresDe(incident.images),
    puedeRenombrar: !!user && (user.role === 'admin' || user.role === 'member'),
  });
}
