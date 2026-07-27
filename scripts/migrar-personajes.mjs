#!/usr/bin/env node
/**
 * Traduce los personajes del creador VIEJO (LPC) al formato nuevo.
 * ================================================================
 *
 * Lo que se puede traducir se traduce; lo que no, se deja en su valor por
 * defecto y el jugador lo ajusta si quiere. No se inventa nada: el creador viejo
 * y el nuevo no comparten catálogo —son dibujos distintos—, así que lo honesto
 * es conservar lo que SÍ significa lo mismo (sexo, tono de piel, color de pelo,
 * complexión, nombre) y no fingir equivalencias de prendas que no existen.
 *
 * Guarda el original en `character_data_v1` por si hay que volver atrás.
 *
 *   node scripts/migrar-personajes.mjs           (solo enseña qué haría)
 *   node scripts/migrar-personajes.mjs --aplicar
 */
import 'dotenv/config';
import pg from 'pg';

const APLICAR = process.argv.includes('--aplicar');

/** LPC guardaba el cuerpo como 'female' | 'male' | 'muscular' | 'pregnant' | 'teen'. */
function traducirSexo(v) {
  const b = String(v?.bodyType ?? '').toLowerCase();
  if (b.includes('female') || b.includes('pregnant')) return 'mujer';
  if (b.includes('male') || b.includes('muscular')) return 'hombre';
  return 'mujer';
}

/** El viejo guardaba un color en hexadecimal; se busca la rampa más cercana. */
function traducirPelo(v) {
  const hex = String(v?.hairColor ?? '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 'castano';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luz = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (sat < 25) return luz > 140 ? 'ceniza' : 'negro';
  if (luz > 150) return 'rubio';
  if (r > g * 1.6) return 'pelirrojo';
  return luz < 60 ? 'negro' : 'castano';
}

function traducirPiel(v) {
  const hex = String(v?.skinColor ?? '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 'media';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luz = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luz > 200) return 'clara';
  if (luz > 165) return 'media';
  if (luz > 130) return 'tostada';
  if (luz > 95) return 'morena';
  return 'oscura';
}

const NIVELES = ['delgada', 'normal', 'media', 'fuerte', 'ancha'];

function traducir(viejo) {
  return {
    sexo: traducirSexo(viejo),
    peinado: 'base',
    accesorio: 'ninguno',
    arriba: 'base',
    abajo: 'base',
    complexion: NIVELES[Math.min(4, Math.max(0, Number(viejo?.build ?? 1)))] ?? 'normal',
    pelo: traducirPelo(viejo),
    piel: traducirPiel(viejo),
    ojos: 'normales',
    boca: 'neutra',
    colorOjos: 'marron',
    nombre: viejo?.name ?? viejo?.alias ?? 'Sin nombre',
  };
}

const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await cliente.connect();

await cliente.query(`ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS character_data_v1 jsonb`);
const { rows } = await cliente.query(
  `SELECT id, alias, character_data FROM gcc_world.clients WHERE character_data IS NOT NULL`,
);

let migrados = 0;
for (const fila of rows) {
  const datos = fila.character_data;
  if (datos?.sexo) { console.log(`= ${fila.alias}: ya está en el formato nuevo`); continue; }
  const nuevo = traducir(datos);
  console.log(`→ ${fila.alias}: ${nuevo.sexo}, pelo ${nuevo.pelo}, piel ${nuevo.piel}, complexión ${nuevo.complexion}`);
  if (APLICAR) {
    await cliente.query(
      `UPDATE gcc_world.clients
          SET character_data_v1 = COALESCE(character_data_v1, character_data),
              character_data = $1::jsonb
        WHERE id = $2`,
      [JSON.stringify(nuevo), fila.id],
    );
    migrados++;
  }
}

console.log(APLICAR
  ? `\n✔ ${migrados} personaje(s) migrado(s). El original queda en character_data_v1.`
  : `\n(prueba en seco: nada se ha tocado. Añade --aplicar para hacerlo de verdad)`);
await cliente.end();
