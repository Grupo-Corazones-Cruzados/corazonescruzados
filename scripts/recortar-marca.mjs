#!/usr/bin/env node
/**
 * RECORTA LA FRANJA INFERIOR DE UNA IMAGEN — para quitar la marca de agua de Gemini.
 *
 * Las ilustraciones generadas traen la estrella de Gemini abajo a la derecha. Como el dibujo
 * está centrado y sobra margen, basta con cortar la franja de abajo.
 *
 *   node scripts/recortar-marca.mjs <archivo.png> [más archivos…] [--franja=0.12]
 *
 * · Escribe el resultado **al lado del original**, con el sufijo `-recortado`. El original
 *   NO se toca: si el recorte se pasa, se vuelve a intentar con otro porcentaje sin haber
 *   perdido nada.
 * · **Conserva el canal alfa.** Es lo único que importa aquí: estas ilustraciones van sobre
 *   el fondo oscuro del sitio, y una imagen sin transparencia dibujaría un rectángulo.
 *   Por eso solo acepta PNG o WebP — un JPEG no tiene alfa y no sirve.
 * · Avisa de cuánto dibujo hay en la franja que va a cortar, para no comerse parte de la
 *   ilustración sin enterarse.
 */

import sharp from 'sharp';
import path from 'node:path';

const args = process.argv.slice(2);
const franja = Number(args.find((a) => a.startsWith('--franja='))?.split('=')[1] ?? 0.12);
const archivos = args.filter((a) => !a.startsWith('--'));

if (!archivos.length) {
  console.error('Uso: node scripts/recortar-marca.mjs <archivo.png> [...] [--franja=0.12]');
  process.exit(1);
}

for (const archivo of archivos) {
  const img = sharp(archivo);
  const { width, height, hasAlpha, format } = await img.metadata();

  if (format !== 'png' && format !== 'webp') {
    console.error(`✖ ${path.basename(archivo)}: es ${format}. Hace falta el PNG original, con transparencia.`);
    continue;
  }
  if (!hasAlpha) {
    console.error(`✖ ${path.basename(archivo)}: no tiene canal alfa. Sobre el fondo oscuro del sitio se vería un rectángulo.`);
    continue;
  }

  const alto = Math.round(height * (1 - franja));

  // ¿Queda dibujo en lo que vamos a cortar? Se mira el alfa máximo de esa franja: si hay
  // píxeles opacos más allá de la esquina de la marca, es que el recorte se está comiendo
  // parte de la ilustración.
  const franjaBuf = await sharp(archivo)
    .extract({ left: 0, top: alto, width, height: height - alto })
    .ensureAlpha()
    .extractChannel('alpha')
    .stats();
  const opacidadMaxima = Math.round((franjaBuf.channels[0].max / 255) * 100);

  const salida = archivo.replace(/(\.[^.]+)$/, '-recortado$1');
  await sharp(archivo)
    .extract({ left: 0, top: 0, width, height: alto })
    .toFile(salida);

  console.log(
    `✔ ${path.basename(archivo)} → ${path.basename(salida)}  ${width}×${height} → ${width}×${alto}` +
    (opacidadMaxima > 10 ? `  ⚠️ la franja cortada tenía dibujo (opacidad hasta ${opacidadMaxima}%)` : ''),
  );
}
