#!/usr/bin/env node
/**
 * SERVICIO DEL COPILOTO. Solo escucha en 127.0.0.1 y exige el token de ~/.gcc-copiloto/token. El widget
 * de la Mac y, por Tailscale, el de los teléfonos le envían audio y reciben eventos.
 *
 *   POST /audio?canal=mic|sistema   PCM 16 bits, 16 kHz, mono
 *   GET  /eventos                   flujo de eventos (SSE)
 *   GET  /estado · POST /activar · POST /desactivar · POST /terminar · POST /consulta {texto}
 *   GET  /sesiones · POST /sesiones/nueva · POST /sesiones/:id/{retomar|titulo|eliminar}   (las de Claude Code)
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Transcriptor } from './transcripcion.mjs';
import { SesionClaude } from './sesion-claude.mjs';
import { clasificar } from './clasificador.mjs';
import { ColaRecordatorios } from './recordatorio.mjs';
import { Sesion } from './sesion.mjs';
import { Motor } from './motor.mjs';
import { enviarPendiente } from './plataforma.mjs';

const DATOS = process.env.COPILOTO_DATOS || path.join(os.homedir(), '.gcc-copiloto');
const PUERTO = Number(process.env.COPILOTO_PUERTO || 3793);
fs.mkdirSync(DATOS, { recursive: true, mode: 0o700 });

const rutaToken = path.join(DATOS, 'token');
if (!fs.existsSync(rutaToken)) fs.writeFileSync(rutaToken, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const TOKEN = fs.readFileSync(rutaToken, 'utf8').trim();

const clientes = new Set();
function emitir(evento, datos) {
  const trozo = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const c of clientes) c.write(trozo);
}

const sesion = new Sesion(DATOS);
const recordatorios = new ColaRecordatorios(DATOS);
const transcriptor = new Transcriptor();
const agente = new SesionClaude({ alSesion: (d) => emitir('sesion', d) });

async function enviarTodo() {
  for (const ruta of sesion.pendientes()) {
    try {
      const r = await enviarPendiente(ruta);
      emitir('recordatorio', { id: r.reminderId, titulo: r.title, adjuntado: !!r.existente });
    } catch (e) {
      emitir('error', { mensaje: `No se pudo crear el recordatorio; se reintentará: ${e.message}` });
    }
  }
}

async function terminar() {
  motor.desactivar();
  agente.olvidar();
  const ruta = sesion.cerrar();
  emitir('terminada', { conTranscripcion: !!ruta });
  if (ruta) await enviarTodo();
}

const motor = new Motor({ transcriptor, agente, clasificar, recordatorios, sesion, emitir, terminar });
async function reintentarRecordatorios() {
  for (const id of recordatorios.pendientes()) {
    try {
      const r = await recordatorios.procesar(id);
      if (r) emitir('recordatorio', { id: r.reminderId, titulo: r.titulo });
    } catch (e) { console.error('recordatorio pendiente:', e.message); }
  }
}
const reintento = setInterval(() => { if (sesion.pendientes().length) enviarTodo(); reintentarRecordatorios(); }, 5 * 60 * 1000);
reintento.unref();
setTimeout(() => { if (sesion.pendientes().length) enviarTodo(); reintentarRecordatorios(); }, 5000).unref();

const leer = (req, tope) => new Promise((ok, mal) => {
  const partes = [];
  let total = 0;
  req.on('data', (d) => { total += d.length; if (total > tope) { mal(new Error('Demasiado grande.')); req.destroy(); return; } partes.push(d); });
  req.on('end', () => ok(Buffer.concat(partes)));
  req.on('error', mal);
});

const igual = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

const servidor = http.createServer(async (req, res) => {
  const responder = (cod, datos) => { res.writeHead(cod, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(datos)); };
  try {
    if (!igual(req.headers.authorization || '', `Bearer ${TOKEN}`)) return responder(401, { error: 'No autorizado.' });
    const url = new URL(req.url, 'http://x');
    const ruta = `${req.method} ${url.pathname}`;

    if (ruta === 'POST /audio') {
      const canal = url.searchParams.get('canal');
      if (canal !== 'mic' && canal !== 'sistema') return responder(400, { error: 'Canal inválido.' });
      motor.audio(canal, await leer(req, 2 * 1024 * 1024), url.searchParams.get('dispositivo') || 'mac');
      return responder(200, { ok: true });
    }
    if (ruta === 'GET /eventos') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`event: estado\ndata: ${JSON.stringify(motor.estado())}\n\n`);
      clientes.add(res);
      const latido = setInterval(() => res.write(': latido\n\n'), 20000);
      req.on('close', () => { clearInterval(latido); clientes.delete(res); });
      return undefined;
    }
    if (ruta === 'GET /estado') return responder(200, motor.estado());
    if (ruta === 'POST /activar') { motor.activar(url.searchParams.get('dispositivo') || 'mac'); return responder(200, motor.estado()); }
    if (ruta === 'POST /desactivar') { motor.desactivar(); return responder(200, motor.estado()); }
    if (ruta === 'POST /detener') { agente.parar(); return responder(200, { ok: true }); }
    if (ruta === 'POST /terminar') { await terminar(); return responder(200, motor.estado()); }
    if (ruta === 'POST /consulta') {
      const { texto } = JSON.parse((await leer(req, 20000)).toString() || '{}');
      if (!motor.activo) return responder(409, { error: 'Activa el copiloto primero.' });
      motor.consultaEscrita(texto);
      return responder(200, { ok: true });
    }
    if (ruta === 'GET /sesiones') return responder(200, { sesiones: await agente.lista() });
    if (ruta === 'POST /sesiones/nueva') { agente.olvidar(); emitir('sesion', { id: null }); return responder(200, { ok: true }); }
    const s = url.pathname.match(/^\/sesiones\/([0-9a-f-]{36})\/(retomar|titulo|eliminar)$/);
    if (s && req.method === 'POST') {
      const [, id, accion] = s;
      try {
        if (accion === 'retomar') {
          const pares = await agente.retomar(id);
          emitir('retomada', { id, pares });
          return responder(200, { ok: true, pares });
        }
        if (accion === 'titulo') {
          const { titulo } = JSON.parse((await leer(req, 4000)).toString() || '{}');
          await agente.renombrar(id, titulo);
        } else {
          const actual = id === agente.id;
          await agente.eliminar(id);
          if (actual) emitir('sesion', { id: null });
        }
        emitir('sesiones', {});
        return responder(200, { ok: true });
      } catch (e) { return responder(409, { error: e.message }); }
    }
    return responder(404, { error: 'No existe.' });
  } catch (e) {
    if (!res.headersSent) responder(500, { error: e.message });
    return undefined;
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => console.log(`Copiloto en 127.0.0.1:${PUERTO}`));

for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { transcriptor.detener(); agente.detener(); process.exit(0); });
