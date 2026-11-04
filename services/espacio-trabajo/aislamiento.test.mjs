import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { hermanas, ajustesDeSesion, entornoLimpio, RAICES_CLIENTES } from './aislamiento.mjs';

const R = RAICES_CLIENTES[0];
const arbol = { [R]: ['Diego', 'Motordesa', 'nota.txt'], [path.join(R, 'Motordesa')]: ['Marketplace', 'Ventas'], [path.join(R, 'Diego')]: ['Portal'] };
const leer = (d) => arbol[d] ?? [];

test('deniega las hermanas y nunca una carpeta padre', () => {
  const cwd = path.join(R, 'Motordesa/Marketplace');
  const a = ajustesDeSesion({ cwd, leer });
  const d = a.sandbox.filesystem.denyRead;
  assert.ok(d.includes(path.join(R, 'Diego')));
  assert.ok(d.includes(path.join(R, 'nota.txt')));
  assert.ok(d.includes(path.join(R, 'Motordesa/Ventas')));
  assert.ok(!d.includes(R));
  assert.ok(!d.includes(path.join(R, 'Motordesa')));
  assert.ok(!d.includes(cwd));
});

test('un proyecto anidado queda fuera aunque cuelgue del actual', () => {
  const cwd = path.join(R, 'Motordesa');
  const hijo = path.join(R, 'Motordesa/Marketplace');
  const a = ajustesDeSesion({ cwd, leer, proyectos: [{ ruta: cwd }, { ruta: hijo }] });
  assert.ok(a.sandbox.filesystem.denyRead.includes(hijo));
  assert.deepEqual(a.permissions.deny, [`Read(/${hijo}/**)`, `Edit(/${hijo}/**)`]);
});

test('la sesión de una subcarpeta no se deniega su propio proyecto', () => {
  const raiz = path.join(R, 'Diego');
  const cwd = path.join(raiz, 'Portal');
  const a = ajustesDeSesion({ cwd, raizProyecto: raiz, leer, proyectos: [{ ruta: raiz }] });
  assert.ok(!a.sandbox.filesystem.denyRead.includes(raiz));
  assert.ok(!a.sandbox.filesystem.denyRead.includes(cwd));
  assert.ok(a.sandbox.filesystem.denyRead.includes(path.join(R, 'Motordesa')));
});

test('sin sandbox quedan los bloqueos de archivo', () => {
  const a = ajustesDeSesion({ cwd: path.join(R, 'Diego'), leer, sandbox: false });
  assert.equal(a.sandbox, undefined);
  assert.equal(a.permissions.blockWritesOutsideWorkingDirectories, true);
});

test('los proyectos de otras raíces quedan denegados enteros', () => {
  const a = ajustesDeSesion({ cwd: path.join(R, 'Diego'), leer });
  assert.ok(a.sandbox.filesystem.denyRead.includes(path.join(os.homedir(), 'corazonescruzados')));
});

test('el entorno no lleva la clave de API', () => {
  const e = entornoLimpio({ ANTHROPIC_API_KEY: 'x', ANTHROPIC_AUTH_TOKEN: 'y', PATH: '/bin' });
  assert.deepEqual(e, { PATH: '/bin' });
});
