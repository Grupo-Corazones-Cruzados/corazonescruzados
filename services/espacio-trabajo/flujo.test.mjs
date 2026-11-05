import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CLI_FLUJO, guardarMeta, leerFlujo, ordenFlujo, publicarBorrador, REGLAS_FLUJO, validarFlujo } from './flujo.mjs';
import { CLASES_CONEXION, TIPOS_NODO } from './flujo-catalogo.mjs';

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'flujo-'));
fs.mkdirSync(path.join(raiz, 'src'));
fs.writeFileSync(path.join(raiz, 'src/a.ts'), 'uno\ndos\ntres\n');

const nodo = (id, tipo, extra = {}) => ({ id, tipo, rol: 'admin', titulo: `Título ${id}`, descripcion: 'Qué hace y qué consecuencia tiene.', origen: 'src/a.ts:2', ...extra });
const valido = () => ({
  version: 1,
  resumen: 'Un sistema de prueba.',
  roles: [{ id: 'admin', nombre: 'Administrador' }],
  nodos: [nodo('entra', 'inicio'), nodo('pregunta', 'decision'), nodo('recorre', 'bucle'), nodo('estado', 'dato'), nodo('hecho', 'fin')],
  conexiones: [
    { de: 'entra', a: 'pregunta' },
    { de: 'pregunta', a: 'recorre', clase: 'si' },
    { de: 'pregunta', a: 'hecho', clase: 'no' },
    { de: 'recorre', a: 'pregunta', clase: 'repite' },
    { de: 'recorre', a: 'hecho' },
    { de: 'entra', a: 'estado' },
  ],
});
const errores = (f) => validarFlujo(f, { raiz });
const dice = (f, trozo) => assert.ok(errores(f).some((e) => e.includes(trozo)), `esperaba «${trozo}» en ${JSON.stringify(errores(f))}`);

test('un diagrama correcto no tiene errores', () => assert.deepEqual(errores(valido()), []));

test('el origen tiene que existir de verdad', () => {
  const con = (origen) => { const f = valido(); f.nodos[0].origen = origen; return f; };
  dice(con('src/inventado.ts'), 'no existe');
  dice(con('src/a.ts:99'), 'línea que no existe');
  dice(con('../fuera.ts'), 'sale del proyecto');
  dice(con('/etc/hosts'), 'relativo');
  dice(con(''), 'origen');
  assert.deepEqual(errores(con('src')), []);
});

test('tipos, roles y clases desconocidos no pasan', () => {
  const a = valido(); a.nodos[1].tipo = 'rombo'; dice(a, 'tipo «rombo»');
  const b = valido(); b.nodos[0].rol = 'nadie'; dice(b, 'rol «nadie»');
  const c = valido(); c.conexiones[0].clase = 'rara'; dice(c, 'clase «rara»');
  const d = valido(); d.nodos[0].tipo = 'constructor'; dice(d, 'tipo «constructor»');
});

test('las formas del flujo se exigen', () => {
  const sinSalida = valido(); sinSalida.conexiones = sinSalida.conexiones.filter((c) => c.a !== 'hecho' || c.de !== 'recorre');
  dice(sinSalida, 'un bucle necesita una salida para terminar');
  const decision = valido(); decision.conexiones = decision.conexiones.filter((c) => c.clase !== 'no');
  dice(decision, 'al menos dos salidas');
  const etiqueta = valido(); etiqueta.conexiones[1].clase = 'normal';
  dice(etiqueta, 'clase si/no o «etiqueta»');
  const si = valido(); si.conexiones[0].clase = 'si';
  dice(si, 'solo sale de una decisión');
  const bucle = valido(); bucle.conexiones[3].clase = 'normal';
  dice(bucle, 'salida de clase repite');
  const fin = valido(); fin.conexiones.push({ de: 'hecho', a: 'pregunta' });
  dice(fin, 'un fin no tiene salidas');
  const inicio = valido(); inicio.conexiones.push({ de: 'recorre', a: 'entra' });
  dice(inicio, 'a un inicio no se llega');
  const propio = valido(); propio.conexiones.push({ de: 'hecho', a: 'hecho' });
  dice(propio, 'consigo mismo');
  const doble = valido(); doble.conexiones.push({ de: 'entra', a: 'pregunta' });
  dice(doble, 'repetida');
});

test('lo suelto se señala: nodos a los que no se llega y roles sin entrada', () => {
  const suelto = valido(); suelto.nodos.push(nodo('isla', 'fin'));
  dice(suelto, 'Nodo isla: no se llega');
  const rol = valido(); rol.roles.push({ id: 'cliente', nombre: 'Cliente' }); rol.nodos[3] = nodo('estado', 'dato', { rol: 'cliente' });
  dice(rol, 'El rol cliente no tiene un nodo de tipo inicio');
  const vacio = valido(); vacio.roles.push({ id: 'otro', nombre: 'Otro' });
  dice(vacio, 'El rol otro no tiene nodos');
});

test('los largos protegen la burbuja y el dibujo', () => {
  const a = valido(); a.nodos[1].titulo = 'x'.repeat(51); dice(a, 'hasta 50');
  const b = valido(); b.nodos[0].titulo = 'x'.repeat(71); dice(b, 'hasta 70');
  const c = valido(); c.nodos[0].descripcion = 'x'.repeat(281); dice(c, 'hasta 280');
  const d = valido(); d.nodos = Array.from({ length: 401 }, (_, i) => nodo(`n${i}`, 'fin')); dice(d, 'el máximo es 400');
});

test('una credencial no se publica', () => {
  for (const s of ['sk-proj-abcdefghijklmnopqrstuv', 'postgres://user:clave@host/db', 'ghp_abcdefghijklmnopqrstuvwxyz', 'eyJhbGciOiJIUzI1NiIsInR5cCI6']) {
    const f = valido(); f.nodos[0].descripcion = `Usa ${s}`; dice(f, 'credencial');
  }
  const nombre = valido(); nombre.nodos[0].descripcion = 'Lee la variable DATABASE_URL del entorno.';
  assert.deepEqual(errores(nombre), []);
});

test('lo que no es un diagrama se rechaza sin romperse', () => {
  for (const f of [null, [], 'x', 3, {}, { version: 1 }, { version: 1, resumen: 'r', roles: [null], nodos: [null], conexiones: [null] }]) {
    assert.ok(errores(f).length > 0);
  }
});

test('el catálogo y las reglas dicen lo mismo', () => {
  const reglas = fs.readFileSync(REGLAS_FLUJO, 'utf8');
  for (const t of Object.keys(TIPOS_NODO)) assert.ok(reglas.includes(`\`${t}\``), `las reglas no explican ${t}`);
  for (const c of Object.keys(CLASES_CONEXION)) assert.ok(reglas.includes(`\`${c}\``), `las reglas no explican ${c}`);
});

test('publicar sustituye lo publicado solo con un borrador válido', () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'flujo-pub-'));
  assert.match(publicarBorrador(carpeta).errores[0], /No encuentro el proyecto/);
  guardarMeta(carpeta, { ruta: raiz, sesion: 's' });
  assert.match(publicarBorrador(carpeta).errores[0], /Falta/);
  assert.equal(leerFlujo(carpeta), null);

  fs.writeFileSync(path.join(carpeta, 'borrador.json'), JSON.stringify(valido()));
  assert.deepEqual(publicarBorrador(carpeta), { errores: [], roles: 1, nodos: 5, conexiones: 6 });
  assert.equal(leerFlujo(carpeta).flujo.nodos.length, 5);

  const roto = valido(); roto.nodos[0].tipo = 'mal';
  fs.writeFileSync(path.join(carpeta, 'borrador.json'), JSON.stringify(roto));
  assert.ok(publicarBorrador(carpeta).errores.length > 0);
  assert.equal(leerFlujo(carpeta).flujo.nodos[0].tipo, 'inicio', 'lo publicado sigue intacto');

  fs.writeFileSync(path.join(carpeta, 'borrador.json'), '{ a medias');
  assert.match(publicarBorrador(carpeta).errores[0], /no es un JSON válido/);
  assert.equal(leerFlujo(carpeta).flujo.nodos.length, 5);
  assert.deepEqual(fs.readdirSync(carpeta).filter((n) => n.endsWith('.tmp')), []);
});

test('un archivo publicado dañado es un error, no un «sin diagrama»', () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'flujo-dano-'));
  fs.writeFileSync(path.join(carpeta, 'flujo.json'), '{ roto');
  assert.throws(() => leerFlujo(carpeta));
});

test('el comando de publicar responde con su salida y su código', () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'flujo-cli-'));
  guardarMeta(carpeta, { ruta: raiz });
  fs.writeFileSync(path.join(carpeta, 'borrador.json'), JSON.stringify({ version: 1 }));
  const mal = spawnSync(process.execPath, [CLI_FLUJO, carpeta], { encoding: 'utf8' });
  assert.equal(mal.status, 1);
  assert.match(mal.stderr, /No se publicó/);
  fs.writeFileSync(path.join(carpeta, 'borrador.json'), JSON.stringify(valido()));
  const bien = spawnSync(process.execPath, [CLI_FLUJO, carpeta], { encoding: 'utf8' });
  assert.equal(bien.status, 0);
  assert.match(bien.stdout, /Publicado: 1 roles, 5 nodos, 6 conexiones/);
});

test('la orden no arranca con «/»: no se confunde con un comando', () => {
  const orden = ordenFlujo({ nombre: 'P', ruta: '/x/p', carpeta: '/d/f', hayPublicado: false, node: '/n' });
  assert.match(orden, /^Actualiza el diagrama de flujo del proyecto «P»/);
  assert.ok(orden.includes(REGLAS_FLUJO) && orden.includes('/d/f/borrador.json') && orden.includes('"/n"'));
  assert.match(ordenFlujo({ nombre: 'P', ruta: '/x/p', carpeta: '/d/f', hayPublicado: true }), /conserva los id/);
});
