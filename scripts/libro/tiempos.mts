/**
 * Los TIEMPOS DE CADA FRASE de la narración (2026-11-12): transcribe cada mp3 de `public/libro/voz/` con
 * marcas por palabra (OpenAI `whisper-1`, el proveedor del proyecto) y reparte las frases del texto original
 * sobre esas palabras. Sale `lib/sitio/libroFrases.json`: por escena, cada frase con su inicio y su fin en
 * segundos. Lo usan los guiones de video (un plano por frase, con su duración exacta) y los subtítulos.
 *   npx tsx scripts/libro/tiempos.mts
 */
import { readFileSync, writeFileSync } from 'fs';
import { EPILOGO, PAGINAS } from '../../lib/sitio/libroHistoria.ts';

const clave = readFileSync('.env.local', 'utf8').match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!clave) throw new Error('Falta OPENAI_API_KEY');
const limpio = (t: string) => t.replace(/\*\*/g, '');
const escenas = [
  ...PAGINAS.map((p) => ({ id: p.id, texto: [p.titulo + '.', ...p.parrafos.map(limpio)].join(' ') })),
  { id: EPILOGO.id, texto: [EPILOGO.titulo + '.', ...EPILOGO.parrafos].join(' ') },
];
const salida: Record<string, { frase: string; inicio: number; fin: number }[]> = {};
for (const e of escenas) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(`public/libro/voz/${e.id}.mp3`)], { type: 'audio/mpeg' }), `${e.id}.mp3`);
  form.append('model', 'whisper-1');
  form.append('language', 'es');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${clave}` }, body: form });
  if (!r.ok) throw new Error(`${e.id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const palabras: { start: number; end: number }[] = j.words;
  const frases = e.texto.split(/(?<=[.!?…:;])\s+/).filter((f) => f.trim());
  const cuenta = (f: string) => f.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const total = frases.reduce((a, f) => a + cuenta(f), 0);
  // Las palabras del texto y las transcritas casi coinciden; se reparte en proporción por si difieren.
  const factor = palabras.length / total;
  let acum = 0;
  salida[e.id] = frases.map((f, k) => {
    const a = Math.min(palabras.length - 1, Math.round(acum * factor));
    acum += cuenta(f);
    const b = Math.min(palabras.length - 1, Math.max(a, Math.round(acum * factor) - 1));
    const fin = k === frases.length - 1 ? j.duration : palabras[b].end;
    return { frase: f, inicio: Math.round(palabras[a].start * 100) / 100, fin: Math.round(fin * 100) / 100 };
  });
  console.log(e.id, frases.length, 'frases', palabras.length, 'palabras /', total);
}
writeFileSync('lib/sitio/libroFrases.json', JSON.stringify(salida, null, 1) + '\n');
