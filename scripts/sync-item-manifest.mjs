#!/usr/bin/env node
/**
 * Sincroniza a Postgres el manifiesto de objetos exportado desde Godot.
 *
 * Es el paso que mantiene la validación del lado del servidor ahora que los
 * mundos se diseñan en Godot. Sin esto, el servidor no sabría qué objetos
 * existen y tendría que creerse lo que dijera el juego — inaceptable cuando las
 * fichas se canjean por productos reales.
 *
 * Forma parte del flujo de publicación:
 *   1. godot --headless --path godot --script res://tools/export_manifest.gd
 *   2. node scripts/sync-item-manifest.mjs
 *   3. godot --headless --path godot --export-release "Web"
 *   4. desplegar
 *
 *   node scripts/sync-item-manifest.mjs            → aplica
 *   node scripts/sync-item-manifest.mjs --dry-run  → solo muestra el cambio
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFIESTO = path.join(ROOT, 'godot', 'import', 'manifiesto.json');

dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config({ path: path.join(ROOT, '.env') });

const dryRun = process.argv.includes('--dry-run');

if (!process.env.DATABASE_URL) {
  console.error('✖ Falta DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL.replace(/[?&]schema=[^&]+/, ''),
  options: '-c search_path=gcc_world,public',
});

async function main() {
  let manifiesto;
  try {
    manifiesto = JSON.parse(await readFile(MANIFIESTO, 'utf8'));
  } catch {
    console.error(
      '✖ No hay manifiesto. Genera antes:\n' +
        '   godot --headless --path godot --script res://tools/export_manifest.gd',
    );
    process.exit(1);
  }

  const placements = manifiesto.placements ?? [];
  const escenas = [...new Set(placements.map((p) => p.scene))];

  const actuales = await pool.query(
    'SELECT scene, placement_id, item_id, x, y FROM gcc_world.item_placements',
  );
  const antes = new Map(actuales.rows.map((r) => [`${r.scene}|${r.placement_id}`, r]));
  const ahora = new Set(placements.map((p) => `${p.scene}|${p.placementId}`));

  const nuevos = placements.filter((p) => !antes.has(`${p.scene}|${p.placementId}`));
  const eliminados = actuales.rows.filter((r) => !ahora.has(`${r.scene}|${r.placement_id}`));

  console.log(`Manifiesto: ${placements.length} objeto(s) en ${escenas.length} escena(s)`);
  console.log(`  nuevos: ${nuevos.length}   eliminados: ${eliminados.length}`);

  if (eliminados.length > 0) {
    // Avisar en vez de borrar en silencio: un objeto que desaparece del
    // manifiesto por error deja de ser recogible y nadie se entera.
    console.log('  se eliminarán:');
    for (const e of eliminados.slice(0, 10)) {
      console.log(`    ${e.scene}/${e.placement_id} (${e.item_id})`);
    }
    if (eliminados.length > 10) console.log(`    …y ${eliminados.length - 10} más`);
  }

  if (dryRun) {
    console.log('\n(--dry-run: no se escribió nada)');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const p of placements) {
      await client.query(
        `INSERT INTO gcc_world.item_placements
           (scene, placement_id, item_id, quantity, x, y, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (scene, placement_id) DO UPDATE
            SET item_id = EXCLUDED.item_id,
                quantity = EXCLUDED.quantity,
                x = EXCLUDED.x,
                y = EXCLUDED.y,
                updated_at = now()`,
        [p.scene, p.placementId, p.itemId, p.cantidad ?? 1, p.x, p.y],
      );
    }

    // Borrar lo que ya no está en el manifiesto. Se limita a las escenas
    // presentes: así exportar un solo mapa no borra los objetos de los demás.
    if (escenas.length > 0) {
      await client.query(
        `DELETE FROM gcc_world.item_placements
          WHERE scene = ANY($1::text[])
            AND (scene || '|' || placement_id) <> ALL($2::text[])`,
        [escenas, placements.map((p) => `${p.scene}|${p.placementId}`)],
      );
    }

    await client.query(
      `INSERT INTO gcc_world.item_placement_syncs (scenes, placements, removed)
       VALUES ($1, $2, $3)`,
      [escenas.length, placements.length, eliminados.length],
    );

    await client.query('COMMIT');
    console.log('\n✔ Sincronizado.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
