import test from 'node:test';
import assert from 'node:assert/strict';
import { sesionesActivas, VENTANA_ACTIVA_MS as V } from './activas.mjs';

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
