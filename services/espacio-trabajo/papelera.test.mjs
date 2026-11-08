import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { moverAPapelera, vaciarPapelera, DIAS_PAPELERA } from './papelera.mjs';

const DIA = 86_400_000;
function escenario() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'papelera-'));
  const proyecto = path.join(base, 'projects', '-Users-yo-app');
  fs.mkdirSync(path.join(proyecto, 'abc', 'subagents'), { recursive: true });
  fs.writeFileSync(path.join(proyecto, 'abc.jsonl'), '{"type":"user"}\n');
  fs.writeFileSync(path.join(proyecto, 'abc', 'subagents', 'agent-1.jsonl'), '{}\n');
  fs.writeFileSync(path.join(proyecto, 'otra.jsonl'), '{}\n');
  return { base, proyecto, raiz: path.join(base, 'papelera') };
}

test('mueve el archivo y la carpeta de subagentes, y deja las demás sesiones', () => {
  const { proyecto, raiz } = escenario();
  const destino = moverAPapelera(raiz, path.join(proyecto, 'abc.jsonl'), 'abc', 1000);
  assert.ok(!fs.existsSync(path.join(proyecto, 'abc.jsonl')));
  assert.ok(!fs.existsSync(path.join(proyecto, 'abc')));
  assert.ok(fs.existsSync(path.join(proyecto, 'otra.jsonl')));
  assert.ok(fs.existsSync(path.join(destino, 'abc.jsonl')));
  assert.ok(fs.existsSync(path.join(destino, 'abc', 'subagents', 'agent-1.jsonl')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(destino, 'origen.json'), 'utf8')).archivo, path.join(proyecto, 'abc.jsonl'));
});

test('una sesión sin subagentes también se mueve', () => {
  const { proyecto, raiz } = escenario();
  const destino = moverAPapelera(raiz, path.join(proyecto, 'otra.jsonl'), 'otra', 1000);
  assert.ok(fs.existsSync(path.join(destino, 'otra.jsonl')));
});

test('se vacía solo lo que cumplió los 30 días', () => {
  const { proyecto, raiz } = escenario();
  const ahora = 100 * DIA;
  moverAPapelera(raiz, path.join(proyecto, 'abc.jsonl'), 'abc', ahora - DIAS_PAPELERA * DIA);
  moverAPapelera(raiz, path.join(proyecto, 'otra.jsonl'), 'otra', ahora - DIAS_PAPELERA * DIA + 1);
  assert.equal(vaciarPapelera(raiz, ahora), 1);
  assert.deepEqual(fs.readdirSync(raiz).map((e) => e.split('-').slice(1).join('-')), ['otra']);
});

test('sin papelera no falla', () => {
  assert.equal(vaciarPapelera(path.join(os.tmpdir(), 'no-existe-papelera')), 0);
});
