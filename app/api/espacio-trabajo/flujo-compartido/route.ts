import { NextResponse } from 'next/server';
import { llamarServicio, rechazo } from '@/lib/espacio-trabajo/guardia';
import { publicarFlujo } from '@/lib/espacio-trabajo/flujo-compartido';
import { sendFlujoCompartidoEmail } from '@/lib/integrations/email';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';

/** Copia el diagrama de un proyecto a la base, da su enlace temporal y, si se pide, lo manda por correo. */
export async function POST(req: Request) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const cuerpo = await req.json().catch(() => ({}));
  const id = String(cuerpo.proyecto || '');
  const horas = Math.min(Math.max(Number(cuerpo.horas) || 168, 1), 8760);
  const correo = cuerpo.email ? String(cuerpo.email).trim().toLowerCase() : '';
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return NextResponse.json({ error: 'El correo no es válido.' }, { status: 400 });

  const rp = await llamarServicio('/proyectos');
  if (!rp.ok) return NextResponse.json({ error: 'El servicio local no responde.' }, { status: 502 });
  const proyecto = ((await rp.json()).proyectos as { id: string; nombre: string; aislado: boolean }[]).find((p) => p.id === id);
  if (!proyecto) return NextResponse.json({ error: 'Ese proyecto no existe.' }, { status: 404 });
  if (proyecto.aislado) return NextResponse.json({ error: 'Un proyecto aislado no se comparte.' }, { status: 409 });
  const rf = await llamarServicio(`/proyectos/${encodeURIComponent(id)}/flujo`);
  const { flujo, actualizado } = rf.ok ? await rf.json() : { flujo: null, actualizado: null };
  if (!flujo) return NextResponse.json({ error: 'Este proyecto aún no tiene diagrama.' }, { status: 409 });

  const { token, vence } = await publicarFlujo({ proyecto: id, nombre: proyecto.nombre, doc: flujo, actualizado, horas, correo: correo || null });
  const url = `${APP_URL}/flujo/${token}`;
  let enviado = false;
  if (correo) {
    // Si el correo falla, el enlace ya existe y se puede copiar: el aviso lo da quien llama.
    try { await sendFlujoCompartidoEmail({ email: correo, proyecto: proyecto.nombre, url, vence }); enviado = true; }
    catch (e: any) { console.error('sendFlujoCompartidoEmail:', e?.message); }
  }
  return NextResponse.json({ url, vence: vence.toISOString(), enviado });
}
