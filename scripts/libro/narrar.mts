/**
 * La VOZ del libro (`/libro`): cada página se lee en voz alta, en español de España, con tono de cuentacuentos
 * (Fernando, 2026-11-12: «una voz cuente la historia de forma estilo español España»). OpenAI, el único
 * proveedor de IA del proyecto: `gpt-4o-mini-tts`, que acepta instrucciones de acento y tono.
 *   npx tsx scripts/libro/narrar.mts            → narra lo que falta (o cambió) en public/libro/voz/<id>.mp3
 *   npx tsx scripts/libro/narrar.mts sueno      → solo esa página (vuelve a narrarla)
 * Cada mp3 guarda al lado (`<id>.txt`) el texto con el que se hizo: si el texto cambia, se vuelve a narrar.
 * Al final escribe `lib/sitio/libroVoz.json` con lo que dura cada página.
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { EPILOGO, NARRACION_INDICE, PAGINAS } from '../../lib/sitio/libroHistoria.ts';

const clave = readFileSync('.env.local', 'utf8').match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!clave) throw new Error('Falta OPENAI_API_KEY en .env.local');

const INSTRUCCIONES =
  'Eres un narrador de cuentos de España. Habla en español peninsular de España, con acento castellano: ' +
  'pronuncia la «z» y la «c» ante «e» o «i» como en España (distinción), con entonación de Madrid. ' +
  'Tono cálido, pausado y envolvente, como quien cuenta un cuento a la luz de una lámpara; ' +
  'haz pausas naturales entre frases y entre párrafos, y da peso a las palabras importantes sin dramatizar.';

const limpio = (t: string) => t.replace(/\*\*/g, '');
const paginas = [
  { id: 'indice', texto: NARRACION_INDICE },
  ...PAGINAS.map((p) => ({ id: p.id, texto: [p.titulo + '.', ...p.parrafos.map(limpio)].join('\n\n') })),
  { id: EPILOGO.id, texto: [EPILOGO.titulo + '.', ...EPILOGO.parrafos.map(limpio)].join('\n\n') },
];

const solo = process.argv[2];
for (const p of paginas) {
  if (solo && p.id !== solo) continue;
  const mp3 = `public/libro/voz/${p.id}.mp3`;
  const txt = `public/libro/voz/${p.id}.txt`;
  if (!solo && existsSync(mp3) && existsSync(txt) && readFileSync(txt, 'utf8') === p.texto) continue;
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'onyx', input: p.texto, instructions: INSTRUCCIONES, response_format: 'mp3' }),
  });
  if (!r.ok) throw new Error(`${p.id}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  writeFileSync(mp3 + '.tmp.mp3', Buffer.from(await r.arrayBuffer()));
  // Voz hablada: mono a 56 kbps basta y pesa la mitad.
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3 + '.tmp.mp3', '-ac', '1', '-b:a', '56k', mp3]);
  execFileSync('rm', [mp3 + '.tmp.mp3']);
  writeFileSync(txt, p.texto);
  console.log('narrada', p.id);
}

// Lo que dura cada página, para que el texto aparezca al ritmo de la voz (`lib/sitio/libroVoz.json`).
const duraciones: Record<string, number> = {};
for (const p of paginas) {
  const mp3 = `public/libro/voz/${p.id}.mp3`;
  if (!existsSync(mp3)) continue;
  const s = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], { encoding: 'utf8' });
  duraciones[p.id] = Math.round(Number(s) * 100) / 100;
}
writeFileSync('lib/sitio/libroVoz.json', JSON.stringify(duraciones, null, 2) + '\n');
console.log('duraciones:', Object.keys(duraciones).length);
