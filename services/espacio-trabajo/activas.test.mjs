import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sesionesActivas, ultimaInteraccion, VENTANA_ACTIVA_MS as V } from './activas.mjs';

const AHORA = 1_000_000_000_000;
const fila = (id, edad, extra = {}) => ({ id, proyecto: 'p', titulo: id, actualizada: AHORA - edad, carpeta: null, viva: null, ...extra });
const ids = (l) => l.map((s) => s.id);

test('entra con menos de 2 días y sale al cumplirlos', () => {
  const r = sesionesActivas([fila('vieja', V), fila('justa', V - 1), fila('nueva', 1000)], [], AHORA);
  assert.deepEqual(ids(r), ['nueva', 'justa']);
});

test('en marcha entra aunque sea vieja; abierta sin trabajo no', () => {
  const trabajando = { id: 'a', proyecto: 'p', estado: 'trabajando' };
  const libre = { id: 'b', proyecto: 'p', estado: 'libre' };
  const cerrada = { id: 'c', proyecto: 'p', estado: 'cerrada', noVisto: true };
  const r = sesionesActivas([fila('a', V * 3, { viva: trabajando }), fila('b', V * 3, { viva: libre }), fila('c', V * 3, { viva: cerrada })], [trabajando, libre, cerrada], AHORA);
  assert.deepEqual(ids(r), ['a']);
});

test('una sesión recién nacida, sin archivo todavía, ya aparece', () => {
  const r = sesionesActivas([], [{ id: 'n', proyecto: 'p', estado: 'iniciando' }, { id: 'l', proyecto: 'p', estado: 'libre' }], AHORA);
  assert.deepEqual(ids(r), ['n']);
  assert.equal(r[0].proyecto, 'p');
});

test('no se repite si dos proyectos ven la misma carpeta, y manda el de la raíz', () => {
  const r = sesionesActivas([fila('x', 1000, { proyecto: 'padre', carpeta: 'hijo' }), fila('x', 1000, { proyecto: 'hijo' })], [], AHORA);
  assert.equal(r.length, 1);
  assert.equal(r[0].proyecto, 'hijo');
});

test('de la más reciente a la más antigua', () => {
  assert.deepEqual(ids(sesionesActivas([fila('b', 5000), fila('a', 10), fila('c', 90000)], [], AHORA)), ['a', 'b', 'c']);
});

test('la interacción es el último mensaje, no lo último que se escribió en el archivo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'activas-'));
  const a = path.join(dir, 's.jsonl');
  const l = (o) => `${JSON.stringify(o)}\n`;
  fs.writeFileSync(a, l({ type: 'user', timestamp: '2026-01-01T00:00:00.000Z' }) + l({ type: 'assistant', timestamp: '2026-01-02T00:00:00.000Z' })
    + l({ type: 'user', isMeta: true, timestamp: '2026-02-01T00:00:00.000Z' }) + l({ type: 'system', subtype: 'away_summary', timestamp: '2026-03-01T00:00:00.000Z' }) + l({ type: 'ai-title', aiTitle: 'x' }));
  assert.equal(ultimaInteraccion(a), Date.parse('2026-01-02T00:00:00.000Z'));
  fs.appendFileSync(a, l({ type: 'mode', timestamp: '2026-04-01T00:00:00.000Z' }));
  assert.equal(ultimaInteraccion(a), Date.parse('2026-01-02T00:00:00.000Z'));
  fs.appendFileSync(a, 'x'.repeat(300 * 1024) + '\n');
  assert.equal(ultimaInteraccion(a), Date.parse('2026-01-02T00:00:00.000Z'), 'mira más atrás si el final no tiene mensajes');
  fs.appendFileSync(a, l({ type: 'user', timestamp: '2026-05-01T00:00:00.000Z' }));
  assert.equal(ultimaInteraccion(a), Date.parse('2026-05-01T00:00:00.000Z'));
  fs.writeFileSync(a, l({ type: 'ai-title' }));
  assert.equal(ultimaInteraccion(a), null);
  assert.equal(ultimaInteraccion(path.join(dir, 'no-existe.jsonl')), null);
  fs.rmSync(dir, { recursive: true });
});

test('una sesión cerrada sale del panel y vuelve con el siguiente mensaje', () => {
  const cerradas = { a: AHORA - 500 };
  assert.deepEqual(ids(sesionesActivas([fila('a', 1000), fila('b', 1000)], [], AHORA, cerradas)), ['b']);
  assert.deepEqual(ids(sesionesActivas([fila('a', 100), fila('b', 1000)], [], AHORA, cerradas)), ['a', 'b'], 'hubo un mensaje después de cerrarla');
  assert.deepEqual(ids(sesionesActivas([fila('a', 1000, { viva: { id: 'a', estado: 'trabajando' } })], [], AHORA, cerradas)), ['a'], 'si trabaja, se ve');
});
