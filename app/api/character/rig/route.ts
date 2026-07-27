import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pool } from '@/lib/db';
import { getPlayerSession } from '@/lib/world/player';
import { componer, CELDA, VISTAS } from '@/lib/game/componer.js';
import { medirEsqueleto, ORDEN } from '@/lib/game/esqueleto.js';

/**
 * El RIG del personaje del jugador: por dónde cortarlo y por dónde articula.
 *
 * No puede ser un archivo fijo. El esqueleto **depende de lo que lleve puesto**
 * —una túnica no ocupa lo mismo que una camisa, y de perfil la figura es mucho
 * más estrecha que de frente—, así que se mide sobre la hoja de ESE jugador,
 * una vista por una. Es el mismo código que usa el creador, de modo que las dos
 * partes cortan por idéntico sitio.
 */
export async function GET() {
  try {
    const { clientId } = await getPlayerSession();
    if (!clientId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { rows } = await pool.query('SELECT character_data FROM gcc_world.clients WHERE id = $1', [clientId]);
    const eleccion = rows[0]?.character_data;
    if (!eleccion?.sexo) return NextResponse.json({ error: 'Sin personaje nuevo' }, { status: 404 });

    const raiz = path.join(process.cwd(), 'public');
    const catalogo = JSON.parse(await fs.readFile(path.join(raiz, 'personajes', 'catalogo.json'), 'utf8'));
    const sexo = catalogo.sexos[eleccion.sexo];
    const pixeles = async (ruta: string | null) =>
      ruta ? new Uint8ClampedArray(await sharp(path.join(raiz, ruta)).ensureAlpha().raw().toBuffer()) : null;
    const de = (lista: { id: string; ruta: string | null }[], id: string) =>
      lista.find((p) => p.id === id)?.ruta ?? sexo.base;

    const hoja = componer({
      cabeza: await pixeles(de(sexo.peinado, eleccion.peinado)),
      arriba: await pixeles(de(sexo.arriba, eleccion.arriba)),
      abajo: await pixeles(de(sexo.abajo, eleccion.abajo)),
      accesorio: await pixeles(sexo.accesorio.find((p: { id: string }) => p.id === eleccion.accesorio)?.ruta ?? null),
    }, eleccion);

    // Con falda el rig es otro: el faldón se mece entero en vez de partirse en
    // dos piernas (probado — partido, se abre en canal).
    const esFalda = /falda|vestido|tunica/i.test(String(eleccion.abajo ?? ''));
    const vistas = [];
    for (let v = 0; v < VISTAS; v++) {
      vistas.push(medirEsqueleto(hoja, CELDA.ancho * VISTAS, v, { esFalda }));
    }

    return NextResponse.json(
      { version: 2, celda: CELDA, orden: ORDEN, vistas },
      { headers: { 'Cache-Control': 'no-cache, must-revalidate' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Character rig error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
