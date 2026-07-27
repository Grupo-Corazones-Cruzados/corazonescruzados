#!/usr/bin/env node
/**
 * Escribe el rig en `godot/assets/rig-personaje.json`.
 *
 * Godot y la web deben cortar el personaje EXACTAMENTE por los mismos sitios, o
 * el muñeco se descoyunta. En vez de copiar los números a mano en GDScript —que
 * es como se desincronizan las cosas— se exportan del módulo que ya los tiene.
 * Al tocar `lib/game/esqueleto.js`, se relanza esto y Godot se entera.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ESQUELETO, ORDEN } from '../lib/game/esqueleto.js';

const salida = path.join(process.cwd(), 'godot', 'assets', 'rig-personaje.json');
await fs.mkdir(path.dirname(salida), { recursive: true });
await fs.writeFile(salida, JSON.stringify({
  version: 1,
  celda: { ancho: 96, alto: 128 },
  orden: ORDEN,
  esqueleto: ESQUELETO,
}, null, 2));

const n = Object.values(ESQUELETO).reduce((s, e) => s + Object.keys(e).length, 0);
console.log(`✔ godot/assets/rig-personaje.json — ${n} definiciones`);
