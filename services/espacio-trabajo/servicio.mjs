#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { query, listSessions, getSessionMessages, renameSession, getSessionInfo } from '@anthropic-ai/claude-agent-sdk';
import { pipeline } from 'node:stream/promises';
import { expandirCadena, plegarCadena } from './cadena.mjs';
import { sesionesActivas, ultimaInteraccion } from './activas.mjs';
import { ajustesDeSesion, carpetaAdjuntos, entornoLimpio, instruccionProyecto, RAICES_CLIENTES } from './aislamiento.mjs';
import { carpetaDe, ErrorVideo, estadoSubida, guardarParte, primerMensaje, raizEdicion, terminarSubida } from './videos.mjs';
import { generarJson } from './generar.mjs';
import { crearServidores } from './servidores.mjs';

/**
 * SERVICIO LOCAL DEL ESPACIO DE TRABAJO. Es el dueño de las sesiones vivas; va aparte de la web
 * para que reiniciar o recompilar la web no corte ningún trabajo.
 *
 * Solo escucha en 127.0.0.1 y exige el token de ~/.gcc-espacio/token. La verdad de las sesiones
 * son los archivos de Claude Code: aquí se guarda el registro de proyectos, nunca conversaciones.
 * Si una sesión no se puede retomar se avisa y se para: JAMÁS se abre otra en silencio (eso
 * hacía el DigiMundo, y por eso «se perdían» las conversaciones).
 */
const DATOS = process.env.ESPACIO_DATOS || path.join(os.homedir(), '.gcc-espacio');
const PUERTO = Number(process.env.ESPACIO_PUERTO || 3791);
const CLAUDE = process.env.CLAUDE_BIN || path.join(os.homedir(), '.local/bin/claude');
const MODO_DEFECTO = 'bypassPermissions';
const INACTIVA_MS = 30 * 60_000;
const MAX_EVENTOS = 4000;
const PAGINA_MENSAJES = Number(process.env.ESPACIO_PAGINA) || 120;
const MAX_ADJUNTO = 100 * 1024 * 1024;
const DIAS_ADJUNTOS = 30;
/* Probados el 2026-11-04 con Claude Code 2.1.318: responden «isn't available in this environment».
   /plan sí se atiende, porque el cuadro de escritura lo convierte en el modo Plan. */
const SIN_DISPONIBILIDAD = new Set(['memory', 'status', 'hooks', 'permissions', 'skills', 'rewind', 'help', 'ide', 'export', 'tasks', 'plugin', 'add-dir', 'login', 'logout', 'statusline', 'vim', 'terminal-setup', 'release-notes', 'bug', 'fast', 'agents']);
const comandosUtiles = (l) => l.filter((c) => !SIN_DISPONIBILIDAD.has(c.name));
const MARCA_ADJUNTOS = '[Archivos adjuntos por el usuario. Léelos con la herramienta Read]';

fs.mkdirSync(DATOS, { recursive: true, mode: 0o700 });
const rutaDato = (n) => path.join(DATOS, n);

function leerJson(nombre, defecto) {
  try { return JSON.parse(fs.readFileSync(rutaDato(nombre), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return defecto; throw e; }
}
function guardarJson(nombre, valor) {
  const tmp = rutaDato(`${nombre}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, rutaDato(nombre));
}

function tokenServicio() {
  const r = rutaDato('token');
  if (!fs.existsSync(r)) fs.writeFileSync(r, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(r, 'utf8').trim();
}
const TOKEN = tokenServicio();

/* ─────────── Proyectos ─────────── */

const clienteDe = (ruta) => {
  const m = ruta.match(/02_Clientes\/([^/]+)/);
  return m ? m[1] : 'Otros';
};

function raizGit(dir) {
  return new Promise((ok) => execFile('git', ['-C', dir, 'rev-parse', '--show-toplevel'], (e, out) => ok(e ? null : out.trim())));
}

/** Los proyectos con sesiones de Claude Code, para no registrar a mano 30 carpetas. */
async function detectar() {
  const sesiones = await listSessions({ limit: 5000 });
  const porCwd = new Map();
  for (const s of sesiones) if (s.cwd) porCwd.set(s.cwd, Math.max(porCwd.get(s.cwd) || 0, s.lastModified || 0));
  const home = os.homedir();
  const excluida = (c) => c === home || c === '/' || c.startsWith('/tmp') || c.startsWith('/private') || c.includes('/Library/CloudStorage/')
    || c === path.join(home, 'Desktop') || c === path.join(home, 'Documents') || !fs.existsSync(c);
  const porRaiz = new Map();
  for (const [cwd, ultima] of porCwd) {
    if (excluida(cwd)) continue;
    const raiz = (await raizGit(cwd)) || cwd;
    const e = porRaiz.get(raiz) || { ruta: raiz, subcarpetas: new Set(), ultima: 0 };
    if (cwd !== raiz) e.subcarpetas.add(cwd);
    e.ultima = Math.max(e.ultima, ultima);
    porRaiz.set(raiz, e);
  }
  // Un proyecto sin sesiones recientes también es un proyecto: Claude Code borra las viejas.
  for (const raiz of reposGit(RAICES_CLIENTES[0])) {
    if (!porRaiz.has(raiz)) porRaiz.set(raiz, { ruta: raiz, subcarpetas: new Set(), ultima: 0 });
  }
  return [...porRaiz.values()].sort((a, b) => b.ultima - a.ultima);
}

function reposGit(dir, nivel = 0, salida = []) {
  let entradas = [];
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return salida; }
  if (entradas.some((e) => e.name === '.git')) { salida.push(dir); return salida; }
  if (nivel >= 3) return salida;
  for (const e of entradas) {
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') reposGit(path.join(dir, e.name), nivel + 1, salida);
  }
  return salida;
}

/* Las sesiones nacidas de una incidencia siguen aisladas aunque se retomen otro día. */
const leerAisladas = () => new Set(leerJson('sesiones-aisladas.json', []));
function marcarAislada(id, aislada) {
  const s = leerAisladas();
  if (aislada) s.add(id); else s.delete(id);
  guardarJson('sesiones-aisladas.json', [...s]);
}

const nuevoId = (ruta) => crypto.createHash('sha1').update(ruta).digest('hex').slice(0, 12);

function crearProyecto(ruta, datos = {}) {
  return {
    id: nuevoId(ruta), ruta,
    nombre: datos.nombre || path.basename(ruta),
    grupo: datos.grupo || clienteDe(ruta),
    subcarpetas: [...(datos.subcarpetas || [])],
    aislado: datos.aislado === true,
  };
}

async function proyectos() {
  let lista = leerJson('proyectos.json', null);
  if (!lista) {
    lista = (await detectar()).map((d) => crearProyecto(d.ruta, { subcarpetas: d.subcarpetas }));
    guardarJson('proyectos.json', lista);
  }
  return lista;
}

/** Fija una ruta real: sin esto, una ruta inexistente haría trabajar a la sesión en otro sitio. */
function validarRuta(ruta) {
  if (typeof ruta !== 'string' || !path.isAbsolute(ruta)) throw new ErrorApi(400, 'La ruta debe ser absoluta.');
  let real;
  try { real = fs.realpathSync(ruta); } catch { throw new ErrorApi(400, 'Esa carpeta no existe.'); }
  if (!fs.statSync(real).isDirectory()) throw new ErrorApi(400, 'Esa ruta no es una carpeta.');
  if (real === os.homedir() || real === '/') throw new ErrorApi(400, 'Esa carpeta es demasiado amplia para ser un proyecto.');
  return real;
}

class ErrorApi extends Error {
  constructor(estado, mensaje, codigo) { super(mensaje); this.estado = estado; this.codigo = codigo; }
}

/* ─────────── Normalización de mensajes: una sola para el historial y el directo ─────────── */

const TOPE = 8000;
const recortar = (t) => (typeof t === 'string' && t.length > TOPE ? `${t.slice(0, TOPE)}\n… (recortado, ${t.length} caracteres)` : t);

function recortarEntrada(v) {
  if (typeof v === 'string') return recortar(v);
  if (Array.isArray(v)) return v.map(recortarEntrada);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, recortarEntrada(x)]));
  return v;
}

/** Texto que Claude Code se inyecta a sí mismo y que nadie escribió. */
function textoUsuario(t) {
  const texto = String(t);
  const comando = texto.match(/<command-name>([^<]*)<\/command-name>[\s\S]*?(?:<command-args>([\s\S]*?)<\/command-args>)?/);
  if (comando) {
    const args = texto.match(/<command-args>([\s\S]*?)<\/command-args>/);
    return plegarCadena(`${comando[1]}${args?.[1] ? ` ${args[1]}` : ''}`.trim());
  }
  const limpio = plegarCadena(texto.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim());
  if (!limpio) return null;
  if (/^(<local-command|<command-message|<task-notification|Caveat: |Base directory for this skill:|This session is being continued|\[Request interrupted by user)/.test(limpio)) return null;
  return limpio;
}

/** Separa de un mensaje las rutas de sus adjuntos: en pantalla se ve el nombre, no la ruta. */
function bloquesDeTexto(tipo, texto) {
  if (tipo !== 'user') return texto && texto.trim() ? [{ tipo: 'texto', texto }] : [];
  const limpio = textoUsuario(texto);
  if (!limpio) return [];
  const i = limpio.indexOf(MARCA_ADJUNTOS);
  if (i < 0) return [{ tipo: 'texto', texto: limpio }];
  const salida = [];
  const propio = limpio.slice(0, i).trim();
  if (propio) salida.push({ tipo: 'texto', texto: propio });
  for (const l of limpio.slice(i + MARCA_ADJUNTOS.length).split('\n')) {
    if (l.startsWith('- ')) salida.push({ tipo: 'adjunto', nombre: path.basename(l.slice(2).trim()) });
  }
  return salida;
}

function aplanarResultado(c) {
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return '';
  return c.map((b) => (b?.type === 'text' ? b.text : b?.type === 'image' ? '[imagen]' : '')).join('\n');
}

export function normalizar(tipo, message) {
  const contenido = message?.content;
  const bloques = [];
  const lista = typeof contenido === 'string' ? [{ type: 'text', text: contenido }] : Array.isArray(contenido) ? contenido : [];
  for (const b of lista) {
    if (b.type === 'text') bloques.push(...bloquesDeTexto(tipo, b.text));
    else if (b.type === 'thinking' && b.thinking) bloques.push({ tipo: 'pensando', texto: recortar(b.thinking) });
    else if (b.type === 'tool_use') bloques.push({ tipo: 'herramienta', id: b.id, nombre: b.name, entrada: recortarEntrada(b.input) });
    else if (b.type === 'tool_result') bloques.push({ tipo: 'resultado', id: b.tool_use_id, error: !!b.is_error, texto: recortar(aplanarResultado(b.content)) });
    else if (b.type === 'image') bloques.push({ tipo: 'imagen' });
  }
  return bloques;
}

/* ─────────── Sesiones vivas ─────────── */

const vivas = new Map();

class Cola {
  constructor() { this.items = []; this.espera = null; this.fin = false; }
  poner(x) { if (this.espera) { const r = this.espera; this.espera = null; r({ value: x, done: false }); } else this.items.push(x); }
  cerrar() { this.fin = true; if (this.espera) { const r = this.espera; this.espera = null; r({ value: undefined, done: true }); } }
  [Symbol.asyncIterator]() { return this; }
  next() {
    if (this.items.length) return Promise.resolve({ value: this.items.shift(), done: false });
    if (this.fin) return Promise.resolve({ value: undefined, done: true });
    return new Promise((r) => { this.espera = r; });
  }
}

class SesionViva {
  constructor({ id, proyecto, cwd, modelo, modo, retomar, proyectosTodos, tituloInicial }) {
    Object.assign(this, { id, proyecto, cwd, modelo, modo: modo || MODO_DEFECTO, retomar, tituloInicial });
    this.eventos = []; this.seq = 0; this.clientes = new Set(); this.solicitudes = new Map();
    this.tareas = new Set(); this.enCola = []; this.estado = 'iniciando'; this.noVisto = false; this.actividad = Date.now();
    this.cola = new Cola(); this.comandos = []; this.modelos = []; this.error = null; this.terminada = false;
    this.q = query({ prompt: this.cola, options: this.opciones(proyectosTodos) });
    this.leer();
  }

  opciones(proyectosTodos) {
    const { cwd, proyecto, modelo, modo, retomar, id } = this;
    const adjuntos = carpetaAdjuntos(proyecto.id, DATOS);
    fs.mkdirSync(adjuntos, { recursive: true, mode: 0o700 });
    this.aislada = proyecto.aislado === true || leerAisladas().has(id);
    const opciones = {
      cwd,
      env: entornoLimpio(),
      pathToClaudeCodeExecutable: CLAUDE,
      settingSources: ['user', 'project', 'local'],
      permissionMode: modo,
      allowDangerouslySkipPermissions: true,
      includePartialMessages: true,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: instruccionProyecto({ nombre: proyecto.nombre, ruta: proyecto.ruta, cwd }) },
      canUseTool: (herramienta, entrada, ctx) => this.preguntar(herramienta, entrada, ctx),
    };
    if (this.aislada) opciones.settings = ajustesDeSesion({ cwd, raizProyecto: proyecto.ruta, proyectos: proyectosTodos, sandbox: true, adjuntos, datos: DATOS });
    if (cwd !== proyecto.ruta) opciones.additionalDirectories = [proyecto.ruta];
    if (modelo) opciones.model = modelo;
    if (retomar) opciones.resume = id; else opciones.sessionId = id;
    return opciones;
  }

  emitir(ev, guardar = true) {
    const e = { ...ev, seq: ++this.seq, en: Date.now() };
    if (guardar) {
      this.eventos.push(e);
      if (this.eventos.length > MAX_EVENTOS) this.eventos.splice(0, this.eventos.length - MAX_EVENTOS);
    }
    const linea = `id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`;
    for (const c of this.clientes) c.write(linea);
  }

  cambiarEstado(estado) {
    if (estado === this.estado) return;
    this.estado = estado;
    this.emitir({ tipo: 'estado', estado });
  }

  preguntar(herramienta, entrada, { signal, toolUseID } = {}) {
    return new Promise((resolver) => {
      const solicitudId = crypto.randomUUID();
      const quitar = () => { this.solicitudes.delete(solicitudId); this.emitir({ tipo: 'solicitud_fin', solicitudId }); };
      this.solicitudes.set(solicitudId, { herramienta, entrada, resolver: (r) => { quitar(); resolver(r); } });
      signal?.addEventListener('abort', () => { if (this.solicitudes.has(solicitudId)) { quitar(); resolver({ behavior: 'deny', message: 'Cancelado', interrupt: true }); } });
      this.noVisto = true;
      this.emitir({ tipo: 'solicitud', solicitudId, herramienta, entrada: recortarEntrada(entrada), usoId: toolUseID });
      this.cambiarEstado('espera');
    });
  }

  responder(solicitudId, { permitir, respuestas, mensaje }) {
    const s = this.solicitudes.get(solicitudId);
    if (!s) throw new ErrorApi(404, 'Esa pregunta ya no está pendiente.');
    if (!permitir) return s.resolver({ behavior: 'deny', message: mensaje || 'Rechazado por el usuario.' });
    const updatedInput = respuestas ? { ...s.entrada, answers: respuestas } : s.entrada;
    s.resolver({ behavior: 'allow', updatedInput });
  }

  enviar({ texto, imagenes = [], adjuntos = [] }) {
    const contenido = [];
    for (const i of imagenes) contenido.push({ type: 'image', source: { type: 'base64', media_type: i.tipo, data: i.datos } });
    const rutas = validarAdjuntos(this.proyecto, adjuntos);
    const nombres = (this.comandos?.length ? this.comandos : comandosGlobales).map((c) => c.name);
    const completo = [expandirCadena(texto, nombres), rutas.length ? `${MARCA_ADJUNTOS}\n${rutas.map((r) => `- ${r}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
    if (completo) contenido.push({ type: 'text', text: completo });
    const uuid = crypto.randomUUID();
    this.actividad = Date.now();
    const mensaje = { tipo: 'mensaje', uuid, rol: 'user', bloques: normalizar('user', { content: contenido }), propio: true };
    // Con Claude ocupado, el mensaje aún no es parte de la conversación: la toma en el siguiente punto de
    // parada (ver soltarCola). Si se pinta ya, queda encima de lo que falta del turno y al recargar se mueve.
    if (this.estado === 'trabajando' || this.estado === 'espera') {
      this.enCola.push(mensaje);
      this.emitir({ tipo: 'cola', uuid, bloques: mensaje.bloques });
    } else this.emitir(mensaje);
    this.cambiarEstado('trabajando');
    this.cola.poner({ type: 'user', uuid, session_id: this.id, parent_tool_use_id: null, message: { role: 'user', content: contenido } });
  }

  /**
   * Claude toma lo que esté en cola al llegar un resultado de herramienta o al acabar el turno, y el archivo lo
   * guarda ahí mismo (medido el 2026-11-05: enviado a los 5,5 s, tomado a los 15,0 s tras el resultado). El
   * directo no avisa de ese momento: por eso se suelta aquí, y así los dos órdenes coinciden.
   */
  soltarCola() {
    const habia = this.enCola.length > 0;
    for (const m of this.enCola.splice(0)) this.emitir(m);
    return habia;
  }

  async leer() {
    try {
      for await (const m of this.q) this.manejar(m);
      this.terminar();
    } catch (e) {
      this.terminar(String(e?.message || e));
    }
  }

  manejar(m) {
    this.actividad = Date.now();
    if (m.type === 'stream_event') {
      const d = m.event;
      if (!m.parent_tool_use_id && d?.type === 'content_block_delta' && d.delta?.type === 'text_delta') this.emitir({ tipo: 'delta', texto: d.delta.text }, false);
      return;
    }
    if (m.type === 'assistant' || m.type === 'user') {
      if (m.isReplay) return;
      // El archivo de la sesión ya existe con la primera respuesta: antes no hay qué renombrar.
      if (m.type === 'assistant' && this.tituloInicial) {
        const titulo = this.tituloInicial;
        this.tituloInicial = null;
        renameSession(this.id, titulo, { dir: this.cwd }).then(() => this.emitir({ tipo: 'titulo', titulo })).catch((e) => console.error('[espacio] sin título', e?.message));
      }
      const bloques = normalizar(m.type, m.message);
      if (bloques.length) this.emitir({ tipo: 'mensaje', uuid: m.uuid, rol: m.type, bloques, padre: m.parent_tool_use_id || null });
      // Lo de un subagente no es un punto de parada de la conversación principal.
      if (m.type === 'user' && !m.parent_tool_use_id && Array.isArray(m.message?.content) && m.message.content.some((b) => b.type === 'tool_result')) this.soltarCola();
      return;
    }
    if (m.type === 'result') {
      const detenida = this.detenida === true;
      this.detenida = false;
      // Lo que paraste tú no hay que avisártelo.
      this.noVisto = this.clientes.size === 0 && !detenida;
      this.emitir({
        tipo: 'fin', detenida, ok: m.subtype === 'success' && !m.is_error, duracion: m.duration_ms,
        error: m.subtype === 'success' ? null : (m.errors || []).join(' ') || m.subtype,
        tokens: m.usage ? (m.usage.input_tokens || 0) + (m.usage.cache_read_input_tokens || 0) + (m.usage.cache_creation_input_tokens || 0) : null,
      });
      // Si había algo en cola, Claude sigue: empieza otro turno.
      if (!this.soltarCola() && !this.solicitudes.size) this.cambiarEstado('libre');
      return;
    }
    if (m.type === 'system') {
      if (m.subtype === 'init') {
        // ⚠️ Si al retomar llega otro id, es otra conversación: se para aquí en vez de seguir sin contexto.
        if (m.session_id !== this.id) {
          this.emitir({ tipo: 'error', texto: 'Claude Code abrió otra sesión en vez de retomar esta. Se detuvo para no perder el contexto.' });
          this.q.close();
          return;
        }
        this.modelo = m.model; this.modo = m.permissionMode;
        this.emitir({ tipo: 'inicio', modelo: m.model, modo: m.permissionMode, cwd: m.cwd, origenClave: m.apiKeySource });
        if (m.apiKeySource && m.apiKeySource !== 'none') this.emitir({ tipo: 'error', texto: `Esta sesión se está cobrando por API (${m.apiKeySource}), no por la suscripción.` });
        this.cargarListas();
      } else if (m.subtype === 'session_state_changed') {
        if (m.state === 'running') this.cambiarEstado('trabajando');
        else if (m.state === 'requires_action') this.cambiarEstado('espera');
        else if (!this.solicitudes.size) this.cambiarEstado('libre');
      } else if (m.subtype === 'task_started' || m.subtype === 'task_notification') {
        // Un subagente o un comando en segundo plano sigue vivo aunque el turno ya haya terminado.
        const clave = m.task_id || m.tool_use_id;
        if (m.subtype === 'task_started') this.tareas.add(clave); else this.tareas.delete(clave);
        this.emitir({ tipo: 'tareas', activas: this.tareas.size });
      } else if (m.subtype === 'compact_boundary') {
        this.emitir({ tipo: 'aviso', texto: 'Conversación compactada' });
      }
    }
  }

  async cargarListas() {
    try {
      [this.comandos, this.modelos] = await Promise.all([this.q.supportedCommands(), this.q.supportedModels()]);
      comandosGlobales = this.comandos; modelosGlobales = this.modelos;
      this.emitir({ tipo: 'listas' });
    } catch { /* el selector se queda con lo último conocido */ }
  }

  terminar(error) {
    if (this.terminada) return;
    this.terminada = true;
    this.soltarCola();
    for (const s of [...this.solicitudes.values()]) s.resolver({ behavior: 'deny', message: 'La sesión se cerró.' });
    if (error) {
      this.error = error;
      this.emitir({ tipo: 'error', texto: `La sesión se detuvo: ${error}` });
    }
    this.estado = 'cerrada';
    this.emitir({ tipo: 'estado', estado: 'cerrada' });
    for (const c of this.clientes) c.end();
    this.clientes.clear();
    if (vivas.get(this.id) === this) vivas.delete(this.id);
    if (error) ultimosErrores.set(this.id, error);
  }

  cerrar() {
    this.cola.cerrar();
    this.q.close();
    this.terminar();
  }
}

/** Una ruta que venga de fuera solo vale si es un adjunto de este mismo proyecto. */
function validarAdjuntos(proyecto, rutas) {
  const carpeta = carpetaAdjuntos(proyecto.id, DATOS);
  return (Array.isArray(rutas) ? rutas : []).map((r) => {
    let real;
    try { real = fs.realpathSync(String(r)); } catch { throw new ErrorApi(400, 'Ese adjunto ya no existe. Vuelve a adjuntarlo.'); }
    if (!real.startsWith(`${fs.realpathSync(carpeta)}${path.sep}`)) throw new ErrorApi(400, 'Ese adjunto no es de este proyecto.');
    return real;
  });
}

function limpiarNombre(nombre) {
  const base = path.basename(String(nombre || '')).replace(/[\x00-\x1f\x7f/\\]/g, ' ').trim().slice(0, 180);
  return !base || base === '.' || base === '..' ? 'archivo' : base;
}

/** Va en crudo y por partes: un archivo de 100 MB no cabe en un JSON en memoria. */
async function subirAdjunto(req, proyectoId, nombre) {
  const proyecto = await proyectoPorId(proyectoId);
  if (Number(req.headers['content-length'] || 0) > MAX_ADJUNTO) throw new ErrorApi(413, 'El archivo pasa de 100 MB.');
  const dir = path.join(carpetaAdjuntos(proyecto.id, DATOS), crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const ruta = path.join(dir, limpiarNombre(nombre));
  let total = 0;
  try {
    await pipeline(req, async function* (origen) {
      for await (const trozo of origen) {
        total += trozo.length;
        if (total > MAX_ADJUNTO) throw new ErrorApi(413, 'El archivo pasa de 100 MB.');
        yield trozo;
      }
    }, fs.createWriteStream(ruta, { mode: 0o600 }));
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  return { ruta, nombre: path.basename(ruta), tamano: total };
}

/** Los adjuntos no son el proyecto: pasado un mes dejan de ocupar disco. */
function purgarAdjuntos() {
  const raiz = path.join(DATOS, 'adjuntos');
  let proyectos = [];
  try { proyectos = fs.readdirSync(raiz); } catch { return; }
  const limite = Date.now() - DIAS_ADJUNTOS * 86400_000;
  for (const p of proyectos) {
    let carpetas = [];
    try { carpetas = fs.readdirSync(path.join(raiz, p)); } catch { continue; }
    for (const c of carpetas) {
      const d = path.join(raiz, p, c);
      try { if (fs.statSync(d).mtimeMs < limite) fs.rmSync(d, { recursive: true, force: true }); } catch { /* otra vuelta */ }
    }
  }
}

let comandosGlobales = [];
let modelosGlobales = [];
const ultimosErrores = new Map();

/** Las sesiones del propio servicio también se apuntan ahí, pero con otro `entrypoint`. */
const esTerminal = (d) => d.kind === 'interactive' && d.entrypoint === 'cli';

function abiertaEnTerminal(id) {
  const dir = path.join(os.homedir(), '.claude/sessions');
  let archivos = [];
  try { archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return null; }
  for (const f of archivos) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (d.sessionId !== id || !esTerminal(d)) continue;
      process.kill(d.pid, 0);
      return { pid: d.pid, estado: d.status };
    } catch { /* proceso muerto o archivo a medio escribir */ }
  }
  return null;
}

/** Las abiertas en una terminal, con lo que están haciendo: busy, shell, waiting o idle. */
function sesionesEnTerminal() {
  const dir = path.join(os.homedir(), '.claude/sessions');
  const ids = new Map();
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (!esTerminal(d)) continue;
        process.kill(d.pid, 0);
        ids.set(d.sessionId, d.status || null);
      } catch { /* muerto */ }
    }
  } catch { /* sin carpeta */ }
  return ids;
}

async function proyectoPorId(id) {
  const p = (await proyectos()).find((x) => x.id === id);
  if (!p) throw new ErrorApi(404, 'Ese proyecto no está registrado.');
  if (!fs.existsSync(p.ruta)) throw new ErrorApi(409, `La carpeta del proyecto ya no existe: ${p.ruta}`);
  return p;
}

const resumenViva = (s) => ({ id: s.id, proyecto: s.proyecto.id, estado: s.estado, noVisto: s.noVisto, modelo: s.modelo, modo: s.modo, preguntas: s.solicitudes.size, aislada: s.aislada, tareas: s.tareas.size });

/** La carpeta donde está guardada una sesión. Se usa la suya, no se adivina. */
async function ubicar(proyecto, id) {
  for (const dir of [proyecto.ruta, ...(proyecto.subcarpetas || [])]) {
    const info = await getSessionInfo(id, { dir }).catch(() => undefined);
    if (info) return { dir, info };
  }
  return null;
}

async function asegurarViva(id, proyectoId, { forzar = false, modelo, modo } = {}) {
  const existente = vivas.get(id);
  if (existente) return existente;
  const proyecto = await proyectoPorId(proyectoId);
  const donde = await ubicar(proyecto, id);
  if (!donde) throw new ErrorApi(404, 'No encuentro esa sesión en los archivos de Claude Code de este proyecto.');
  if (!forzar && abiertaEnTerminal(id)) throw new ErrorApi(409, 'Esta sesión está abierta en una terminal. Si escribes aquí también, las dos partes dejarán de ver lo que hace la otra.', 'abierta_en_terminal');
  const s = new SesionViva({ id, proyecto, cwd: donde.dir, modelo, modo, retomar: true, proyectosTodos: await proyectos() });
  vivas.set(id, s);
  return s;
}

/* Las inactivas dejan de ocupar memoria; al escribir de nuevo se retoman con el mismo id. */
setInterval(() => {
  for (const s of vivas.values()) {
    if (s.estado === 'libre' && !s.tareas.size && !s.clientes.size && Date.now() - s.actividad > INACTIVA_MS) s.cerrar();
  }
}, 60_000).unref();

/** Comandos y modelos antes de abrir la primera sesión. Sin mensaje no hay llamada al modelo. */
async function precargarListas() {
  const cola = new Cola();
  const q = query({ prompt: cola, options: { cwd: os.homedir(), env: entornoLimpio(), pathToClaudeCodeExecutable: CLAUDE, settingSources: ['user'], persistSession: false } });
  try {
    [comandosGlobales, modelosGlobales] = await Promise.all([q.supportedCommands(), q.supportedModels()]);
  } catch (e) {
    console.error('[espacio] no se pudieron precargar los comandos', e?.message);
  } finally {
    cola.cerrar();
    q.close();
  }
}

/* ─────────── Acceso ─────────── */

const scrypt = (clave, sal) => crypto.scryptSync(clave, sal, 64, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }).toString('hex');
const intentos = { n: 0, desde: 0 };

function comprobarClave(clave) {
  const guardada = leerJson('clave.json', null);
  if (!guardada) throw new ErrorApi(409, 'Aún no hay contraseña.');
  if (Date.now() - intentos.desde > 15 * 60_000) { intentos.n = 0; intentos.desde = Date.now(); }
  if (intentos.n >= 5) throw new ErrorApi(429, 'Demasiados intentos. Espera 15 minutos.');
  const ok = crypto.timingSafeEqual(Buffer.from(scrypt(String(clave), guardada.sal), 'hex'), Buffer.from(guardada.hash, 'hex'));
  if (!ok) { intentos.n++; throw new ErrorApi(401, 'Contraseña incorrecta.'); }
  intentos.n = 0;
}

function fijarClave(clave) {
  if (typeof clave !== 'string' || clave.length < 10) throw new ErrorApi(400, 'La contraseña debe tener al menos 10 caracteres.');
  const sal = crypto.randomBytes(16).toString('hex');
  guardarJson('clave.json', { sal, hash: scrypt(clave, sal) });
}

/* ─────────── API ─────────── */

const rutas = [];
const ruta = (metodo, patron, fn) => {
  const nombres = [];
  const re = new RegExp(`^${patron.replace(/:(\w+)/g, (_, n) => { nombres.push(n); return '([^/]+)'; })}$`);
  rutas.push({ metodo, re, nombres, fn });
};

ruta('GET', '/estado', async () => ({ ok: true, version: 1, claveConfigurada: !!leerJson('clave.json', null) }));
ruta('POST', '/acceso/crear', async ({ cuerpo }) => {
  if (leerJson('clave.json', null)) throw new ErrorApi(409, 'La contraseña ya existe.');
  fijarClave(cuerpo.clave);
  return { ok: true };
});
ruta('POST', '/acceso/entrar', async ({ cuerpo }) => { comprobarClave(cuerpo.clave); return { ok: true }; });

const servidores = crearServidores({ proyectos });
ruta('GET', '/servidores', () => servidores.leer());

ruta('GET', '/proyectos', async () => ({ proyectos: await proyectos() }));
ruta('GET', '/proyectos/detectados', async () => {
  const ya = new Set((await proyectos()).map((p) => p.ruta));
  return { detectados: (await detectar()).filter((d) => !ya.has(d.ruta)).map((d) => ({ ruta: d.ruta, nombre: path.basename(d.ruta), grupo: clienteDe(d.ruta), subcarpetas: [...d.subcarpetas] })) };
});
ruta('POST', '/proyectos', async ({ cuerpo }) => {
  const real = validarRuta(cuerpo.ruta);
  const lista = await proyectos();
  if (lista.some((p) => p.ruta === real)) throw new ErrorApi(409, 'Ese proyecto ya está registrado.');
  const p = crearProyecto(real, cuerpo);
  guardarJson('proyectos.json', [...lista, p]);
  return { proyecto: p };
});
ruta('PATCH', '/proyectos/:id', async ({ p, cuerpo }) => {
  const lista = await proyectos();
  const i = lista.findIndex((x) => x.id === p.id);
  if (i < 0) throw new ErrorApi(404, 'Ese proyecto no está registrado.');
  const cambios = {};
  if (typeof cuerpo.nombre === 'string' && cuerpo.nombre.trim()) cambios.nombre = cuerpo.nombre.trim();
  if (typeof cuerpo.grupo === 'string' && cuerpo.grupo.trim()) cambios.grupo = cuerpo.grupo.trim();
  if (typeof cuerpo.aislado === 'boolean') cambios.aislado = cuerpo.aislado;
  lista[i] = { ...lista[i], ...cambios };
  guardarJson('proyectos.json', lista);
  return { proyecto: lista[i] };
});
/** Solo lo quita de la lista: ni la carpeta ni sus sesiones se tocan. */
ruta('DELETE', '/proyectos/:id', async ({ p }) => {
  guardarJson('proyectos.json', (await proyectos()).filter((x) => x.id !== p.id));
  return { ok: true };
});

const archivoSesion = (dir, id) => path.join(os.homedir(), '.claude/projects', dir.normalize('NFC').replace(/[^a-zA-Z0-9]/g, '-'), `${id}.jsonl`);

async function sesionesDe(proyecto, terminal) {
  const todas = [];
  for (const dir of [proyecto.ruta, ...(proyecto.subcarpetas || [])]) {
    const l = await listSessions({ dir, limit: 60, includeWorktrees: false }).catch(() => []);
    for (const s of l) todas.push({
      id: s.sessionId, proyecto: proyecto.id, titulo: s.customTitle || s.summary || s.firstPrompt || 'Sesión sin título',
      actualizada: ultimaInteraccion(archivoSesion(dir, s.sessionId)) ?? s.lastModified, rama: s.gitBranch || null, carpeta: dir === proyecto.ruta ? null : path.relative(proyecto.ruta, dir),
      enTerminal: terminal.has(s.sessionId), estadoTerminal: terminal.get(s.sessionId) || null, error: ultimosErrores.get(s.sessionId) || null,
      viva: vivas.has(s.sessionId) ? resumenViva(vivas.get(s.sessionId)) : null,
    });
  }
  return [...new Map(todas.map((s) => [s.id, s])).values()].sort((a, b) => b.actualizada - a.actualizada);
}

ruta('GET', '/proyectos/:id/sesiones', async ({ p }) => {
  const proyecto = (await proyectos()).find((x) => x.id === p.id);
  if (!proyecto) throw new ErrorApi(404, 'Ese proyecto no está registrado.');
  return { sesiones: await sesionesDe(proyecto, sesionesEnTerminal()) };
});

ruta('GET', '/sesiones/activas', async () => {
  const terminal = sesionesEnTerminal();
  const filas = (await Promise.all((await proyectos()).map((p) => sesionesDe(p, terminal)))).flat();
  return { sesiones: sesionesActivas(filas, [...vivas.values()].map(resumenViva), Date.now(), leerJson('sesiones-cerradas.json', {})) };
});

/* Lo escrito y no enviado vive aquí y no en el navegador: así se ve igual en la Mac y en el teléfono. */
ruta('GET', '/borradores', async () => ({ borradores: leerJson('borradores.json', {}) }));
ruta('POST', '/borradores', async ({ cuerpo }) => {
  const clave = String(cuerpo.clave || '');
  if (!/^[\w-]{1,80}$/.test(clave)) throw new ErrorApi(400, 'Clave inválida.');
  const todos = leerJson('borradores.json', {});
  const texto = String(cuerpo.texto || '');
  if (texto.trim()) todos[clave] = texto.slice(0, 200000); else delete todos[clave];
  guardarJson('borradores.json', todos);
  return { ok: true };
});

ruta('GET', '/vivas', async () => ({ vivas: [...vivas.values()].map(resumenViva) }));
ruta('GET', '/listas', async ({ url }) => {
  const s = vivas.get(url.searchParams.get('sesion'));
  return { comandos: comandosUtiles(s?.comandos?.length ? s.comandos : comandosGlobales), modelos: s?.modelos?.length ? s.modelos : modelosGlobales };
});

ruta('POST', '/sesiones', async ({ cuerpo }) => {
  const proyecto = await proyectoPorId(cuerpo.proyecto);
  const id = crypto.randomUUID();
  if (cuerpo.aislada === true) marcarAislada(id, true);
  const s = new SesionViva({ id, proyecto, cwd: proyecto.ruta, modelo: cuerpo.modelo, modo: cuerpo.modo, retomar: false, proyectosTodos: await proyectos() });
  vivas.set(id, s);
  if (cuerpo.texto || cuerpo.imagenes?.length) s.enviar(cuerpo);
  return { id };
});

ruta('GET', '/sesiones/:id/mensajes', async ({ p, url }) => {
  const proyecto = await proyectoPorId(url.searchParams.get('proyecto'));
  const donde = await ubicar(proyecto, p.id);
  const viva = vivas.get(p.id);
  if (!donde && !viva) throw new ErrorApi(404, 'No encuentro esa sesión en los archivos de Claude Code de este proyecto.');
  const crudos = donde ? await getSessionMessages(p.id, { dir: donde.dir }) : [];
  const filas = crudos
    .map((m) => ({ uuid: m.uuid, rol: m.type, padre: m.parent_tool_use_id || null, bloques: normalizar(m.type, m.message) }))
    .filter((m) => m.bloques.length && !m.padre);
  const antes = Number(url.searchParams.get('antes') || filas.length);
  const desde = Math.max(0, antes - PAGINA_MENSAJES);
  // Al reabrir, el directo repite todo lo emitido por este proceso. Lo que el archivo ya tiene, aunque esté fuera
  // de esta página, no debe añadirse al final: el cliente ignora los mensajes hasta este número.
  const enArchivo = new Set(filas.map((m) => m.uuid));
  const corte = viva?.eventos.findLast((e) => e.tipo === 'mensaje' && !e.padre && enArchivo.has(e.uuid))?.seq ?? 0;
  return {
    mensajes: filas.slice(desde, antes), hayAnteriores: desde > 0, inicio: desde,
    titulo: donde?.info?.customTitle || donde?.info?.summary || null,
    carpeta: donde?.dir || viva?.cwd, enTerminal: !!abiertaEnTerminal(p.id), aislada: proyecto.aislado === true || leerAisladas().has(p.id),
    viva: viva ? { ...resumenViva(viva), solicitudes: [...viva.solicitudes].map(([solicitudId, s]) => ({ solicitudId, herramienta: s.herramienta, entrada: recortarEntrada(s.entrada) })) } : null,
    ultimoSeq: viva?.seq ?? 0, corte,
    error: ultimosErrores.get(p.id) || null,
  };
});

ruta('POST', '/sesiones/:id/enviar', async ({ p, cuerpo }) => {
  const s = await asegurarViva(p.id, cuerpo.proyecto, { forzar: !!cuerpo.forzar, modelo: cuerpo.modelo, modo: cuerpo.modo });
  ultimosErrores.delete(p.id);
  s.enviar(cuerpo);
  return { ok: true };
});
const viva = (id) => { const s = vivas.get(id); if (!s) throw new ErrorApi(409, 'La sesión no está en marcha.'); return s; };
/** Para lo que esté haciendo, incluidas las tareas en segundo plano. La conversación sigue donde estaba. */
ruta('POST', '/sesiones/:id/detener', async ({ p }) => {
  const s = viva(p.id);
  if (s.estado === 'trabajando' || s.estado === 'espera') { s.detenida = true; await s.q.interrupt(); }
  await Promise.all([...s.tareas].map((t) => s.q.stopTask(t).catch(() => {})));
  return { ok: true };
});
ruta('POST', '/sesiones/:id/responder', async ({ p, cuerpo }) => { viva(p.id).responder(cuerpo.solicitudId, cuerpo); return { ok: true }; });
ruta('POST', '/sesiones/:id/ajustes', async ({ p, cuerpo }) => {
  const s = vivas.get(p.id);
  if (!s) return { ok: true, aplicado: false };
  if (cuerpo.modelo) { await s.q.setModel(cuerpo.modelo); s.modelo = cuerpo.modelo; }
  if (cuerpo.modo) { await s.q.setPermissionMode(cuerpo.modo); s.modo = cuerpo.modo; }
  s.emitir({ tipo: 'ajustes', modelo: s.modelo, modo: s.modo });
  return { ok: true, aplicado: true };
});
/** Cierra el proceso para que al escribir de nuevo se retome ya con el acceso completo. */
ruta('POST', '/sesiones/:id/sin-aislamiento', async ({ p }) => {
  marcarAislada(p.id, false);
  const s = vivas.get(p.id);
  if (s && s.estado === 'trabajando') throw new ErrorApi(409, 'La sesión está trabajando. Deténla antes.');
  s?.cerrar();
  return { ok: true };
});
ruta('POST', '/sesiones/:id/visto', async ({ p }) => { const s = vivas.get(p.id); if (s) s.noVisto = false; return { ok: true }; });
ruta('POST', '/sesiones/:id/cerrar', async ({ p }) => { vivas.get(p.id)?.cerrar(); return { ok: true }; });
/** Deja de estar activa: se apaga su proceso y sale del panel. La conversación no se toca. */
ruta('POST', '/sesiones/:id/desactivar', async ({ p }) => {
  const s = vivas.get(p.id);
  if ((s && (s.estado === 'trabajando' || s.estado === 'iniciando' || s.tareas.size)) || sesionesEnTerminal().get(p.id) === 'busy') throw new ErrorApi(409, 'La sesión está trabajando. Deténla antes.');
  s?.cerrar();
  guardarJson('sesiones-cerradas.json', { ...leerJson('sesiones-cerradas.json', {}), [p.id]: Date.now() });
  return { ok: true };
});
ruta('POST', '/sesiones/:id/titulo', async ({ p, cuerpo }) => {
  const proyecto = await proyectoPorId(cuerpo.proyecto);
  const donde = await ubicar(proyecto, p.id);
  if (!donde) throw new ErrorApi(404, 'No encuentro esa sesión.');
  await renameSession(p.id, String(cuerpo.titulo || '').slice(0, 200), { dir: donde.dir });
  return { ok: true };
});
/** Misma sesión en una terminal. Antes se cierra aquí: dos procesos sobre una sesión se pisan. */
ruta('POST', '/sesiones/:id/terminal', async ({ p, cuerpo }) => {
  const proyecto = await proyectoPorId(cuerpo.proyecto);
  const donde = await ubicar(proyecto, p.id);
  if (!donde) throw new ErrorApi(404, 'No encuentro esa sesión.');
  const s = vivas.get(p.id);
  if (s && s.estado === 'trabajando') throw new ErrorApi(409, 'La sesión está trabajando. Deténla antes de pasarla a la terminal.');
  s?.cerrar();
  const comando = `cd ${JSON.stringify(donde.dir)} && claude --resume ${p.id}`;
  if (cuerpo.abrir) {
    const guion = `tell application "Terminal"\nactivate\ndo script ${JSON.stringify(comando)}\nend tell`;
    await new Promise((ok, mal) => execFile('osascript', ['-e', guion], (e) => (e ? mal(new ErrorApi(500, 'macOS no dejó abrir la Terminal. Copia el comando.')) : ok())));
  }
  return { comando };
});

/* ─────────── Videos de Generación de Contenido ─────────── */

const RAIZ_EDICION = raizEdicion();

/** Todas las sesiones de video viven aquí, cada una con su carpeta dentro. Aparece solo la primera vez. */
async function proyectoEdicion() {
  fs.mkdirSync(RAIZ_EDICION, { recursive: true });
  const real = fs.realpathSync(RAIZ_EDICION);
  const lista = await proyectos();
  const existente = lista.find((p) => p.ruta === real);
  if (existente) return existente;
  const p = crearProyecto(real, { nombre: 'Edición de video', grupo: 'Fernando González' });
  guardarJson('proyectos.json', [...lista, p]);
  return p;
}

ruta('GET', '/edicion', async () => ({ proyecto: await proyectoEdicion() }));
ruta('GET', '/videos/:carpeta/estado', async ({ p, url }) => estadoSubida(carpetaDe(RAIZ_EDICION, p.carpeta), url.searchParams.get('nombre')));
/** Deja el video completo en su carpeta y abre su sesión. La idea va en un archivo: un guion no cabe en un mensaje legible. */
ruta('POST', '/videos/:carpeta/iniciar', async ({ p, cuerpo }) => {
  const dir = carpetaDe(RAIZ_EDICION, p.carpeta);
  const video = terminarSubida(dir, cuerpo.nombre, cuerpo.tamano);
  fs.writeFileSync(path.join(dir, 'idea.md'), String(cuerpo.contexto || ''), { mode: 0o600 });
  const proyecto = await proyectoEdicion();
  const id = crypto.randomUUID();
  const s = new SesionViva({ id, proyecto, cwd: proyecto.ruta, retomar: false, proyectosTodos: await proyectos(), tituloInicial: String(cuerpo.titulo || '').slice(0, 200) || null });
  vivas.set(id, s);
  s.enviar({ texto: primerMensaje({ ruta: video, carpeta: p.carpeta, tema: String(cuerpo.tema || '') }) });
  return { id, proyecto: proyecto.id };
});
/** Borra la carpeta del video. El proyecto de CapCut y la conversación no se tocan. */
ruta('DELETE', '/videos/:carpeta', async ({ p, cuerpo }) => {
  const dir = carpetaDe(RAIZ_EDICION, p.carpeta);
  const s = cuerpo.sesion ? vivas.get(cuerpo.sesion) : null;
  if (s && (s.estado === 'trabajando' || s.estado === 'iniciando' || s.tareas.size)) throw new ErrorApi(409, 'La sesión de este video está trabajando. Deténla antes.');
  s?.cerrar();
  fs.rmSync(dir, { recursive: true, force: true });
  return { ok: true };
});

ruta('GET', '/incidencias/estado', async () => leerJson('incidencias.json', { conversaciones: {}, contactos: {} }));
ruta('POST', '/incidencias/estado', async ({ cuerpo }) => {
  const d = leerJson('incidencias.json', { conversaciones: {}, contactos: {} });
  if (cuerpo.conversacion) d.conversaciones[cuerpo.conversacion] = { ...cuerpo.datos, en: Date.now() };
  if (cuerpo.contacto && cuerpo.proyecto) d.contactos[cuerpo.contacto] = cuerpo.proyecto;
  guardarJson('incidencias.json', d);
  return d;
});

function sse(req, res, s, desde) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(': conectado\n\n');
  for (const e of s.eventos) if (e.seq > desde) res.write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
  s.clientes.add(res);
  s.noVisto = false;
  const latido = setInterval(() => res.write(': latido\n\n'), 20_000);
  req.on('close', () => { clearInterval(latido); s.clientes.delete(res); });
}

async function leerCuerpo(req) {
  const trozos = [];
  let total = 0;
  for await (const t of req) {
    total += t.length;
    if (total > 60 * 1024 * 1024) throw new ErrorApi(413, 'Demasiado grande.');
    trozos.push(t);
  }
  if (!total) return {};
  try { return JSON.parse(Buffer.concat(trozos).toString('utf8')); } catch { throw new ErrorApi(400, 'JSON inválido.'); }
}

/**
 * Un guion largo tarda minutos y sin cabeceras `fetch` se rinde a los 5 (ya tumbó las imágenes del
 * carrusel). Por eso se responde de inmediato y se mantiene viva la conexión con espacios, que el
 * JSON de la respuesta ignora.
 */
async function generarConLatido(req, res) {
  const { system, user } = await leerCuerpo(req);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  const latido = setInterval(() => res.write(' '), 15_000);
  let salida;
  try {
    const datos = await generarJson({ query, system: String(system || ''), user: String(user || ''), opciones: { cwd: DATOS, env: entornoLimpio(), pathToClaudeCodeExecutable: CLAUDE } });
    salida = { datos };
  } catch (e) {
    salida = { error: String(e?.message || e) };
  }
  clearInterval(latido);
  res.end(JSON.stringify(salida));
}

function autorizado(req) {
  const a = Buffer.from(String(req.headers.authorization || ''));
  const b = Buffer.from(`Bearer ${TOKEN}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const servidor = http.createServer(async (req, res) => {
  const responder = (estado, cuerpo) => { res.writeHead(estado, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(cuerpo)); };
  try {
    if (!autorizado(req)) return responder(401, { error: 'No autorizado.' });
    const url = new URL(req.url, 'http://local');
    const eventos = url.pathname.match(/^\/sesiones\/([^/]+)\/eventos$/);
    if (eventos && req.method === 'GET') {
      const s = vivas.get(eventos[1]);
      if (!s) return responder(404, { error: 'La sesión no está en marcha.' });
      return sse(req, res, s, Number(url.searchParams.get('desde') || 0));
    }
    const subida = url.pathname.match(/^\/proyectos\/([^/]+)\/adjuntos$/);
    if (subida && req.method === 'POST') return responder(200, await subirAdjunto(req, subida[1], url.searchParams.get('nombre')));
    const parte = url.pathname.match(/^\/videos\/([^/]+)\/partes$/);
    if (parte && req.method === 'POST') return responder(200, await guardarParte(req, carpetaDe(RAIZ_EDICION, decodeURIComponent(parte[1])), url.searchParams.get('nombre'), url.searchParams.get('desde')));
    if (url.pathname === '/generar-json' && req.method === 'POST') return generarConLatido(req, res);
    for (const r of rutas) {
      if (r.metodo !== req.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      const p = Object.fromEntries(r.nombres.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      const cuerpo = req.method === 'GET' ? {} : await leerCuerpo(req);
      return responder(200, await r.fn({ p, cuerpo, url }));
    }
    responder(404, { error: 'No existe.' });
  } catch (e) {
    if (!(e instanceof ErrorApi) && !(e instanceof ErrorVideo)) console.error('[espacio]', e);
    if (!res.headersSent) responder(e.estado || 500, { error: e.message, codigo: e.codigo, recibido: e.recibido });
  }
});

if (process.env.ESPACIO_SIN_ARRANCAR !== '1') {
  servidor.listen(PUERTO, '127.0.0.1', () => console.log(`[espacio] servicio en 127.0.0.1:${PUERTO}`));
  precargarListas();
  purgarAdjuntos();
  setInterval(purgarAdjuntos, 86400_000).unref();
  // Con corriente, la Mac no se duerme mientras el servicio corre. Con batería, sí.
  spawn('caffeinate', ['-s', '-w', String(process.pid)], { stdio: 'ignore', detached: true }).unref();
  const apagar = () => { for (const s of vivas.values()) s.cerrar(); servidor.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', apagar);
  process.on('SIGINT', apagar);
}
