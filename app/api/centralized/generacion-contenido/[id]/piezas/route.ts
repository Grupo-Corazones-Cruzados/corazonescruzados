import { NextResponse } from 'next/server';
import { ideaDe } from '@/lib/centralized/idea-guardia';
import { driveDe, leerManifiesto, nombrarSiHaceFalta, pendientesDeSubir, piezasDe } from '@/lib/centralized/contenido-local';
import { publicacionesDe, puertaPublicar } from '@/lib/centralized/publicar-idea';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET — el panel de la derecha: lo que entregó el agente, lo que ya está en Drive y si se puede publicar. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await ideaDe(req, (await params).id);
  if (r.fuera) return r.fuera;
  const { c, video } = r;
  if (!video) return NextResponse.json({ video: null, piezas: [], drive: null, pendientes: 0, titulo: c.titulo, publicaciones: [], puerta: null });
  const m = leerManifiesto(video.carpeta);
  await nombrarSiHaceFalta(c.id, m?.titulo);
  const piezas = piezasDe(video.carpeta, m);
  const drive = await driveDe(video.id);
  const { rows: [t] } = await pool.query(`SELECT titulo, publicado_en FROM gcc_world.gcont_contenidos c JOIN gcc_world.gcont_videos v ON v.contenido_id = c.id WHERE v.id = $1`, [video.id]);
  return NextResponse.json({
    video: { id: video.id, sesion_id: video.sesion_id, carpeta: video.carpeta, nombre: video.nombre, tamano: video.tamano },
    titulo: t?.titulo || null, publicado_en: t?.publicado_en || null,
    piezas, drive, pendientes: pendientesDeSubir(piezas, drive),
    sugerido: m ? { titulo: m.titulo, descripcion: m.descripcion } : null,
    publicaciones: await publicacionesDe(video.id),
    puerta: await puertaPublicar(c.user_id, c.talento),
  });
}
