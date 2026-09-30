import { NextRequest, NextResponse } from 'next/server';
import { loadCategories, ownerByIncidentsToken } from '@/lib/incidents/schema';
import { listarIncidentes, crearIncidente } from '@/lib/incidents/rutas';

export const dynamic = 'force-dynamic';

/**
 * Portal público: dueño (proyecto o ticket) + incidentes + catálogo. Sin login: el token va
 * en la URL. La respuesta sigue llamando `project` al dueño para no tocar el portal.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const owner = await ownerByIncidentsToken(token);
    if (!owner) return NextResponse.json({ error: 'Enlace inválido o revocado' }, { status: 403 });
    return NextResponse.json({
      project: { title: owner.title },
      incidents: await listarIncidentes(owner),
      categories: await loadCategories(owner),
    });
  } catch (err: any) {
    console.error('Public incidents GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

/** Portal público: el cliente externo crea un incidente. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const owner = await ownerByIncidentsToken(token);
    if (!owner) return NextResponse.json({ error: 'Enlace inválido o revocado' }, { status: 403 });
    const r = await crearIncidente(owner, await req.json(), null);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ data: r.data }, { status: 201 });
  } catch (err: any) {
    console.error('Public incidents POST error:', err.message);
    return NextResponse.json({ error: 'Error al crear el incidente' }, { status: 500 });
  }
}
