/**
 * SERVIDORES DE RAILWAY: cómo va cada publicación y cuánto cuesta cada servidor. Solo lee.
 *
 * Usa la sesión que la CLI de Railway ya guarda; ese token nunca sale de este proceso. La API permite
 * 1000 consultas por hora, compartidas con la CLI: el estado se recuerda unos segundos y el costo 10 min.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

const API = 'https://backboard.railway.com/graphql/v2';
const VIDA_ESTADO_MS = 25_000;
const VIDA_ESTADO_PUBLICANDO_MS = 12_000;
const VIDA_LENTA_MS = 10 * 60_000;
const PROCESANDO = new Set(['QUEUED', 'WAITING', 'INITIALIZING', 'BUILDING', 'DEPLOYING', 'NEEDS_APPROVAL']);
const FALLO = new Set(['FAILED', 'CRASHED']);

/* Precios del plan por minuto (10 $/GB-mes y 20 $/vCPU-mes, en meses de 30 días). Comprobado el 2026-11-04:
   la suma de todos los servicios da 15,337 $ y Railway dice 15,347 $. */
const PRECIO = { CPU_USAGE: 20 / 43200, MEMORY_USAGE_GB: 10 / 43200, DISK_USAGE_GB: 0.15 / 43200, NETWORK_TX_GB: 0.05 };
const MEDIDAS = Object.keys(PRECIO).join(',');

const CONSULTA_SERVICIOS = `id name environments{edges{node{id name}}} services{edges{node{id name serviceInstances{edges{node{
  environmentId source{repo image} latestDeployment{status createdAt meta}}}}}}}`;

export class SinSesionRailway extends Error {}
export class LimiteRailway extends Error {}

const valorar = (f) => f.value * (PRECIO[f.measurement] || 0);

/**
 * Lo que manda es el total sin agrupar: es el que cuadra con la factura. Agrupada por servicio, Railway
 * devuelve un 3,6 % más de RAM (medido el 2026-11-04), así que cada servicio se reparte sobre ese total.
 * Hay varias filas por servicio, y las que no traen servicio son de uno ya borrado: cuentan en el total.
 */
export function costos(filasPorServicio, filasTotal) {
  const total = filasTotal.reduce((n, f) => n + valorar(f), 0);
  const bruto = filasPorServicio.reduce((n, f) => n + valorar(f), 0);
  const ajuste = bruto ? total / bruto : 0;
  const porServicio = {};
  for (const f of filasPorServicio) {
    const id = f.tags?.serviceId;
    if (id) porServicio[id] = (porServicio[id] || 0) + valorar(f) * ajuste;
  }
  return { total, porServicio };
}

export function estadoDespliegue(status) {
  if (!status) return 'sin';
  if (PROCESANDO.has(status)) return 'procesando';
  if (FALLO.has(status)) return 'fallo';
  if (status === 'SLEEPING') return 'dormido';
  if (status === 'SUCCESS') return 'publicado';
  return 'sin';
}

export function repoDeRemoto(url) {
  const m = /[/:]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/.exec((url || '').trim());
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null;
}

/** Solo lo que se muestra: `meta` trae también la configuración de construcción, que no sale de aquí. */
export function aServidor(p, costo = null, extra = {}) {
  const entorno = p.environments.edges.map((e) => e.node);
  const principal = (entorno.find((e) => e.name === 'production') || entorno[0])?.id;
  const repos = new Set();
  const servicios = p.services.edges.map(({ node: s }) => {
    const instancias = s.serviceInstances.edges.map((e) => e.node);
    const i = instancias.find((x) => x.environmentId === principal) || instancias[0];
    const d = i?.latestDeployment;
    if (i?.source?.repo) repos.add(i.source.repo.toLowerCase());
    return {
      id: s.id,
      nombre: s.name,
      base: /postgres|mysql|redis|mongo/i.test(i?.source?.image || ''),
      estado: estadoDespliegue(d?.status),
      status: d?.status || null,
      fecha: d?.createdAt ? Date.parse(d.createdAt) : null,
      commit: d?.meta?.commitHash ? d.meta.commitHash.slice(0, 7) : null,
      mensaje: d?.meta?.commitMessage ? d.meta.commitMessage.split('\n')[0].slice(0, 200) : null,
      costo: costo ? (costo.porServicio[s.id] || 0) : null,
      url: `https://railway.com/project/${p.id}/service/${s.id}${principal ? `?environmentId=${principal}` : ''}`,
    };
  });
  const hay = (e) => servicios.filter((s) => s.estado === e).length;
  return {
    id: p.id,
    nombre: p.name,
    url: `https://railway.com/project/${p.id}`,
    estado: hay('procesando') ? 'procesando' : hay('fallo') ? 'fallo' : 'publicado',
    publicando: hay('procesando'),
    fallidos: hay('fallo'),
    fecha: Math.max(0, ...servicios.filter((s) => !s.base).map((s) => s.fecha || 0)) || null,
    costo: costo ? costo.total : null,
    servicios: servicios.sort((a, b) => (b.costo || 0) - (a.costo || 0) || a.nombre.localeCompare(b.nombre)),
    repos,
    proyectos: [],
    ...extra,
  };
}

const norm = (r) => r.normalize('NFC');
export const dentroDe = (ruta, raiz) => norm(ruta) === norm(raiz) || norm(ruta).startsWith(`${norm(raiz)}/`);

/** Un proyecto va con su servidor por el enlace de la CLI o por su repositorio. Si no hay ninguno al alcance, queda sin acceso. */
export function emparejar(proyectos, remotos, enlaces, servidores) {
  const sinAcceso = [];
  for (const p of proyectos) {
    const ids = new Set(enlaces.filter((e) => dentroDe(e.projectPath, p.ruta)).map((e) => e.project));
    const repo = remotos[p.id];
    const suyos = servidores.filter((s) => ids.has(s.id) || (repo && s.repos.has(repo)));
    for (const s of suyos) s.proyectos.push(p.id);
    if (!suyos.length && (repo || ids.size)) sinAcceso.push({ id: p.id, nombre: p.nombre, grupo: p.grupo });
  }
  return sinAcceso.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre));
}

export function ordenar(servidores) {
  const peso = { procesando: 0, fallo: 1 };
  return servidores.sort((a, b) => (peso[a.estado] ?? 2) - (peso[b.estado] ?? 2)
    || Number(!!a.ajeno) - Number(!!b.ajeno) || (b.costo || 0) - (a.costo || 0) || a.nombre.localeCompare(b.nombre));
}

function remotoDe(ruta) {
  return new Promise((ok) => execFile('git', ['-C', ruta, 'remote', 'get-url', 'origin'], { timeout: 5000 }, (e, salida) => ok(e ? null : repoDeRemoto(salida))));
}

export function crearServidores({ proyectos, archivoCli = path.join(os.homedir(), '.railway/config.json'), fetch: traer = globalThis.fetch, reloj = Date.now }) {
  const leerCli = () => {
    try { return JSON.parse(fs.readFileSync(archivoCli, 'utf8')); } catch { return {}; }
  };

  async function consulta(query, variables) {
    const token = leerCli().user?.token;
    if (!token) throw new SinSesionRailway();
    const r = await traer(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'gcc-espacio' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });
    if (r.status === 401) throw new SinSesionRailway();
    if (r.status === 429) throw new LimiteRailway();
    const j = await r.json().catch(() => ({}));
    if (j.errors?.length) {
      const e = new Error(j.errors[0].message);
      if (/not authorized|not found/i.test(e.message)) e.sinPermiso = true;
      throw e;
    }
    if (!r.ok || !j.data) throw new Error(`Railway respondió ${r.status}.`);
    return j.data;
  }

  let lento = null;   // cuentas, ciclo, costos, remotos y proyectos de otras cuentas sin acceso
  let ultimo = null;
  let ultimoEn = 0;
  let enCurso = null;

  async function datosLentos(ahora) {
    if (lento && ahora - lento.en < VIDA_LENTA_MS) return lento;
    const { me } = await consulta('{me{workspaces{id plan customer{billingPeriod{start end} currentUsage}}}}');
    const costosPorProyecto = {};
    for (const w of me.workspaces) {
      const { projects } = await consulta('query($w:String!){projects(workspaceId:$w,first:100){edges{node{id}}}}', { w: w.id });
      for (const { node } of projects.edges) {
        const uso = await consulta(`query($p:String,$s:DateTime!,$e:DateTime){
          total:usage(projectId:$p,measurements:[${MEDIDAS}],startDate:$s,endDate:$e){measurement value}
          porServicio:usage(projectId:$p,measurements:[${MEDIDAS}],groupBy:[SERVICE_ID],startDate:$s,endDate:$e){measurement value tags{serviceId}}}`,
          { p: node.id, s: w.customer.billingPeriod.start, e: new Date(ahora).toISOString() }).catch((e) => { if (e instanceof SinSesionRailway || e instanceof LimiteRailway) throw e; return null; });
        if (uso) costosPorProyecto[node.id] = costos(uso.porServicio, uso.total);
      }
    }
    const lista = await proyectos();
    const remotos = Object.fromEntries(await Promise.all(lista.map(async (p) => [p.id, await remotoDe(p.ruta)])));
    lento = { en: ahora, workspaces: me.workspaces, costosPorProyecto, remotos, inalcanzables: new Set() };
    return lento;
  }

  async function actualizar() {
    const ahora = reloj();
    const l = await datosLentos(ahora);
    const servidores = [];
    for (const w of l.workspaces) {
      const { projects } = await consulta(`query($w:String!){projects(workspaceId:$w,first:100){edges{node{${CONSULTA_SERVICIOS}}}}}`, { w: w.id });
      for (const { node } of projects.edges) servidores.push(aServidor(node, l.costosPorProyecto[node.id] || null));
    }
    /* Los de una cuenta ajena solo se conocen por el enlace de la CLI, y su costo no es gasto de Fernando. */
    const lista = await proyectos();
    const enlaces = Object.values(leerCli().projects || {}).filter((e) => e?.project && e.projectPath);
    const propios = new Set(servidores.map((s) => s.id));
    const ajenos = new Set(enlaces.filter((e) => lista.some((p) => dentroDe(e.projectPath, p.ruta))).map((e) => e.project));
    for (const id of ajenos) {
      if (propios.has(id) || l.inalcanzables.has(id)) continue;
      try {
        const { project } = await consulta(`query($i:String!){project(id:$i){${CONSULTA_SERVICIOS}}}`, { i: id });
        servidores.push(aServidor(project, null, { ajeno: true }));
      } catch (e) {
        if (!e.sinPermiso) throw e;
        l.inalcanzables.add(id);
      }
    }
    const sinAcceso = emparejar(lista, l.remotos, enlaces, servidores);
    const cuenta = l.workspaces[0];
    ultimo = {
      conectado: true,
      desactualizado: false,
      actualizado: ahora,
      ciclo: cuenta ? { consumo: l.workspaces.reduce((n, w) => n + w.customer.currentUsage, 0), hasta: Date.parse(cuenta.customer.billingPeriod.end), plan: cuenta.plan } : null,
      servidores: ordenar(servidores).map(({ repos, ...s }) => s),
      sinAcceso,
    };
    ultimoEn = ahora;
    return ultimo;
  }

  return {
    async leer() {
      const vida = ultimo?.servidores?.some((s) => s.estado === 'procesando') ? VIDA_ESTADO_PUBLICANDO_MS : VIDA_ESTADO_MS;
      if (ultimo && reloj() - ultimoEn < vida) return ultimo;
      enCurso ??= actualizar().finally(() => { enCurso = null; });
      try {
        return await enCurso;
      } catch (e) {
        if (e instanceof SinSesionRailway) { lento = null; ultimo = null; return { conectado: false, servidores: [], sinAcceso: [] }; }
        /* Mejor lo último sabido, avisando, que dejar el panel en blanco por un corte de red. */
        if (ultimo) return { ...ultimo, desactualizado: true };
        throw e;
      }
    },
  };
}
