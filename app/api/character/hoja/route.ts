import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pool } from '@/lib/db';
import { getPlayerSession } from '@/lib/world/player';
// Módulo JS compartido con el navegador (sin tipos propios).
import { componer, CELDA, VISTAS } from '@/lib/game/componer.js';

/**
 * La HOJA DE SPRITES del personaje del jugador, ya compuesta, en PNG.
 *
 * Godot no tiene por qué saber de peinados, bandas ni rampas de color: pide esta
 * ruta y recibe una imagen de 384×128 con las cuatro vistas. Toda la lógica vive
 * en `lib/game/componer.js`, **el mismo módulo que usa el creador en el
 * navegador**, así que lo que el jugador vio al crearse es exactamente lo que
 * carga el juego.
 *
 * Se compone al vuelo en vez de guardarse: así, si mañana se corrige una pieza o
 * se añade una prenda, los personajes existentes mejoran solos sin migrar nada.
 * Cuesta unos milisegundos y el navegador lo cachea.
 */
export async function GET() {
  try {
    const { clientId } = await getPlayerSession();
    if (!clientId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { rows } = await pool.query(
      'SELECT character_data FROM gcc_world.clients WHERE id = $1',
      [clientId],
    );
    const eleccion = rows[0]?.character_data;
    if (!eleccion || typeof eleccion !== 'object') {
      return NextResponse.json({ error: 'Sin personaje creado' }, { status: 404 });
    }
    // Personajes del creador VIEJO (formato LPC): no se pueden componer aquí.
    if (!eleccion.sexo) {
      return NextResponse.json(
        { error: 'Este personaje es del creador anterior; hay que volver a crearlo' },
        { status: 409 },
      );
    }

    const raiz = path.join(process.cwd(), 'public');
    const catalogo = JSON.parse(await fs.readFile(path.join(raiz, 'personajes', 'catalogo.json'), 'utf8'));
    const sexo = catalogo.sexos[eleccion.sexo];
    if (!sexo) return NextResponse.json({ error: 'Sexo desconocido' }, { status: 400 });

    const pixeles = async (ruta: string | null) => {
      if (!ruta) return null;
      const buf = await sharp(path.join(raiz, ruta)).ensureAlpha().raw().toBuffer();
      return new Uint8ClampedArray(buf);
    };
    const de = (lista: { id: string; ruta: string | null }[], id: string) =>
      lista.find((p) => p.id === id)?.ruta ?? sexo.base;

    const piezas = {
      cabeza: await pixeles(de(sexo.peinado, eleccion.peinado)),
      arriba: await pixeles(de(sexo.arriba, eleccion.arriba)),
      abajo: await pixeles(de(sexo.abajo, eleccion.abajo)),
      accesorio: await pixeles(sexo.accesorio.find((p: { id: string }) => p.id === eleccion.accesorio)?.ruta ?? null),
    };

    const hoja = componer(piezas, eleccion);
    const png = await sharp(Buffer.from(hoja), {
      raw: { width: CELDA.ancho * VISTAS, height: CELDA.alto, channels: 4 },
    }).png().toBuffer();

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        // Se revalida siempre: al corregir una pieza, el juego debe verlo.
        'Cache-Control': 'no-cache, must-revalidate',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Character hoja error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
