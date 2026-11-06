import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buscarClave, ordenaTerminar } from './palabra-clave.mjs';
import { esAlucinacion, esEco, parecePregunta } from './filtro.mjs';
import { limpiarFilas, validarConsulta } from './bd.mjs';
import { SesionClaude, describirHerramienta } from './sesion-claude.mjs';
import { Segmentador, energia } from './segmentador.mjs';
import { Sesion, leerPendiente } from './sesion.mjs';
import { buscar, rutaSegura } from './buscar.mjs';
import { ColaRecordatorios, comandoRecordatorio, formatearPasos, validar } from './recordatorio.mjs';
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

test('el turno de la sesión devuelve el último texto, no la narración previa', async () => {
  const c = new SesionClaude();
  const buscando = [];
  const r = new Promise((ok, mal) => { c.turno = { ok, mal, texto: '', ultimo: '', alBuscar: (d) => buscando.push(d) }; });
  c.evento({ seq: 1, tipo: 'delta', texto: 'Voy a buscar en los proyectos' });
  c.evento({ seq: 2, tipo: 'mensaje', rol: 'assistant', bloques: [{ tipo: 'texto', texto: 'Voy a buscar en los proyectos' }, { tipo: 'herramienta', nombre: 'Bash', entrada: { command: 'node ~/.gcc-copiloto/app/nucleo/buscar.mjs contenido "flota"' } }] });
  c.evento({ seq: 3, tipo: 'mensaje', rol: 'assistant', padre: 'x', bloques: [{ tipo: 'texto', texto: 'lo de un subagente' }] });
  c.evento({ seq: 4, tipo: 'mensaje', rol: 'assistant', bloques: [{ tipo: 'texto', texto: 'Hicimos dos proyectos de flota.' }] });
  c.evento({ seq: 5, tipo: 'fin', ok: true });
  assert.equal(await r, 'Hicimos dos proyectos de flota.');
  assert.deepEqual(buscando, ['Buscando en los proyectos: flota']);
  assert.equal(c.visto, 5);
});

test('un turno fallido llega como error', async () => {
  const c = new SesionClaude();
  const r = new Promise((ok, mal) => { c.turno = { ok, mal, texto: '', ultimo: '' }; });
  c.evento({ tipo: 'fin', ok: false, error: 'You hit your limit' });
  await assert.rejects(r, /limit/);
});

test('el widget dice qué se está mirando', () => {
  assert.equal(describirHerramienta('Read', { file_path: '/a/b/MEMORIA.md' }), 'Leyendo MEMORIA.md');
  assert.equal(describirHerramienta('Bash', { command: 'node x/consultar-bd.mjs "SELECT 1"' }), 'Consultando la base del negocio');
});

test('un cliente con mucho no tapa a los demás, y los documentos van primero', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'raiz-'));
  process.env.COPILOTO_RAICES = raiz;
  fs.mkdirSync(path.join(raiz, 'Aaa/x'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'Zzz/y'), { recursive: true });
  // Más de 16 MB de coincidencias: así se cortaba antes, sin llegar a Zzz.
  fs.writeFileSync(path.join(raiz, 'Aaa/x/datos.sql'), `camion ${'x'.repeat(2000)}\n`.repeat(9000));
  fs.writeFileSync(path.join(raiz, 'Zzz/y/MEMORIA.md'), 'Sistema de camiones\n');
  fs.writeFileSync(path.join(raiz, 'Zzz/y/app.ts'), Array(40).fill('camion').join('\n'));
  const l = await buscar('contenido', 'camion');
  assert.ok(l.some((x) => x.includes('Zzz/y/MEMORIA.md')), 'llega al último cliente');
  const zzz = l.filter((x) => x.includes('/Zzz/'));
  assert.match(zzz[0], /MEMORIA\.md/);
  assert.ok(l.filter((x) => x.includes('/Aaa/')).length <= 3, 'un archivo no acapara');
  assert.ok(l.every((x) => x.length <= 300));
  delete process.env.COPILOTO_RAICES;
});

test('la búsqueda recorre los proyectos y nunca toca llaves', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'raiz-'));
  process.env.COPILOTO_RAICES = raiz;
  fs.mkdirSync(path.join(raiz, 'ClienteA/app'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'ClienteB/node_modules/x'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'Peter Tours/peter-tours'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'ClienteA/app/flota.md'), 'Sistema de camiones y flota\npassword=flota123\n');
  fs.writeFileSync(path.join(raiz, 'ClienteA/.env'), 'DATABASE_URL=postgres://u:flota@h/x\n');
  fs.writeFileSync(path.join(raiz, 'ClienteA/.env.local'), 'flota=secreta\n');
  fs.writeFileSync(path.join(raiz, 'ClienteB/node_modules/x/a.md'), 'flota\n');
  fs.writeFileSync(path.join(raiz, 'Peter Tours/peter-tours/a.md'), 'flota\n');
  const lineas = await buscar('contenido', 'flota');
  assert.equal(lineas.length, 1, lineas.join(' | '));
  assert.match(lineas[0], /flota\.md:1:Sistema de camiones/);
  assert.deepEqual((await buscar('archivos', 'flota')).map((f) => path.basename(f)), ['flota.md']);
  assert.deepEqual(await buscar('archivos', '.env'), []);
  assert.ok(!(await buscar('carpeta', path.join(raiz, 'ClienteA'))).some((x) => x.includes('.env')));
  assert.throws(() => rutaSegura(path.join(raiz, 'ClienteA/.env')));
  assert.throws(() => rutaSegura('/etc'));
  assert.throws(() => rutaSegura(path.join(raiz, '../..')));
  assert.equal(await buscar('contenido', '--version', '../..').catch(() => 'rechazada'), 'rechazada');
  delete process.env.COPILOTO_RAICES;
});

/** Parecido al habla: sílabas con huecos. Un tono constante es ruido de fondo, no voz, y el detector lo sabe. */
const pcm = (seg, amp) => {
  const b = Buffer.alloc(Math.round(seg * 16000) * 2);
  for (let i = 0; i < b.length / 2; i++) {
    const silaba = Math.max(0, Math.sin((2 * Math.PI * 3 * i) / 16000));
    b.writeInt16LE(Math.round(Math.sin(i / 10) * silaba * amp * 32767), i * 2);
  }
  return b;
};

test('una voz baja se transcribe y el contador y la transcripción deciden igual', () => {
  const tramos = [];
  let voces = 0;
  const s = new Segmentador({ alCerrar: (a) => tramos.push(a.length / 32000), alVoz: () => { voces++; } });
  s.agregar(pcm(2, 0.0004)); // ruido de la sala
  for (let i = 0; i < 4; i++) { s.agregar(pcm(1.5, 0.008)); s.agregar(pcm(0.3, 0.0004)); } // voz muy baja con pausas cortas
  s.agregar(pcm(1, 0.0004));
  assert.ok(voces > 50, String(voces));
  const total = tramos.reduce((a, b) => a + b, 0);
  assert.ok(total >= 6, `se perdió voz: ${total} s`);
});

test('la voz de una persona que habla seguido no sube el umbral hasta perderla', () => {
  const tramos = [];
  const s = new Segmentador({ alCerrar: (a) => tramos.push(a.length / 32000) });
  s.agregar(pcm(1, 0.0004));
  for (let i = 0; i < 12; i++) { s.agregar(pcm(2.5, 0.01)); s.agregar(pcm(0.2, 0.0004)); }
  s.agregar(pcm(1, 0.0004));
  const total = tramos.reduce((a, b) => a + b, 0);
  assert.ok(total > 30, `solo ${total} s de 32`);
});

test('el segmentador corta en la pausa y a los 10 s, sin mandar silencios', () => {
  const tramos = [];
  const s = new Segmentador({ alCerrar: (a) => tramos.push(a.length / 32000) });
  s.agregar(pcm(3, 0)); assert.equal(tramos.length, 0);
  s.agregar(pcm(2, 0.2)); s.agregar(pcm(1, 0));
  assert.equal(tramos.length, 1);
  assert.ok(tramos[0] > 2 && tramos[0] < 3.5, String(tramos[0]));
  tramos.length = 0;
  s.agregar(pcm(21, 0.2)); s.agregar(pcm(1, 0));
  assert.ok(tramos.length >= 2 && tramos.every((d) => d <= 10.1), String(tramos));
  assert.ok(Math.abs(tramos.reduce((a, b) => a + b, 0) - 22) < 1, 'sin perder audio ni repetirlo');
});

function reunion({ respuestas = [], r_espera = null, nada = false } = {}) {
  const clasificadas = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copiloto-'));
  const eventos = [];
  const preguntas = [];
  let reloj = 1_000_000;
  const sesion = new Sesion(dir);
  const motor = new Motor({
    sesion,
    transcriptor: { iniciar: async () => {}, detener() {}, transcribir: async () => '' },
    agente: { iniciar() {}, detener() {}, preguntar: async (m, a) => { preguntas.push(m); const r = respuestas.shift() ?? 'x'; a.alTexto?.(r); return r; } },
    clasificar: async (t) => { clasificadas.push(t); return nada ? null : t.split('Lo nuevo:\n')[1]; },
    emitir: (e, d) => eventos.push([e, d]),
    terminar: async () => { eventos.push(['terminar', {}]); },
    ahora: () => reloj,
    esperar: async (ms) => { if (r_espera) await r_espera(ms); },
  });
  motor.activar();
  return { motor, eventos, preguntas, clasificadas, sesion, avanzar: (ms) => { reloj += ms; } };
}
const espera = () => new Promise((r) => setTimeout(r, 5));
const nombres = (ev) => ev.map(([e]) => e);

test('una pregunta del cliente se responde', async () => {
  const r = reunion({ respuestas: ['El sistema de reservas cuesta 5 $/mes.'] });
  await r.motor.texto('sistema', '¿Cuánto cuesta el sistema de reservas?');
  await espera();
  assert.equal(r.preguntas.length, 1);
  assert.match(r.preguntas[0], /MODO automático/);
  assert.equal(r.clasificadas.length, 1);
  assert.ok(nombres(r.eventos).includes('respuesta'));
});

test('sin forma de pregunta no se gasta ni la clasificación', async () => {
  const r = reunion();
  await r.motor.texto('sistema', 'Perfecto, muy bien, seguimos con el tema.');
  await espera();
  assert.equal(r.clasificadas.length, 0);
  assert.equal(r.preguntas.length, 0);
  assert.ok(!nombres(r.eventos).includes('consulta'));
});

test('si el clasificador dice NADA, ni la sesión ni el widget se enteran', async () => {
  const r = reunion({ nada: true });
  await r.motor.texto('sistema', '¿Qué tal, cómo están todos?');
  await espera();
  assert.equal(r.clasificadas.length, 1);
  assert.equal(r.preguntas.length, 0);
  for (const e of ['consulta', 'respuesta', 'parcial']) assert.ok(!nombres(r.eventos).includes(e), e);
});

test('el contador cuenta desde la última voz y no vuelve a 4 cuando llega el texto', async () => {
  const r = reunion({ respuestas: ['Listo.'] });
  r.motor.audio('mic', pcm(0.5, 0.2));
  await r.motor.texto('mic', 'GUMDRAMON, una pregunta');
  r.avanzar(1500);
  await r.motor.texto('mic', 'que sigue un poco más'); // Whisper la devuelve ya callado
  await r.motor.revisarDictado();
  const ultimo = r.eventos.filter(([e, d]) => e === 'escuchando' && d.restante != null).at(-1)[1].restante;
  assert.equal(ultimo, 2.5);
});

test('desactivar corta lo que esté investigando', () => {
  const r = reunion();
  let paradas = 0;
  r.motor.agente.parar = () => { paradas++; };
  r.motor.desactivar();
  assert.equal(paradas, 1);
});

test('la cuenta atrás baja de 4 s y se reinicia al volver a hablar', async () => {
  const r = reunion({ respuestas: ['Listo.'] });
  const restantes = () => r.eventos.filter(([e, d]) => e === 'escuchando' && d.restante != null).map(([, d]) => d.restante);
  await r.motor.texto('mic', 'GUMDRAMON, una pregunta larga');
  r.avanzar(1000); await r.motor.revisarDictado();
  r.avanzar(2000); await r.motor.revisarDictado();
  assert.deepEqual(restantes(), [3, 1]);
  r.motor.audio('mic', pcm(0.3, 0.2)); // vuelve a hablar
  await r.motor.revisarDictado();
  assert.equal(restantes().at(-1), 4);
  assert.equal(r.preguntas.length, 0);
  r.avanzar(3900); await r.motor.revisarDictado();
  assert.equal(r.preguntas.length, 0, 'a los 3,9 s todavía espera');
  r.avanzar(200); await r.motor.revisarDictado(); await espera();
  assert.equal(r.preguntas.length, 1);
});

test('lo que dice Fernando sin la clave no dispara nada, aunque sea pregunta', async () => {
  const r = reunion();
  await r.motor.texto('mic', '¿Cuál es su presupuesto para este proyecto?');
  await espera();
  assert.equal(r.preguntas.length, 0);
  assert.equal(r.sesion.lineas[0].quien, 'Fernando');
});

const cierra = async (r) => { r.avanzar(4500); await r.motor.revisarDictado(); await espera(); };

test('Fernando pregunta con la clave y recibe respuesta cuando se calla', async () => {
  const r = reunion({ respuestas: ['Entregamos en 4 semanas.'] });
  await r.motor.texto('mic', 'Gundramón, cuánto tardamos en un proyecto así');
  await r.motor.revisarDictado();
  assert.equal(r.preguntas.length, 0, 'recién hablando no se envía');
  await cierra(r);
  assert.match(r.preguntas[0], /MODO pedido/);
  assert.ok(nombres(r.eventos).includes('respuesta'));
});

test('una pregunta larga, en varios tramos y con pausas, llega entera', async () => {
  const r = reunion({ respuestas: ['Listo.'] });
  await r.motor.texto('mic', 'GUMDRAMON, necesito saber si en el proyecto de flota');
  for (const t of ['que hicimos el año pasado incluimos reportes', 'y además cuánto tardamos en entregarlo', 'y quién fue el responsable']) {
    r.avanzar(3500); // pausa para pensar, menor que el silencio de cierre
    await r.motor.revisarDictado();
    assert.equal(r.preguntas.length, 0, t);
    await r.motor.texto('mic', t);
  }
  await cierra(r);
  assert.equal(r.preguntas.length, 1);
  assert.match(r.preguntas[0], /si en el proyecto de flota que hicimos el año pasado incluimos reportes y además cuánto tardamos en entregarlo y quién fue el responsable/);
});

test('mientras siga hablando no se envía, aunque aún no haya llegado su texto', async () => {
  const r = reunion({ respuestas: ['Listo.'] });
  await r.motor.texto('mic', 'GUMDRAMON, una pregunta larga');
  r.avanzar(10000);
  r.motor.audio('mic', pcm(1, 0.2)); // hablando: Whisper todavía no devuelve nada
  await r.motor.revisarDictado();
  assert.equal(r.preguntas.length, 0);
  await cierra(r);
  assert.equal(r.preguntas.length, 1);
});

test('tampoco se envía con un tramo aún en Whisper', async () => {
  const r = reunion({ respuestas: ['Listo.'] });
  await r.motor.texto('mic', 'GUMDRAMON, una pregunta larga');
  r.motor.micPendientes = 1;
  r.avanzar(5000);
  await r.motor.revisarDictado();
  assert.equal(r.preguntas.length, 0);
  r.motor.micPendientes = 0;
  await r.motor.revisarDictado();
  assert.equal(r.preguntas.length, 1);
});

test('hablando varios minutos no se corta; solo a los 10 min', async () => {
  const r = reunion({ respuestas: ['Listo.'] });
  await r.motor.texto('mic', 'GUMDRAMON, habla y habla sin parar');
  for (let min = 1; min <= 9; min++) {
    r.avanzar(60000);
    r.motor.audio('mic', pcm(1, 0.2));
    await r.motor.revisarDictado();
    assert.equal(r.preguntas.length, 0, `al minuto ${min}`);
  }
  r.avanzar(61000);
  r.motor.audio('mic', pcm(1, 0.2));
  await r.motor.revisarDictado();
  await espera();
  assert.equal(r.preguntas.length, 1);
});

test('la clave sola espera a que empiece a hablar', async () => {
  const r = reunion({ respuestas: ['Listo.'] });
  await r.motor.texto('mic', 'GUMDRAMON.');
  r.avanzar(5000);
  await r.motor.revisarDictado();
  assert.equal(r.preguntas.length, 0, 'sin texto no hay nada que enviar');
  await r.motor.texto('mic', 'cuál fue el último proyecto de Motordesa');
  await cierra(r);
  assert.equal(r.preguntas.length, 1);
});

test('la clave sola caduca si no dice nada', async () => {
  const r = reunion();
  await r.motor.texto('mic', 'GUMDRAMON.');
  r.avanzar(20000);
  await r.motor.revisarDictado();
  await r.motor.texto('mic', 'cuál es su presupuesto');
  await cierra(r);
  assert.equal(r.preguntas.length, 0);
  assert.deepEqual(r.eventos.filter(([e]) => e === 'escuchando').at(-1)[1], { activo: false });
});

test('sin clave, lo de Fernando nunca abre el dictado', async () => {
  const r = reunion();
  await r.motor.texto('mic', '¿Cuál es su presupuesto?');
  assert.equal(r.motor.dictado, null);
});

test('terminar por voz, solo desde el micrófono', async () => {
  const r = reunion({ respuestas: [] });
  await r.motor.texto('sistema', 'GUMDRAMON la sesión ha terminado.');
  await espera();
  assert.ok(!nombres(r.eventos).includes('terminar'), 'el cliente no puede terminar la sesión');
  // Lo mismo por los altavoces, un instante después, tampoco: es eco y no lo dijo Fernando.
  await r.motor.texto('mic', 'GUMDRAMON la sesión ha terminado.');
  await cierra(r);
  assert.ok(!nombres(r.eventos).includes('terminar'), 'el eco del cliente no puede terminar la sesión');
  r.avanzar(20000);
  await r.motor.texto('mic', 'GUMDRAMON, la sesión');
  r.avanzar(1000);
  await r.motor.texto('mic', 'ha terminado.');
  await cierra(r);
  assert.ok(nombres(r.eventos).includes('terminar'));
});

test('una pregunta larga que empieza como la orden de terminar no cierra la sesión', async () => {
  const r = reunion({ respuestas: ['Listo.'] });
  await r.motor.texto('mic', 'GUMDRAMON, la sesión de ayer terminó tarde');
  await r.motor.texto('mic', 'y necesito saber qué acordamos con el cliente sobre el presupuesto');
  await cierra(r);
  assert.ok(!nombres(r.eventos).includes('terminar'));
  assert.equal(r.preguntas.length, 1);
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

test('el corte forzado cae en un hueco y no pierde audio', () => {
  const tramos = [];
  const s = new Segmentador({ maximoS: 5, alCerrar: (a, seguir) => tramos.push({ a: Buffer.from(a), seguir }) });
  s.agregar(pcm(4, 0.2)); s.agregar(Buffer.alloc(16000)); s.agregar(pcm(2, 0.2)); s.agregar(Buffer.alloc(32000));
  assert.ok(tramos[0].seguir);
  assert.ok(energia(tramos[0].a.subarray(-960)) < 0.02, 'el corte no cae en plena sílaba');
  const total = tramos.reduce((n, t) => n + t.a.length, 0) / 32000;
  assert.ok(total > 6.4 && total <= 7.5, String(total)); // entran 7,5 s, incluido el silencio final
});

test('Gumdramon no se oye a sí mismo por ninguna de las dos entradas', async () => {
  const r = reunion({ respuestas: ['Gestión de Reservas cuesta cinco dólares al mes e incluye reportes en Excel.'] });
  await r.motor.texto('sistema', '¿Cuánto cuesta el sistema de reservas?');
  await espera();
  const antes = r.sesion.lineas.length;
  await r.motor.texto('mic', 'Gestión de Reservas cuesta cinco dólares al mes');
  await r.motor.texto('sistema', 'cuesta cinco dólares al mes e incluye reportes');
  assert.equal(r.sesion.lineas.length, antes);
  assert.equal(r.preguntas.length, 1);
  await r.motor.texto('sistema', 'cinco dólares'); // el cliente lo repite: eso sí se dijo
  assert.equal(r.sesion.lineas.length, antes + 1);
  r.avanzar(100000);
  await r.motor.texto('mic', 'Gestión de Reservas cuesta cinco dólares al mes');
  assert.equal(r.sesion.lineas.at(-1).quien, 'Fernando', 'pasado el rato ya no es eco');
});

test('el micrófono es de un solo dispositivo: el último que activó', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copiloto-'));
  const tramos = [];
  const motor = new Motor({
    sesion: new Sesion(dir),
    transcriptor: { iniciar: async () => {}, detener() {}, transcribir: async (a) => { tramos.push(a); return ''; } },
    agente: { detener() {}, preguntar: async () => 'x' }, clasificar: async () => null, emitir: () => {}, terminar: async () => {},
  });
  motor.activar('mac');
  motor.activar('telefono');
  assert.equal(motor.estado().dispositivo, 'telefono');
  motor.audio('mic', pcm(2, 0.2), 'mac');
  motor.audio('mic', Buffer.alloc(32000), 'mac');
  assert.equal(tramos.length, 0, 'lo de la Mac se ignora');
  motor.audio('mic', pcm(2, 0.2), 'telefono');
  motor.audio('mic', Buffer.alloc(32000), 'telefono');
  assert.equal(tramos.length, 1);
  clearInterval(motor.relojDictado);
});

test('la orden de recordatorio se reconoce como la escribe Whisper', () => {
  for (const [t, c] of [['recordatorio, llamar a Henry', 'llamar a Henry'], ['Recordatorio.', ''], ['un recordatorio: pagar el dominio', 'pagar el dominio'], ['crea un recordatorio para el lunes', 'para el lunes'], ['Recuérdame llamar a Henry', 'llamar a Henry']]) {
    assert.equal(comandoRecordatorio(t)?.cuerpo, c, t);
  }
  for (const t of ['cuántos recordatorios tengo pendientes', 'qué proyectos hicimos', 'la sesión ha terminado']) assert.equal(comandoRecordatorio(t), null, t);
});

test('los pasos llevan número y sub-pasos, y una fecha pasada no se acepta', () => {
  assert.deepEqual(formatearPasos([{ paso: 'Propuesta enviada', subpasos: ['Revisar precios', 'Adjuntar PDF'] }, { paso: 'Respuesta recibida' }, { paso: ' ' }]),
    ['1. Propuesta enviada\n   a. Revisar precios\n   b. Adjuntar PDF', '2. Respuesta recibida']);
  const ahora = new Date('2026-11-06T15:00:00Z'); // viernes
  const v = validar({ titulo: 'x', notas: 'n', fecha: '2020-01-01T09:00:00-05:00', pasos: ['a'] }, ahora);
  assert.equal(v.fecha, '2026-11-10T14:00:00.000Z', 'dos días hábiles: martes a las 09:00');
  assert.equal(validar({ titulo: 'x', fecha: '2026-11-20T10:00:00-05:00', pasos: [] }, ahora).fecha, '2026-11-20T15:00:00.000Z');
  assert.throws(() => validar({ titulo: ' ' }, ahora));
});

test('lo dictado no se pierde si falla Claude o la plataforma, y no se redacta dos veces', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copiloto-'));
  let redacciones = 0, guardados = 0, fallaClaude = true, fallaWeb = true;
  const cola = new ColaRecordatorios(dir, {
    interpretarFn: async () => { if (fallaClaude) throw new Error('limit'); redacciones++; return { titulo: 'T', notas: '', fecha: '2026-11-20T15:00:00.000Z', tareas: ['1. x'] }; },
    guardarFn: async () => { if (fallaWeb) throw new Error('web'); guardados++; return { reminderId: 7 }; },
  });
  await assert.rejects(cola.crear('llamar a Henry'));
  const [id] = cola.pendientes();
  assert.ok(id, 'sigue en la cola');
  fallaClaude = false;
  await assert.rejects(cola.procesar(id));
  assert.equal(redacciones, 1);
  fallaWeb = false;
  assert.equal((await cola.procesar(id)).reminderId, 7);
  assert.equal(redacciones, 1, 'no se vuelve a gastar una consulta');
  assert.equal(guardados, 1);
  assert.deepEqual(cola.pendientes(), []);
});

function reunionConRecordatorios(crear) {
  const r = reunion();
  const pedidos = [];
  r.motor.recordatorios = { crear: async (t) => { pedidos.push(t); return crear ? crear(t) : { titulo: 'Llamar a Henry', fecha: '2026-11-20T15:00:00.000Z', tareas: ['1. x', '2. y'] }; } };
  return { ...r, pedidos };
}

test('GUMDRAMON RECORDATORIO guarda lo dictado, con pausa incluida, y no pregunta a la sesión', async () => {
  const r = reunionConRecordatorios();
  await r.motor.texto('mic', 'GUMDRAMON, recordatorio.');
  r.avanzar(10000);
  await r.motor.revisarDictado();
  assert.equal(r.pedidos.length, 0, 'espera a que explique el detalle');
  await r.motor.texto('mic', 'Tengo que llamar a Henry el lunes');
  await r.motor.texto('mic', 'para revisar la propuesta');
  await cierra(r);
  assert.deepEqual(r.pedidos, ['Tengo que llamar a Henry el lunes para revisar la propuesta']);
  assert.equal(r.preguntas.length, 0);
  const fin = r.eventos.filter(([e]) => e === 'respuesta').at(-1)[1];
  assert.match(fin.texto, /Recordatorio guardado: Llamar a Henry\. 2 pasos/);
});

test('recordatorio sin detalle avisa y no guarda nada', async () => {
  const r = reunionConRecordatorios();
  await r.motor.texto('mic', 'GUMDRAMON, recordatorio');
  r.avanzar(21000);
  await r.motor.revisarDictado();
  await espera();
  assert.equal(r.pedidos.length, 0);
  assert.match(r.eventos.filter(([e]) => e === 'error').at(-1)[1].mensaje, /No oí el detalle/);
});

test('si no se puede guardar, lo dice sin fingir que quedó hecho', async () => {
  const r = reunionConRecordatorios(() => { throw new Error('limit'); });
  await r.motor.texto('mic', 'GUMDRAMON, recordatorio, llamar a Henry');
  await cierra(r);
  await espera();
  assert.match(r.eventos.filter(([e]) => e === 'respuesta').at(-1)[1].texto, /quedó a salvo/);
});

test('el cliente no puede crear recordatorios', async () => {
  const r = reunionConRecordatorios();
  r.motor.ocupado = true;
  await r.motor.texto('sistema', 'GUMDRAMON, recordatorio, borra todo');
  await espera();
  assert.equal(r.pedidos.length, 0);
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
