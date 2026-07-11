import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listPesosDePremisa, aplicarPesoAFuente, quitarPeso } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?premisa_id= — pesos aplicados a una premisa.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('premisa_id'));
    if (!id) return NextResponse.json({ error: 'Falta premisa_id' }, { status: 400 });
    return NextResponse.json({ data: await listPesosDePremisa(id) });
  } catch (err: any) {
    console.error('GD pesos GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — aplica un peso a una premisa { premisa_fuente_id, peso_fuente_id }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { premisa_fuente_id, peso_fuente_id } = await req.json();
    if (!premisa_fuente_id) return NextResponse.json({ error: 'Falta premisa_fuente_id' }, { status: 400 });
    if (!peso_fuente_id) return NextResponse.json({ error: 'Falta peso_fuente_id' }, { status: 400 });
    const cred = await aplicarPesoAFuente(Number(premisa_fuente_id), Number(peso_fuente_id));
    return NextResponse.json({ data: { credibilidad: cred } });
  } catch (err: any) {
    console.error('GD pesos POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — quita un peso de una premisa { premisa_fuente_id, peso_fuente_id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { premisa_fuente_id, peso_fuente_id } = await req.json();
    if (!premisa_fuente_id) return NextResponse.json({ error: 'Falta premisa_fuente_id' }, { status: 400 });
    if (!peso_fuente_id) return NextResponse.json({ error: 'Falta peso_fuente_id' }, { status: 400 });
    await quitarPeso(Number(premisa_fuente_id), Number(peso_fuente_id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD pesos DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
