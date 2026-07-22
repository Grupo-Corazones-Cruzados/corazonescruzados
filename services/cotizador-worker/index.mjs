// Worker dedicado del Agente de Cotizaciones Software.
// Ejecuta el Claude Agent SDK (Opus 4.8), mantiene la sesion viva y la reanuda por sessionId.
// La app web le habla por HTTP + token compartido (x-worker-token), fail-closed.
//
// Endpoints:
//   GET  /health              -> { ok: true }
//   POST /generate  { model, context }                 -> { sessionId, payload }
//   POST /chat      { sessionId, model, message, context } -> { sessionId, reply, payload? }
//
// Env: PORT (4610), COTIZADOR_WORKER_TOKEN, ANTHROPIC_API_KEY, DATABASE_URL, COTIZADOR_MODEL.
//
// NOTA (pedido del usuario): el thinking extendido queda DESACTIVADO — no se configura
// ninguna opcion de thinking/interleaved-thinking; el SDK no lo activa por defecto.

import http from 'node:http';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import pg from 'pg';

const PORT = Number(process.env.PORT || 4610);
const TOKEN = process.env.COTIZADOR_WORKER_TOKEN || '';
const DEFAULT_MODEL = process.env.COTIZADOR_MODEL || 'claude-opus-4-8';
const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: (process.env.DATABASE_URL || '').replace(/[?&]schema=[^&]+/, ''), options: '-c search_path=gcc_world,public' })
  : null;

const SYSTEM_PROMPT = `Eres el "Agente de Cotizaciones Software" de GCC World, una consultora de software en Ecuador (moneda USD).
Tu trabajo es transformar el detalle de un proyecto en una COTIZACION profesional y realista.

Metodo de precios:
- Recibes un SERVICIO con su costo POR HORA (rate). Para cada requerimiento estimas las HORAS de trabajo y calculas su costo = horas * rate, redondeado a un valor comercial razonable.
- Si las instrucciones adicionales fijan un PRECIO TOTAL, respetalo exactamente: distribuye ese total entre los requerimientos de forma coherente (ajusta horas/costos para que la suma cuadre).
- Si las instrucciones piden tareas obligatorias o consideraciones (infraestructura, integraciones), inclúyelas.
- Puedes usar la herramienta list_my_projects para revisar cotizaciones/proyectos previos del mismo miembro y calibrar precios y desglose.

Reglas de la cotizacion:
- Desglosa el proyecto en REQUERIMIENTOS claros (modulos/entregables). Cada requerimiento tiene: title, description breve, hours (numero), cost (numero USD) y 2-6 subtasks (pasos concretos).
- COSTOS ADICIONALES (additional_costs): servicios de PROVEEDORES EXTERNOS que el cliente debera adquirir aparte del desarrollo (p. ej. hosting/servidor, dominio, pasarela de pago, APIs de terceros, licencias, correo transaccional, SMS, almacenamiento, mapas). Segun el contexto del proyecto, propon los que apliquen con un costo estimado en USD (mensual o unico) y una breve descripcion. Si no aplica ninguno, devuelve una lista vacia.
- Propon una FECHA LIMITE (deadline) realista en formato ISO (YYYY-MM-DD), acorde al total de horas.
- Escribe en español. Se concreto y evita relleno.

Formato de salida: tu MENSAJE FINAL debe ser EXACTAMENTE un objeto JSON valido (sin markdown, sin fences, sin texto extra alrededor). El esquema exacto lo indica cada solicitud.`;

function generatePrompt(ctx) {
  const rate = ctx?.service?.rate != null ? `$${ctx.service.rate} por hora` : 'no especificado (estima un precio de mercado razonable)';
  return `Genera una cotizacion nueva.

SERVICIO: ${ctx?.service?.name || '(sin nombre)'} — costo/hora: ${rate}
DETALLE DEL PROYECTO:
"""
${ctx?.detail || ''}
"""
INSTRUCCIONES ADICIONALES (pueden fijar precio o tareas obligatorias; si estan vacias, tu decides el precio):
"""
${ctx?.instructions || '(ninguna)'}
"""

Antes de decidir, si te sirve, revisa proyectos previos del miembro con list_my_projects.

Responde SOLO con este JSON (sin nada mas):
{
  "title": "titulo corto del proyecto",
  "summary": "resumen de 2-4 frases del alcance",
  "deadline": "YYYY-MM-DD",
  "requirements": [
    { "title": "...", "description": "...", "hours": 0, "cost": 0, "subtasks": ["...", "..."] }
  ],
  "additional_costs": [
    { "label": "Servicio de proveedor externo", "description": "para que sirve", "amount": 0 }
  ]
}`;
}

function chatPrompt(message) {
  return `El usuario pide lo siguiente sobre la cotizacion actual:
"""
${message}
"""

Si pide CAMBIOS en la cotizacion (agregar/quitar/modificar requerimientos, reprecio, cambiar infraestructura, etc.), aplica los cambios y devuelve la cotizacion COMPLETA actualizada.
Si solo hace una consulta, respóndela sin cambiar la cotizacion.

Responde SOLO con este JSON (sin nada mas):
{
  "reply": "tu respuesta en español para el usuario (breve)",
  "quote": null | {
    "title": "...",
    "summary": "...",
    "deadline": "YYYY-MM-DD",
    "requirements": [ { "title": "...", "description": "...", "hours": 0, "cost": 0, "subtasks": ["..."] } ],
    "additional_costs": [ { "label": "...", "description": "...", "amount": 0 } ]
  }
}
Incluye "quote" con la cotizacion completa SOLO si hubo cambios; si es solo una consulta, pon "quote": null.`;
}

// Herramienta: proyectos previos del miembro (solo lectura), para calibrar precios/desglose.
function buildMcp(memberId) {
  return createSdkMcpServer({
    name: 'gcc',
    version: '1.0.0',
    tools: [
      tool(
        'list_my_projects',
        'Lista los proyectos/cotizaciones previos del miembro actual con sus requerimientos y costos, para calibrar precios y forma de desglose.',
        { limit: z.number().int().min(1).max(50).optional() },
        async (args) => {
          if (!pool || !memberId) return { content: [{ type: 'text', text: '[]' }] };
          try {
            const { rows } = await pool.query(
              `SELECT p.id, p.title, p.status, p.final_cost,
                      COALESCE(json_agg(json_build_object('title', r.title, 'cost', r.cost)) FILTER (WHERE r.id IS NOT NULL), '[]') AS requirements
                 FROM gcc_world.projects p
                 LEFT JOIN gcc_world.project_requirements r ON r.project_id = p.id
                WHERE p.assigned_member_id = $1
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT $2`,
              [memberId, args?.limit || 20],
            );
            return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `[] (error: ${e.message})` }] };
          }
        },
      ),
    ],
  });
}

async function runAgent({ prompt, model, resume, memberId }) {
  const mcp = buildMcp(memberId);
  let sessionId = resume || null;
  let finalText = '';
  const q = query({
    prompt,
    options: {
      model: model || DEFAULT_MODEL,
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: { gcc: mcp },
      allowedTools: ['mcp__gcc__list_my_projects'],
      // NO usamos 'bypassPermissions' (pasa --dangerously-skip-permissions, que falla como
      // root en Railway). En su lugar, un callback aprueba SOLO nuestra herramienta (read-only)
      // y niega cualquier otra — sin prompts (headless).
      canUseTool: async (toolName, input) =>
        toolName === 'mcp__gcc__list_my_projects'
          ? { behavior: 'allow', updatedInput: input }
          : { behavior: 'deny', message: 'Herramienta no permitida en este agente' },
      settingSources: [],      // no cargar settings del filesystem
      maxTurns: 14,
      ...(resume ? { resume } : {}),
    },
  });
  for await (const msg of q) {
    if (msg.type === 'system' && msg.subtype === 'init') sessionId = msg.session_id;
    else if (msg.type === 'result') {
      if (typeof msg.result === 'string') finalText = msg.result;
      if (msg.session_id) sessionId = msg.session_id;
    }
  }
  return { sessionId, finalText };
}

// Extrae el primer objeto JSON del texto (por si el modelo agrega algo alrededor).
function parseJson(text) {
  if (!text) throw new Error('El agente no devolvio texto');
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1 || e < s) throw new Error('No se encontro JSON en la respuesta del agente');
  return JSON.parse(text.slice(s, e + 1));
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 5 * 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });

    // Auth fail-closed.
    if (!TOKEN) return send(res, 503, { error: 'Worker sin COTIZADOR_WORKER_TOKEN configurado' });
    const auth = req.headers['x-worker-token'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (auth !== TOKEN) return send(res, 401, { error: 'Token invalido' });

    if (req.method === 'POST' && req.url === '/generate') {
      const body = await readBody(req);
      const ctx = body.context || {};
      const { sessionId, finalText } = await runAgent({ prompt: generatePrompt(ctx), model: body.model, memberId: ctx.memberId });
      const payload = parseJson(finalText);
      return send(res, 200, { sessionId, payload });
    }

    if (req.method === 'POST' && req.url === '/chat') {
      const body = await readBody(req);
      const ctx = body.context || {};
      if (!body.message) return send(res, 400, { error: 'message requerido' });
      const { sessionId, finalText } = await runAgent({ prompt: chatPrompt(body.message), model: body.model, resume: body.sessionId, memberId: ctx.memberId });
      const parsed = parseJson(finalText);
      return send(res, 200, { sessionId, reply: parsed.reply || '', payload: parsed.quote || null });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('[cotizador-worker]', e?.message || e);
    return send(res, 500, { error: e?.message || 'Error interno del worker' });
  }
});

server.listen(PORT, () => console.log(`[cotizador-worker] escuchando en :${PORT} (modelo ${DEFAULT_MODEL})`));
