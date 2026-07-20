import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthedClient } from '@/lib/world/auth';
// Se importa del catálogo puro, NO de CharacterCreator: ese componente lleva
// 'use client', y desde el servidor sus constantes llegan como proxy en vez de
// como array (falla con "SHOES_STYLES.find is not a function").
import { resolveCharacterLayers, type CharacterConfig } from '@/lib/game/lpc-catalog';

/**
 * Devuelve las capas de imagen que componen el personaje del jugador, en orden
 * de dibujo.
 *
 * Existe para que el motor NO tenga que conocer las tablas de estilos (pelo,
 * ropa, calzado, gafas…). Duplicarlas en GDScript significaría que al añadir un
 * peinado nuevo habría que tocarlas en dos sitios y, tarde o temprano, se
 * desincronizarían. Aquí la única fuente de verdad sigue siendo TypeScript.
 *
 * También evita empaquetar los 19 MB de sprites LPC dentro del juego: el motor
 * descarga solo las ~11 imágenes que este jugador usa de verdad.
 */
export async function GET() {
  try {
    const me = await getAuthedClient();
    if (!me) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { rows } = await pool.query(
      'SELECT character_data FROM gcc_world.clients WHERE id = $1',
      [me.id],
    );
    const config = rows[0]?.character_data as CharacterConfig | null;
    if (!config) {
      return NextResponse.json({ error: 'Sin personaje creado' }, { status: 404 });
    }

    return NextResponse.json({
      layers: resolveCharacterLayers(config, true),
      // La complexión no es una capa: se aplica estirando el sprite, porque
      // LPC solo trae 3 siluetas para los 5 niveles que ofrece el creador.
      bodyType: config.bodyType,
      name: config.name ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
