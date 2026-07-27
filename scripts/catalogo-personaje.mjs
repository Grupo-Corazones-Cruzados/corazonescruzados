#!/usr/bin/env node
/**
 * Escribe `public/personajes/catalogo.json` con lo que hay en disco.
 *
 * El catálogo se GENERA, no se mantiene a mano: así, cuando se añade una prenda
 * o un peinado con `generar-personaje.mjs`, basta volver a lanzar esto y aparece
 * en el creador. Lo leen tanto el navegador (creador) como el servidor (para
 * componer la hoja que consume Godot), de ahí que sea un JSON y no un módulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const RAIZ = process.cwd();
const DIR = 'public/personajes';
const nombre = (id) => id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

async function piezas(sexo, carpeta) {
  const dir = path.join(RAIZ, DIR, sexo, carpeta);
  const hay = await fs.readdir(dir).catch(() => []);
  return hay
    .filter((f) => f.endsWith('.png') && !f.includes('.crudo.'))
    .map((f) => f.replace('.png', ''))
    .sort()
    .map((id) => ({ id, nombre: nombre(id), ruta: `/personajes/${sexo}/${carpeta}/${id}.png` }));
}

const catalogo = { version: 1, celda: { ancho: 96, alto: 128 }, bandas: { cuello: 42, cintura: 80 }, sexos: {} };

for (const sexo of ['mujer', 'hombre']) {
  const base = { id: 'base', nombre: 'Base', ruta: `/personajes/base/${sexo}.png` };
  catalogo.sexos[sexo] = {
    base: base.ruta,
    // El peinado y el accesorio son ranuras DISTINTAS: el jugador elige las dos.
    peinado: [base, ...(await piezas(sexo, 'pelo'))],
    accesorio: [{ id: 'ninguno', nombre: 'Ninguno', ruta: null }, ...(await piezas(sexo, 'tocado-capa'))],
    arriba: [base, ...(await piezas(sexo, 'superior'))],
    abajo: [base, ...(await piezas(sexo, 'inferior'))],
  };
}

await fs.writeFile(path.join(RAIZ, DIR, 'catalogo.json'), JSON.stringify(catalogo, null, 2));
const n = Object.values(catalogo.sexos).reduce((s, x) => s + x.peinado.length + x.accesorio.length + x.arriba.length + x.abajo.length, 0);
console.log(`✔ public/personajes/catalogo.json — ${n} piezas`);
