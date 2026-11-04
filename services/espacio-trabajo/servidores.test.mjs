import test from 'node:test';
import assert from 'node:assert/strict';
import { aServidor, costos, crearServidores, dentroDe, emparejar, estadoDespliegue, ordenar, repoDeRemoto } from './servidores.mjs';

const proyectoRailway = (servicios) => ({
  id: 'p1', name: 'Servidor', environments: { edges: [{ node: { id: 'dev', name: 'dev' } }, { node: { id: 'pro', name: 'production' } }] },
  services: { edges: servicios.map(([id, status, extra = {}]) => ({ node: { id, name: id, serviceInstances: { edges: [
    { node: { environmentId: 'dev', source: {}, latestDeployment: { status: 'FAILED', createdAt: '2026-01-01T00:00:00Z' } } },
    { node: { environmentId: 'pro', source: extra.source || { repo: 'Org/Repo' }, latestDeployment: status && { status, createdAt: '2026-11-04T00:00:00Z', meta: extra.meta } } },
  ] } } })) },
});

test('el costo suma las filas de cada servicio y cuenta lo de un servicio ya borrado', () => {
  const filas = [
    { measurement: 'MEMORY_USAGE_GB', value: 43200, tags: { serviceId: 'a' } },
    { measurement: 'CPU_USAGE', value: 43200, tags: { serviceId: 'a' } },
    { measurement: 'NETWORK_TX_GB', value: 2, tags: { serviceId: 'b' } },
    { measurement: 'DISK_USAGE_GB', value: 43200, tags: {} },
  ];
  const r = costos(filas, filas);
  assert.equal(Math.round(r.porServicio.a), 30);
  assert.equal(Math.round(r.porServicio.b * 10), 1);
  assert.equal(Math.round(r.total * 100), 3025);
});

test('manda el total sin agrupar: los servicios se reparten sobre él', () => {
  const r = costos([
    { measurement: 'NETWORK_TX_GB', value: 80, tags: { serviceId: 'a' } },
    { measurement: 'NETWORK_TX_GB', value: 40, tags: { serviceId: 'b' } },
  ], [{ measurement: 'NETWORK_TX_GB', value: 100 }]);
  assert.equal(r.total, 5);
  assert.ok(Math.abs(r.porServicio.a + r.porServicio.b - 5) < 1e-9);
  assert.ok(Math.abs(r.porServicio.a / r.porServicio.b - 2) < 1e-9);
  assert.equal(costos([], []).total, 0);
});

test('cada estado de Railway cae en su grupo', () => {
  for (const s of ['QUEUED', 'WAITING', 'INITIALIZING', 'BUILDING', 'DEPLOYING', 'NEEDS_APPROVAL']) assert.equal(estadoDespliegue(s), 'procesando');
  for (const s of ['FAILED', 'CRASHED']) assert.equal(estadoDespliegue(s), 'fallo');
  assert.equal(estadoDespliegue('SUCCESS'), 'publicado');
  assert.equal(estadoDespliegue('SLEEPING'), 'dormido');
  assert.equal(estadoDespliegue('REMOVED'), 'sin');
  assert.equal(estadoDespliegue(null), 'sin');
});

test('el remoto se reconoce en https, ssh y con credenciales, sin distinguir mayúsculas', () => {
  assert.equal(repoDeRemoto('https://github.com/Org/Repo.git\n'), 'org/repo');
  assert.equal(repoDeRemoto('git@github.com:Org/Repo.git'), 'org/repo');
  assert.equal(repoDeRemoto('https://x:clave@github.com/Org/Repo'), 'org/repo');
  assert.equal(repoDeRemoto(''), null);
});

test('usa producción, un publicando manda sobre un fallo y solo salen datos elegidos de meta', () => {
  const s = aServidor(proyectoRailway([
    ['web', 'BUILDING', { meta: { commitHash: 'abcdef123456', commitMessage: 'título\ncuerpo', serviceManifest: { secreto: 'x' } } }],
    ['cron', 'FAILED'],
    ['bd', 'SUCCESS', { source: { image: 'ghcr.io/railwayapp-templates/postgres-ssl:18' } }],
  ]));
  assert.equal(s.estado, 'procesando');
  assert.equal(s.publicando, 1);
  assert.equal(s.fallidos, 1);
  const web = s.servicios.find((x) => x.id === 'web');
  assert.equal(web.commit, 'abcdef1');
  assert.equal(web.mensaje, 'título');
  assert.ok(!JSON.stringify(s.servicios).includes('secreto'));
  assert.equal(s.servicios.find((x) => x.id === 'bd').base, true);
  assert.equal(s.servicios.find((x) => x.id === 'cron').estado, 'fallo', 'mira producción, no el otro entorno');
});

test('dentro de una carpeta no confunde nombres parecidos y tolera la forma de los acentos', () => {
  assert.ok(dentroDe('/a/Motordesa/app', '/a/Motordesa'));
  assert.ok(!dentroDe('/a/Motordesa2', '/a/Motordesa'));
  assert.ok(dentroDe('/a/Gestión', '/a/Gestión'));
});

test('un proyecto va con su servidor por repositorio o enlace; si no hay ninguno queda sin acceso', () => {
  const srv = { ...aServidor(proyectoRailway([['web', 'SUCCESS']])) };
  const lista = [
    { id: 'porRepo', nombre: 'A', grupo: 'G', ruta: '/x/a' },
    { id: 'porEnlace', nombre: 'B', grupo: 'G', ruta: '/x/b' },
    { id: 'ajeno', nombre: 'C', grupo: 'G', ruta: '/x/c' },
    { id: 'sinNada', nombre: 'D', grupo: 'G', ruta: '/x/d' },
  ];
  const sin = emparejar(lista, { porRepo: 'org/repo', ajeno: 'cliente/otro' }, [{ projectPath: '/x/b/app', project: 'p1' }], [srv]);
  assert.deepEqual(srv.proyectos, ['porRepo', 'porEnlace']);
  assert.deepEqual(sin.map((s) => s.id), ['ajeno'], 'una carpeta sin repositorio ni enlace no es un servidor');
});

test('primero lo que publica, luego lo que falló, luego lo que más cuesta y al final lo ajeno', () => {
  const r = ordenar([
    { nombre: 'barato', estado: 'publicado', costo: 1 }, { nombre: 'ajeno', estado: 'publicado', costo: null, ajeno: true },
    { nombre: 'caro', estado: 'publicado', costo: 9 }, { nombre: 'mal', estado: 'fallo', costo: 0 }, { nombre: 'va', estado: 'procesando', costo: 0 },
  ]);
  assert.deepEqual(r.map((s) => s.nombre), ['va', 'mal', 'caro', 'barato', 'ajeno']);
});

/* Railway de mentira, para contar consultas y probar sus fallos. */
function railway(respuesta) {
  const llamadas = [];
  const f = async (_u, init) => {
    const { query, variables } = JSON.parse(init.body);
    llamadas.push(query);
    const r = respuesta(query, variables, llamadas.length);
    if (r instanceof Response) return r;
    return new Response(JSON.stringify(r));
  };
  return { f, llamadas };
}
const normal = (q) => {
  if (q.includes('me{')) return { data: { me: { workspaces: [{ id: 'w', plan: 'PRO', customer: { currentUsage: 3, billingPeriod: { start: '2026-10-16T00:00:00Z', end: '2026-11-16T00:00:00Z' } } }] } } };
  if (q.includes('usage(')) { const u = [{ measurement: 'NETWORK_TX_GB', value: 20, tags: { serviceId: 'web' } }]; return { data: { total: u, porServicio: u } }; }
  if (q.includes('edges{node{id}}')) return { data: { projects: { edges: [{ node: { id: 'p1' } }] } } };
  if (q.includes('project(id')) return { errors: [{ message: 'Not Authorized' }] };
  return { data: { projects: { edges: [{ node: proyectoRailway([['web', 'SUCCESS']]) }] } } };
};
const sinProyectos = async () => [];

test('se recuerda: dos lecturas seguidas no repiten consultas y el token no sale', async (t) => {
  const { default: fs } = await import('node:fs');
  const { default: os } = await import('node:os');
  const { default: path } = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srv-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const archivoCli = path.join(dir, 'c.json');
  fs.writeFileSync(archivoCli, JSON.stringify({ user: { token: 'TOKEN-SECRETO' }, projects: {} }));
  let hora = 1_000_000;
  const { f, llamadas } = railway(normal);
  const s = crearServidores({ proyectos: sinProyectos, archivoCli, fetch: f, reloj: () => hora });
  const a = await s.leer();
  const n = llamadas.length;
  assert.equal(a.servidores[0].costo, 1);
  assert.equal(a.ciclo.consumo, 3);
  assert.ok(!JSON.stringify(a).includes('TOKEN-SECRETO'));
  assert.ok(!('repos' in a.servidores[0]));
  await s.leer();
  assert.equal(llamadas.length, n);
  hora += 26_000;
  await s.leer();
  assert.equal(llamadas.length, n + 1, 'el estado se refresca con una consulta; el costo no');
});

test('sin sesión lo dice, y un corte conserva lo último sabido avisando', async (t) => {
  const { default: fs } = await import('node:fs');
  const { default: os } = await import('node:os');
  const { default: path } = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srv-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const archivoCli = path.join(dir, 'c.json');

  const sinArchivo = crearServidores({ proyectos: sinProyectos, archivoCli, fetch: railway(normal).f });
  assert.equal((await sinArchivo.leer()).conectado, false);

  fs.writeFileSync(archivoCli, JSON.stringify({ user: { token: 't' } }));
  let modo = 'bien';
  let hora = 1_000_000;
  const { f } = railway((q) => {
    if (modo === 'limite') return new Response('{}', { status: 429 });
    if (modo === 'caducado') return new Response('{}', { status: 401 });
    return normal(q);
  });
  const s = crearServidores({ proyectos: sinProyectos, archivoCli, fetch: f, reloj: () => hora });
  assert.equal((await s.leer()).desactualizado, false);
  modo = 'limite'; hora += 30_000;
  const b = await s.leer();
  assert.equal(b.desactualizado, true);
  assert.equal(b.servidores.length, 1);
  modo = 'caducado'; hora += 30_000;
  assert.equal((await s.leer()).conectado, false);
});

test('un proyecto ajeno sin permiso no se vuelve a preguntar en cada lectura', async (t) => {
  const { default: fs } = await import('node:fs');
  const { default: os } = await import('node:os');
  const { default: path } = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srv-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const archivoCli = path.join(dir, 'c.json');
  fs.writeFileSync(archivoCli, JSON.stringify({ user: { token: 't' }, projects: { a: { projectPath: dir, project: 'ajeno' } } }));
  let hora = 1_000_000;
  const { f, llamadas } = railway(normal);
  const s = crearServidores({ proyectos: async () => [{ id: 'c', nombre: 'Cliente', grupo: 'G', ruta: dir }], archivoCli, fetch: f, reloj: () => hora });
  const a = await s.leer();
  assert.deepEqual(a.sinAcceso.map((x) => x.nombre), ['Cliente']);
  hora += 26_000;
  await s.leer();
  assert.equal(llamadas.filter((q) => q.includes('project(id')).length, 1);
});
