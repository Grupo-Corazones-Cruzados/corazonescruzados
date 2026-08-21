/**
 * GENERA LAS ILUSTRACIONES DE LOS PASOS, con el estilo que fijó Fernando.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────
 * Cada paso de cada pregunta lleva una ilustración de fondo, y son decenas. Hacerlas a mano
 * significa repetir el mismo bloque de estilo y el mismo recorte una y otra vez, y ahí es
 * donde se cuelan las diferencias que luego se ven en la página.
 *
 * ⚠️ **EL BLOQUE `ESTILO` ES DE FERNANDO, PALABRA POR PALABRA.** No se toca. Lo único que
 * cambia por imagen es la escena del final, que sigue su patrón: una escena pequeña, y un
 * «Nada más: …» que cierra la lista de lo que puede aparecer.
 *
 * ── ⭐ EL RECORTE AL RAS NO ES OPCIONAL ───────────────────────────────────────
 * El prompt pide «con aire alrededor», y hace bien: sin eso el modelo pega el trazo al borde.
 * Pero ese aire hay que quitarlo antes de guardar. Medido el 2026-08-20: las imágenes recién
 * generadas traían entre un 63 % y un 77 % de lienzo transparente, y como la web las mete
 * enteras con `object-contain`, el dibujo acababa ocupando un tercio del hueco y se veía
 * diminuto al lado de las que Fernando había recortado a mano (0 % de sobrante).
 *
 * Por eso se recorta aquí y no a ojo después: es el paso que hace que todas se vean del mismo
 * tamaño, y el que es fácil olvidar.
 *
 * ── USO ───────────────────────────────────────────────────────────────────────
 *     node scripts/ilustrar-pasos.mjs <archivo> "<escena>" [<archivo> "<escena>" …]
 *
 * `<archivo>` puede llevar carpeta: `clientes/mi-paso` o `desarrollo-humano/mi-paso`. Escribe
 * en `public/<archivo>.webp` y crea la carpeta si hace falta. No toca `contenido.ts`: enlazar
 * la imagen con su paso se hace a mano, porque a qué paso corresponde lo decide quien escribe
 * el texto.
 *
 * ⚠️ Usa `gpt-image-2` de OpenAI. La `GEMINI_API_KEY` del repo **no es válida** (devuelve
 * «API key not valid»); si algún día se repone, este es el único sitio que hay que cambiar.
 */
import fs from 'node:fs';
import sharp from 'sharp';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); dotenv.config({ path: '.env' });

const ESTILO = `Ilustración vectorial de línea, minimalista y geométrica, sobre fondo transparente.

Trazo uniforme de 2 px, extremos y uniones redondeados, sin relleno salvo toques planos de violeta.

Paleta estricta: líneas en violeta claro #a78bfa; superficies rellenas en violeta #7B5FBF al 20-30 %
de opacidad; el fondo de la web es #0b0d14 (casi negro azulado), así que la ilustración debe leerse sobre oscuro.

Prohibido: degradados, sombras, brillos, efecto 3D, perspectiva isométrica, blanco puro, texturas, y cualquier texto, letra o número
dentro de la imagen.

Emparentado con los iconos de Lucide, pero un paso más elaborado: una escena pequeña, no un pictograma.

Composición cuadrada, centrada, con aire alrededor. Debe seguir entendiéndose a 96 px.

`;

/** La caja que de verdad ocupa el dibujo, ignorando todo lo transparente. */
async function cajaDelDibujo(ruta) {
  const { data, info } = await sharp(ruta).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 6) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const pares = process.argv.slice(2);
for (let i = 0; i < pares.length; i += 2) {
  const [archivo, escena] = [pares[i], pares[i + 1]];
  /**
   * ⚠️ CON REINTENTOS, Y NO ES POR SI ACASO: pasó (2026-08-20).
   *
   * Generar una imagen tarda a veces más que el plazo de espera de cabeceras de Node (300 s
   * por defecto), y el `fetch` revienta con `UND_ERR_HEADERS_TIMEOUT`. Sin esto, ese fallo
   * **tumbaba el proceso entero** y se perdían las imágenes que venían detrás en la misma
   * tanda, aunque no tuvieran nada malo.
   *
   * Tres intentos, y si aun así falla se avisa y se sigue con la siguiente: el trabajo de una
   * tanda no puede depender de que las veinte llamadas salgan bien a la primera.
   */
  let j = null;
  for (let intento = 1; intento <= 3 && !j; intento++) {
    try {
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-image-2', prompt: ESTILO + escena,
          size: '1024x1024', background: 'transparent', output_format: 'png', n: 1,
        }),
      });
      j = await r.json();
    } catch (e) {
      console.log(`  … ${archivo}: intento ${intento} falló (${e.cause?.code ?? e.message})`);
    }
  }
  if (!j) { console.log(`  ✖ ${archivo}: sin respuesta tras 3 intentos`); continue; }
  if (j.error) { console.log(`  ✖ ${archivo}: ${j.error.message?.slice(0, 140)}`); continue; }

  const bruto = `/tmp/gcc-${archivo.replace(/\//g, '-')}.png`;
  fs.writeFileSync(bruto, Buffer.from(j.data[0].b64_json, 'base64'));

  const c = await cajaDelDibujo(bruto);
  const esc = 760 / Math.max(c.w, c.h);
  const destino = `public/${archivo}.webp`;
  fs.mkdirSync(destino.slice(0, destino.lastIndexOf('/')), { recursive: true });
  await sharp(bruto)
    .extract({ left: c.x0, top: c.y0, width: c.w, height: c.h })
    .resize(Math.round(c.w * esc), Math.round(c.h * esc))
    .webp({ quality: 92 }).toFile(destino);

  const m = await sharp(destino).metadata();
  console.log(`  ✔ ${archivo}.webp  ${m.width}×${m.height}  (recortado desde 1024×1024)`);
}
