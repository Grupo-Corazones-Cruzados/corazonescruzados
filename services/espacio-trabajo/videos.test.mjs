import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { carpetaDe, estadoSubida, extensionDe, guardarParte, primerMensaje, terminarSubida } from './videos.mjs';
import { extraerJson, generarJson } from './generar.mjs';

const temporal = () => fs.mkdtempSync(path.join(os.tmpdir(), 'videos-'));
const trozo = (t) => Readable.from([Buffer.from(t)]);

test('solo se aceptan carpetas de video: ni rutas ni lo que ya había en GCC-Edicion', () => {
  assert.equal(carpetaDe('/r', 'video-12-automatizacion'), '/r/video-12-automatizacion');
  for (const mala of ['biblioteca', 'prueba-agente', '../token', 'video-1/../../x', 'video-', '', 'video-1-A', 'video-1-a b']) {
    assert.throws(() => carpetaDe('/r', mala), /inválida/, mala);
  }
});

test('un archivo que no es video no entra', () => {
  assert.equal(extensionDe('Mi Video.MOV'), '.mov');
  assert.throws(() => extensionDe('virus.sh'), /no es un video/);
});

test('la subida se arma por partes y solo termina con el tamaño completo', async () => {
  const dir = temporal();
  assert.deepEqual(await guardarParte(trozo('hola '), dir, 'a.mov', 0), { recibido: 5 });
  assert.deepEqual(await guardarParte(trozo('mundo'), dir, 'a.mov', 5), { recibido: 10 });
  assert.deepEqual(estadoSubida(dir, 'a.mov'), { recibido: 10, completa: false });
  assert.throws(() => terminarSubida(dir, 'a.mov', 11), /incompleta/);
  const final = terminarSubida(dir, 'a.mov', 10);
  assert.equal(fs.readFileSync(final, 'utf8'), 'hola mundo');
  assert.equal(path.basename(final), 'fuente.mov');
  assert.deepEqual(estadoSubida(dir, 'a.mov'), { recibido: 10, completa: true });
  assert.equal(terminarSubida(dir, 'a.mov', 10), final, 'repetirlo no falla');
});

test('una parte fuera de orden no se escribe y dice desde dónde seguir', async () => {
  const dir = temporal();
  await guardarParte(trozo('abc'), dir, 'a.mp4', 0);
  await assert.rejects(guardarParte(trozo('zzz'), dir, 'a.mp4', 0), (e) => e.codigo === 'desfase' && e.recibido === 3);
  await assert.rejects(guardarParte(trozo('zzz'), dir, 'a.mp4', 9), (e) => e.recibido === 3);
  assert.equal(estadoSubida(dir, 'a.mp4').recibido, 3);
});

test('la primera orden lanza el agente con su carpeta y permite corregir el recorte', () => {
  const m = primerMensaje({ ruta: '/r/fuente.mov', carpeta: 'video-3-x', tema: 'Procesos' });
  assert.ok(m.startsWith('/editar-video /r/fuente.mov\n'));
  assert.match(m, /--idea video-3-x/);
  assert.match(m, /Procesos/);
  assert.match(m, /`cortes`/);
});

test('el JSON se recupera aunque venga envuelto', () => {
  assert.deepEqual(extraerJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extraerJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extraerJson('Aquí tienes:\n{"a":{"b":2}}\nListo.'), { a: { b: 2 } });
  assert.throws(() => extraerJson('no hay nada'), /no devolvió JSON/);
});

const motor = (respuestas, init = { type: 'system', subtype: 'init', apiKeySource: 'none' }) => {
  const usadas = [];
  const query = (a) => {
    usadas.push(a);
    const texto = respuestas.shift();
    const it = (async function* () { yield init; yield { type: 'result', subtype: 'success', result: texto }; })();
    it.close = () => {};
    return it;
  };
  return { query, usadas };
};

test('genera sin herramientas ni sesión guardada', async () => {
  const { query, usadas } = motor(['{"ok":true}']);
  assert.deepEqual(await generarJson({ query, system: 'S', user: 'U', opciones: {} }), { ok: true });
  assert.deepEqual(usadas[0].options.tools, []);
  assert.equal(usadas[0].options.persistSession, false);
  assert.equal(usadas[0].prompt, 'U');
});

test('un JSON roto se repite una sola vez', async () => {
  const { query, usadas } = motor(['roto', '{"ok":2}']);
  assert.deepEqual(await generarJson({ query, system: 'S', user: 'U', opciones: {} }), { ok: 2 });
  assert.equal(usadas.length, 2);
  await assert.rejects(generarJson({ query: motor(['x', 'y']).query, system: 'S', user: 'U', opciones: {} }), /no devolvió JSON/);
});

test('si se fuera a cobrar por API, se detiene', async () => {
  const { query } = motor(['{"ok":true}'], { type: 'system', subtype: 'init', apiKeySource: 'ANTHROPIC_API_KEY' });
  await assert.rejects(generarJson({ query, system: 'S', user: 'U', opciones: {} }), /cobraría por API/);
});
