import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buscarClave, ordenaTerminar } from './palabra-clave.mjs';
import { esAlucinacion, esEco, parecePregunta } from './filtro.mjs';
import { limpiarFilas, validarConsulta } from './bd.mjs';
import { revisarHerramienta } from './agente.mjs';
import { Segmentador } from './segmentador.mjs';
import { Sesion, leerPendiente } from './sesion.mjs';
import { Motor } from './motor.mjs';

test('la clave se reconoce aunque Whisper la escriba mal', () => {
  for (const t of ['GUMDRAMON, cuánto cobramos', 'Gundramón cuánto cobramos', 'gum dramon cuánto cobramos', 'Gamdramón, cuánto cobramos', 'Gum Dramón. Cuánto cobramos', 'Gundra mon cuánto cobramos']) {
    assert.equal(buscarClave(t)?.resto.toLowerCase(), 'cuánto cobramos', t);
  }
});

test('las palabras comunes no despiertan al copiloto', () => {
  for (const t of ['gran dragón', 'el german tomó la decisión', 'ganamos', 'Ramón dijo que sí', 'gramo', 'gordo ramón', 'vamos a dar un programa', 'con grandes montos']) {
    assert.equal(buscarClave(t), null, t);
  }
});

test('la orden de terminar', () => {
  for (const t of ['la sesión ha terminado', 'la sesión ha terminado.', 'termina la reunión', 'fin de la sesión', 'cierra la sesión']) assert.ok(ordenaTerminar(t), t);
  for (const t of ['¿cuándo terminó la sesión de ayer con el cliente de Motordesa en la mañana del lunes pasado?', 'cuánto cuesta', 'qué proyectos terminamos']) assert.ok(!ordenaTerminar(t), t);
});

test('el filtro deja pasar preguntas y no el relleno', () => {
  for (const t of ['¿Cuánto cuesta?', 'queríamos saber cuánto costaría', 'podrían integrarlo con SAP', 'Cuál es el plazo', 'me gustaría saber el plazo']) assert.ok(parecePregunta(t), t);
  for (const t of ['Muy bien, perfecto.', 'De acuerdo, entonces seguimos', 'Ya veo, sí sí']) assert.ok(!parecePregunta(t), t);
  for (const t of ['Gracias por ver el video.', '[Música]', 'Suscríbete al canal', '...', 'Gracias.', 'Grupo Corazones Cruzados. Grupo Corazones.', 'GCC World.']) assert.ok(esAlucinacion(t), t);
  assert.ok(!esAlucinacion('Gracias, ya nos quedó claro lo del sistema de reservas'));
  assert.ok(!esAlucinacion('GUMDRAMON.'));
  assert.ok(!esAlucinacion('Grupo Corazones Cruzados hizo el sistema'));
});

test('el eco de los altavoces no cuenta como Fernando', () => {
  assert.ok(esEco('cuánto costaría el sistema', 'nosotros queremos saber cuánto costaría el sistema de reservas'));
  assert.ok(!esEco('te cuento que depende del alcance', 'cuánto costaría el sistema'));
});

test('la base: solo un SELECT y nada de credenciales', () => {
  assert.ok(validarConsulta('SELECT id, name FROM gcc_world.products;'));
  assert.ok(validarConsulta('WITH a AS (SELECT 1) SELECT * FROM a'));
  for (const q of ['DELETE FROM x', 'UPDATE x SET a=1', 'SELECT 1; DROP TABLE x', 'SELECT password_hash FROM users', 'select pg_read_file(\'/etc/passwd\')', 'COPY x TO STDOUT', 'select refresh_token from t', '']) {
    assert.throws(() => validarConsulta(q), undefined, q);
  }
  assert.deepEqual(limpiarFilas([{ id: 1, password_hash: 'x', api_key: 'y', nombre: 'z' }]), [{ id: 1, nombre: 'z' }]);
});

test('el agente solo lee, y no lee las llaves', () => {
  for (const n of ['Bash', 'Write', 'Edit', 'WebFetch', 'Task']) assert.ok(revisarHerramienta(n, {}), n);
  assert.equal(revisarHerramienta('Read', { file_path: '/a/MEMORIA.md' }), null);
  assert.equal(revisarHerramienta('mcp__negocio__consultar_bd', { sql: 'select 1' }), null);
  for (const r of ['/a/.env', '/a/.env.local', '/a/peter-tours/x.md', '/a/x.jks', '/u/.ssh/id', '/a/certificates/f.p12']) assert.ok(revisarHerramienta('Read', { file_path: r }), r);
  assert.ok(revisarHerramienta('Grep', { path: '/a/.env.local', pattern: 'x' }));
  assert.ok(revisarHerramienta('Glob', { pattern: '**/.env*' }));
});

const pcm = (seg, amp) => {
  const b = Buffer.alloc(Math.round(seg * 16000) * 2);
  for (let i = 0; i < b.length / 2; i++) b.writeInt16LE(Math.round(Math.sin(i / 10) * amp * 32767), i * 2);
  return b;
};

test('el segmentador corta en la pausa y a los 5 s, sin mandar silencios', () => {
  const tramos = [];
  const s = new Segmentador({ alCerrar: (a) => tramos.push(a.length / 32000) });
  s.agregar(pcm(3, 0)); assert.equal(tramos.length, 0);
  s.agregar(pcm(2, 0.2)); s.agregar(pcm(1, 0));
  assert.equal(tramos.length, 1);
  assert.ok(tramos[0] > 2 && tramos[0] < 3.5, String(tramos[0]));
  tramos.length = 0;
  s.agregar(pcm(11, 0.2)); s.agregar(pcm(1, 0));
  assert.ok(tramos.length >= 2 && tramos.every((d) => d <= 5.1), String(tramos));
  assert.ok(Math.abs(tramos.reduce((a, b) => a + b, 0) - 12) < 1, 'sin perder audio ni repetirlo');
});

function reunion({ respuestas = [], r_espera = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copiloto-'));
  const eventos = [];
  const preguntas = [];
  let reloj = 1_000_000;
  const sesion = new Sesion(dir);
  const motor = new Motor({
    sesion,
    transcriptor: { iniciar: async () => {}, detener() {}, transcribir: async () => '' },
    agente: { iniciar() {}, detener() {}, preguntar: async (m, a) => { preguntas.push(m); const r = respuestas.shift() ?? 'NADA'; a.alTexto?.(r); return r; } },
    emitir: (e, d) => eventos.push([e, d]),
    terminar: async () => { eventos.push(['terminar', {}]); },
    ahora: () => reloj,
    esperar: async (ms) => { if (r_espera) await r_espera(ms); },
  });
  motor.activar();
  return { motor, eventos, preguntas, sesion, avanzar: (ms) => { reloj += ms; } };
}
const espera = () => new Promise((r) => setTimeout(r, 5));
const nombres = (ev) => ev.map(([e]) => e);

test('una pregunta del cliente se responde', async () => {
  const r = reunion({ respuestas: ['El sistema de reservas cuesta 5 $/mes.'] });
  await r.motor.texto('sistema', '¿Cuánto cuesta el sistema de reservas?');
  await espera();
  assert.equal(r.preguntas.length, 1);
  assert.match(r.preguntas[0], /MODO automático/);
  assert.ok(nombres(r.eventos).includes('respuesta'));
});

test('sin pregunta, ni Claude se entera', async () => {
  const r = reunion();
  await r.motor.texto('sistema', 'Perfecto, muy bien, seguimos con el tema.');
  await espera();
  assert.equal(r.preguntas.length, 0);
  assert.ok(!nombres(r.eventos).includes('consulta'));
});

test('si Claude dice NADA, el widget no muestra nada', async () => {
  const r = reunion({ respuestas: ['NADA'] });
  await r.motor.texto('sistema', '¿Qué tal, cómo están todos?');
  await espera();
  assert.equal(r.preguntas.length, 1);
  for (const e of ['consulta', 'respuesta', 'parcial']) assert.ok(!nombres(r.eventos).includes(e), e);
});

test('lo que dice Fernando sin la clave no dispara nada, aunque sea pregunta', async () => {
  const r = reunion();
  await r.motor.texto('mic', '¿Cuál es su presupuesto para este proyecto?');
  await espera();
  assert.equal(r.preguntas.length, 0);
  assert.equal(r.sesion.lineas[0].quien, 'Fernando');
});

test('Fernando pregunta con la clave y siempre recibe respuesta', async () => {
  const r = reunion({ respuestas: ['Entregamos en 4 semanas.'] });
  await r.motor.texto('mic', 'Gundramón, cuánto tardamos en un proyecto así');
  await espera();
  assert.match(r.preguntas[0], /MODO pedido/);
  assert.ok(nombres(r.eventos).includes('respuesta'));
});

test('la clave sola espera la pregunta en el tramo siguiente', async () => {
  const r = reunion({ respuestas: ['Listo.'] });
  await r.motor.texto('mic', 'GUMDRAMON.');
  assert.equal(r.preguntas.length, 0);
  r.avanzar(3000);
  await r.motor.texto('mic', 'cuál fue el último proyecto de Motordesa');
  await espera();
  assert.equal(r.preguntas.length, 1);
});

test('la clave no vale pasada la espera', async () => {
  const r = reunion();
  await r.motor.texto('mic', 'GUMDRAMON.');
  r.avanzar(20000);
  await r.motor.texto('mic', 'cuál es su presupuesto');
  await espera();
  assert.equal(r.preguntas.length, 0);
});

test('terminar por voz, solo desde el micrófono', async () => {
  const r = reunion({ respuestas: [] });
  await r.motor.texto('sistema', 'GUMDRAMON la sesión ha terminado.');
  await espera();
  assert.ok(!nombres(r.eventos).includes('terminar'), 'el cliente no puede terminar la sesión');
  // Lo mismo por los altavoces, un instante después, tampoco: es eco y no lo dijo Fernando.
  await r.motor.texto('mic', 'GUMDRAMON la sesión ha terminado.');
  assert.ok(!nombres(r.eventos).includes('terminar'), 'el eco del cliente no puede terminar la sesión');
  r.avanzar(20000);
  await r.motor.texto('mic', 'GUMDRAMON, la sesión ha terminado.');
  assert.ok(nombres(r.eventos).includes('terminar'));
});

test('lo que oye por los altavoces no se atribuye a Fernando', async () => {
  const r = reunion({ respuestas: ['x'] });
  await r.motor.texto('sistema', '¿Cuánto costaría el sistema de reservas?');
  await r.motor.texto('mic', 'cuánto costaría el sistema de reservas');
  assert.deepEqual(r.sesion.lineas.map((l) => l.quien), ['Cliente']);
});

test('el eco llega antes que el equipo y aun así no se atribuye a Fernando', async () => {
  let llegaEquipo;
  const r = reunion({ respuestas: ['x'], r_espera: () => { llegaEquipo(); return Promise.resolve(); } });
  r.motor.audio('sistema', pcm(0.3, 0.2));
  llegaEquipo = () => r.motor.texto('sistema', 'Buenos días, cuánto costaría el sistema de reservas');
  await r.motor.texto('mic', 'Buenos días, cuánto costaría el sistema de reservas');
  assert.deepEqual(r.sesion.lineas.map((l) => l.quien), ['Cliente']);
});

test('con el equipo en silencio el micrófono no espera', async () => {
  let esperas = 0;
  const r = reunion({ r_espera: () => { esperas++; return Promise.resolve(); } });
  r.avanzar(60000);
  await r.motor.texto('mic', 'Hola, buenos días a todos');
  assert.equal(esperas, 0);
});

test('a media frase no se pregunta; al cerrarla, sí', async () => {
  const r = reunion({ respuestas: ['Cuesta 5 $.'] });
  await r.motor.texto('sistema', 'queríamos saber cuánto costaría el', { seguir: true });
  await espera();
  assert.equal(r.preguntas.length, 0);
  await r.motor.texto('sistema', 'sistema de reservas');
  await espera();
  assert.equal(r.preguntas.length, 1);
  assert.match(r.preguntas[0], /costaría el sistema de reservas/);
});

test('el corte forzado cae en el hueco y no pierde audio', () => {
  const tramos = [];
  const s = new Segmentador({ maximoS: 5, alCerrar: (a, seguir) => tramos.push({ d: a.length / 32000, seguir }) });
  s.agregar(pcm(4.6, 0.2)); s.agregar(pcm(0.15, 0.001)); s.agregar(pcm(0.4, 0.2)); s.agregar(pcm(1, 0));
  assert.ok(tramos[0].seguir);
  assert.ok(tramos[0].d > 4.5 && tramos[0].d < 4.85, String(tramos[0].d));
});

test('la transcripción se guarda y sobrevive a un reinicio', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copiloto-'));
  const a = new Sesion(dir);
  a.agregar('Cliente', 'hola');
  const id = a.id;
  const b = new Sesion(dir);
  assert.equal(b.id, id);
  assert.equal(b.lineas.length, 1);
  b.agregar('Fernando', 'buenas');
  const p = leerPendiente(b.cerrar());
  assert.equal(p.id, id);
  assert.match(p.transcripcion, /Cliente: hola\n\[.*\] Fernando: buenas/);
  assert.equal(b.pendientes().length, 1);
});

test('una sesión sin nada dicho no deja recordatorio', () => {
  const s = new Sesion(fs.mkdtempSync(path.join(os.tmpdir(), 'copiloto-')));
  s.abrir();
  assert.equal(s.cerrar(), null);
});
