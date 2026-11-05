#!/usr/bin/env node
import { publicarBorrador } from './flujo.mjs';

/** Lo ejecuta la sesión que escribe el diagrama. Solo publica si el borrador cumple las reglas. */
const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Uso: publicar-flujo.mjs <carpeta del flujo>');
  process.exit(2);
}
const r = publicarBorrador(carpeta);
if (r.errores.length) {
  console.error(`No se publicó. Corrige esto en el borrador y vuelve a ejecutar:\n${r.errores.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`Publicado: ${r.roles} roles, ${r.nodos} nodos, ${r.conexiones} conexiones.`);
