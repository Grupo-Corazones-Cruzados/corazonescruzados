#!/usr/bin/env node
/**
 * Mide el rig de la hoja de PRUEBA y lo deja en `godot/assets/rig-prueba.json`.
 *
 * Ojo: esto es solo para el banco de pruebas del escritorio. El rig del jugador
 * NO puede ser fijo, porque depende de lo que lleve puesto —una túnica no ocupa
 * lo mismo que una camisa—, así que en el juego real lo calcula el servidor con
 * la misma función y viaja junto a la hoja (ver /api/character/rig).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { medirEsqueleto, ORDEN } from '../lib/game/esqueleto.js';

const hoja = path.join(process.cwd(), 'godot', 'assets', 'personaje-prueba.png');
const { data, info } = await sharp(hoja).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = new Uint8ClampedArray(data);

const vistas = [];
for (let v = 0; v < 4; v++) {
  vistas.push(medirEsqueleto(px, info.width, v, { esFalda: true }));
}

const salida = path.join(process.cwd(), 'godot', 'assets', 'rig-prueba.json');
await fs.writeFile(salida, JSON.stringify({ version: 2, celda: { ancho: 96, alto: 128 }, orden: ORDEN, vistas }, null, 2));
console.log(`✔ ${path.relative(process.cwd(), salida)} — rig medido de las 4 vistas`);
