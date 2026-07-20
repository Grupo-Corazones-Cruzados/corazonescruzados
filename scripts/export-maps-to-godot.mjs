#!/usr/bin/env node
/**
 * Vuelca los mundos de Postgres a JSON, para importarlos al proyecto de Godot.
 *
 * Por qué existe: al pasar la autoría a Godot, los mundos dejan de vivir en la
 * base de datos y pasan a ser parte del proyecto. Pero ya hay mapas pintados a
 * mano en `gcc_world.world_maps`, y perderlos sería tirar trabajo real. Esto es
 * un puente de UNA sola pasada: saca los datos en un formato plano y neutro que
 * el lado de Godot convierte en escenas de verdad.
 *
 * NO escribe en la base de datos. Solo lee.
 *
 *   node scripts/export-maps-to-godot.mjs            → todos los mapas
 *   node scripts/export-maps-to-godot.mjs main       → solo uno
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
// Node 24 importa TypeScript directamente, así que las capas de cada NPC se
// resuelven AQUÍ, con la misma función que usa la app. Alternativa descartada:
// que el motor pidiera las capas de cada NPC por red al arrancar — una petición
// por NPC y una tabla de estilos duplicada en GDScript.
import { resolveCharacterLayers } from '../lib/game/lpc-catalog.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'godot', 'import', 'maps');

dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config({ path: path.join(ROOT, '.env') });

if (!process.env.DATABASE_URL) {
  console.error('✖ Falta DATABASE_URL');
  process.exit(1);
}

const only = process.argv[2] ?? null;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL.replace(/[?&]schema=[^&]+/, ''),
  options: '-c search_path=gcc_world,public',
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const { rows } = await pool.query(
    `SELECT name, width, height, layers, items, transitions, props,
            spawn_x, spawn_y, ambient_darkness, character_layer
       FROM gcc_world.world_maps
      ${only ? 'WHERE name = $1' : ''}
      ORDER BY name`,
    only ? [only] : [],
  );

  if (rows.length === 0) {
    console.error(only ? `✖ No existe el mapa "${only}"` : '✖ No hay mapas');
    process.exit(1);
  }

  // Los NPCs viven en otra tabla, referenciados por nombre de mapa.
  const { rows: npcRows } = await pool.query(
    `SELECT map_name, name, config, x, y, facing, animation, dialogue
       FROM gcc_world.npcs
      ORDER BY map_name, id`,
  );
  const npcsByMap = new Map();
  for (const n of npcRows) {
    if (!npcsByMap.has(n.map_name)) npcsByMap.set(n.map_name, []);
    // `config` trae el CharacterConfig LPC más campos sueltos (escala,
    // comportamiento) embebidos por el editor anterior.
    const cfg = n.config ?? {};
    let layers = [];
    try {
      // Los NPCs no llevan mochila: es del jugador.
      layers = resolveCharacterLayers(cfg, false);
    } catch {
      // Un NPC con configuración incompleta no debe romper la exportación
      // entera; se queda sin capas y el motor lo dibuja como marcador.
      layers = [];
    }

    npcsByMap.get(n.map_name).push({
      name: n.name,
      config: cfg,
      layers,
      scale: typeof cfg.scale === 'number' ? cfg.scale : 1,
      x: n.x,
      y: n.y,
      facing: n.facing,
      animation: n.animation,
      dialogue: Array.isArray(n.dialogue) ? n.dialogue : [],
    });
  }

  const { rows: lightRows } = await pool.query(
    `SELECT map_name, x, y, radius, color, mode, period_ms, intensity
       FROM gcc_world.lights ORDER BY map_name, id`,
  );
  const lightsByMap = new Map();
  for (const l of lightRows) {
    if (!lightsByMap.has(l.map_name)) lightsByMap.set(l.map_name, []);
    lightsByMap.get(l.map_name).push({
      x: l.x,
      y: l.y,
      radius: Number(l.radius),
      color: l.color,
      mode: l.mode,
      periodMs: l.period_ms,
      intensity: Number(l.intensity),
    });
  }

  let totalTiles = 0;

  for (const row of rows) {
    const layers = Array.isArray(row.layers) ? row.layers : [];
    const tileCount = layers.reduce((n, l) => n + (l.tiles?.length ?? 0), 0);
    totalTiles += tileCount;

    // Qué hojas usa este mapa. El lado de Godot necesita saberlo para montar
    // solo los tilesets necesarios.
    const usedSheets = new Set();
    for (const l of layers) {
      for (const t of l.tiles ?? []) {
        if (!t.color && typeof t.s === 'number') usedSheets.add(t.s);
      }
    }

    const out = {
      name: row.name,
      width: row.width,
      height: row.height,
      spawn: { x: row.spawn_x, y: row.spawn_y },
      ambientDarkness: Number(row.ambient_darkness) || 0,
      characterLayer: row.character_layer ?? null,
      usedSheets: [...usedSheets].sort((a, b) => a - b),
      layers: layers.map((l, i) => ({
        id: l.id ?? `layer-${i}`,
        name: l.name ?? `Capa ${i + 1}`,
        visible: l.visible !== false,
        tiles: l.tiles ?? [],
      })),
      items: Array.isArray(row.items) ? row.items : [],
      transitions: Array.isArray(row.transitions) ? row.transitions : [],
      props: Array.isArray(row.props) ? row.props : [],
      npcs: npcsByMap.get(row.name) ?? [],
      lights: lightsByMap.get(row.name) ?? [],
    };

    const file = path.join(OUT_DIR, `${row.name}.json`);
    await writeFile(file, JSON.stringify(out, null, 2), 'utf8');
    console.log(
      `✔ ${row.name.padEnd(18)} ${String(row.width).padStart(3)}×${String(row.height).padEnd(3)}  ` +
        `${String(tileCount).padStart(6)} tiles  ${String(out.layers.length)} capas  ` +
        `${out.npcs.length} NPCs  ${out.items.length} objetos  ${out.lights.length} luces`,
    );
  }

  console.log(`\n${rows.length} mapa(s), ${totalTiles} tiles en total → godot/import/maps/`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
