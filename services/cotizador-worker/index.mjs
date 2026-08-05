// Worker dedicado del Agente de Cotizaciones Software.
// Ejecuta el Claude Agent SDK contra KIMI K2.6, mantiene la sesion viva y la reanuda por sessionId.
// La app web le habla por HTTP + token compartido (x-worker-token), fail-closed.
//
// Endpoints:
//   GET  /health              -> { ok: true }
//   POST /generate  { model, context }                 -> { sessionId, payload }
//   POST /chat      { sessionId, model, message, context } -> { sessionId, reply, payload? }
//
// Env: PORT (4610), COTIZADOR_WORKER_TOKEN, KIMI_API_KEY, DATABASE_URL, COTIZADOR_MODEL, APP_URL.
//
// NOTA (pedido del usuario): el thinking extendido queda DESACTIVADO — no se configura
// ninguna opcion de thinking/interleaved-thinking; el SDK no lo activa por defecto.
// (Por eso el modelo es k2.6 y no k2.7-code: ese ultimo EXIGE thinking y devuelve 400 sin el.)

import http from 'node:http';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import pg from 'pg';

const PORT = Number(process.env.PORT || 4610);
const TOKEN = process.env.COTIZADOR_WORKER_TOKEN || '';
const DEFAULT_MODEL = process.env.COTIZADOR_MODEL || 'kimi-k2.6';

// ── El proveedor del modelo ───────────────────────────────────────────────────
// El Agent SDK no habla con Anthropic directamente: lanza el binario de Claude Code, que
// respeta ANTHROPIC_BASE_URL. Moonshot expone un endpoint COMPATIBLE con /v1/messages, asi
// que el cambio de proveedor es de entorno, no de logica: el prompt, las herramientas MCP y
// la reanudacion por sessionId siguen igual.
const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/anthropic';
const KIMI_API_KEY = process.env.KIMI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
// Ventana de auto-compactacion. Kimi K2.6 son 262k de contexto, no el millon de Opus: generar
// una cotizacion cabe de sobra, pero GCC Bot ACUMULA turnos sobre la misma sesion.
const COMPACT_WINDOW = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW || '200000';

/**
 * El entorno del subproceso del SDK.
 *
 * ── POR QUE SE ARMA AQUI Y NO SE DEJA EN VARIABLES DE RAILWAY ──────────────────
 * Claude Code hace llamadas de MODELO PEQUEÑO por su cuenta (compactacion, titulos,
 * subagentes) con IDs de Claude. Contra Moonshot eso devuelve *model not found* y el agente
 * se cae a mitad de una cotizacion — un fallo que no aparece en la primera prueba, solo
 * cuando la sesion crece. Fijar aqui las cuatro variantes evita que dependa de que alguien
 * recuerde ponerlas al crear un servicio nuevo.
 *
 * Y se BORRA ANTHROPIC_API_KEY: gana a ANTHROPIC_AUTH_TOKEN en el orden de resolucion, asi
 * que una clave de Anthropic olvidada en el entorno se mandaria a Moonshot -> 401.
 *
 * ⚠️ `options.env` REEMPLAZA el entorno del subproceso, no lo mezcla: hay que esparcir
 * process.env o el worker pierde PATH, DATABASE_URL y todo lo demas.
 */
function entornoDelAgente(modelo) {
  const env = {
    ...process.env,
    ANTHROPIC_BASE_URL: KIMI_BASE_URL,
    ANTHROPIC_AUTH_TOKEN: KIMI_API_KEY,
    ANTHROPIC_MODEL: modelo,
    ANTHROPIC_DEFAULT_OPUS_MODEL: modelo,
    ANTHROPIC_DEFAULT_SONNET_MODEL: modelo,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: modelo,
    ANTHROPIC_DEFAULT_FABLE_MODEL: modelo,
    CLAUDE_CODE_SUBAGENT_MODEL: modelo,
    CLAUDE_CODE_AUTO_COMPACT_WINDOW: COMPACT_WINDOW,
  };
  delete env.ANTHROPIC_API_KEY;
  return env;
}
// URL de la app web: la usa la herramienta de talentos (la búsqueda semántica vive allí,
// para que las claves de IA no tengan que estar también en el worker).
const APP_URL = (process.env.APP_URL || '').replace(/\/+$/, '');
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
- Desglosa el proyecto en REQUERIMIENTOS claros (modulos/entregables). Cada requerimiento tiene: title, description breve, hours (numero), cost (numero USD), 2-6 subtasks (pasos concretos) y talents (talentos requeridos).
- TALENTOS (obligatorio en cada requerimiento): describe con tus palabras el trabajo del requerimiento y llama a buscar_talentos para ver los talentos reales de la organizacion. Elige de los resultados 1-3 talentos, COPIANDO EL NOMBRE EXACTO tal como te lo devuelve la herramienta. No inventes talentos ni escribas variantes: si el nombre no vino de la herramienta, no vale. Busca por separado para cada requerimiento, porque cada uno necesita perfiles distintos.
- NO indiques plazas ni cantidad de personas: eso lo define despues una persona.
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
Para CADA requerimiento llama a buscar_talentos con una descripcion del trabajo y elige 1-3 talentos de los que te devuelva, con su nombre exacto.

Responde SOLO con este JSON (sin nada mas):
{
  "title": "titulo corto del proyecto",
  "summary": "resumen de 2-4 frases del alcance",
  "deadline": "YYYY-MM-DD",
  "requirements": [
    { "title": "...", "description": "...", "hours": 0, "cost": 0, "subtasks": ["...", "..."], "talents": ["Nombre exacto devuelto por buscar_talentos"] }
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
    "requirements": [ { "title": "...", "description": "...", "hours": 0, "cost": 0, "subtasks": ["..."], "talents": ["..."] } ],
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
      tool(
        'buscar_talentos',
        'Busca en la lista de talentos de la organizacion los que mejor encajan con una descripcion de trabajo. Devuelve candidatos con su NOMBRE EXACTO y un score de 0 a 1. Usalo para elegir los talentos de cada requerimiento; copia el nombre tal cual.',
        { consulta: z.string().min(2), limite: z.number().int().min(1).max(25).optional() },
        async (args) => {
          const consulta = String(args?.consulta || '').trim();
          if (!consulta) return { content: [{ type: 'text', text: '[]' }] };
          // Camino principal: la app resuelve la busqueda semantica (embeddings + pgvector).
          if (APP_URL && TOKEN) {
            try {
              const res = await fetch(`${APP_URL}/api/talentos/buscar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-worker-token': TOKEN },
                body: JSON.stringify({ query: consulta, k: args?.limite || 8 }),
              });
              if (res.ok) {
                const j = await res.json();
                return { content: [{ type: 'text', text: JSON.stringify(j.data || []) }] };
              }
            } catch { /* cae al respaldo por texto */ }
          }
          // Respaldo: busqueda por texto contra la base (peor calidad, pero nunca deja al
          // agente sin candidatos si la app no responde).
          if (!pool) return { content: [{ type: 'text', text: '[]' }] };
          try {
            const { rows } = await pool.query(
              `SELECT nombre FROM gcc_world.gd_talentos
                WHERE LOWER(nombre) ILIKE '%' || LOWER($1) || '%'
                ORDER BY LENGTH(nombre) LIMIT $2`,
              [consulta, args?.limite || 8],
            );
            return { content: [{ type: 'text', text: JSON.stringify(rows.map((r) => ({ nombre: r.nombre, score: null }))) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `[] (error: ${e.message})` }] };
          }
        },
      ),
    ],
  });
}

async function runAgent({ prompt, model, resume, memberId }) {
  // Fail-closed: sin clave el SDK intentaria autenticarse por su cuenta y el fallo saldria
  // como un error opaco del subproceso a mitad de la generacion.
  if (!KIMI_API_KEY) throw new Error('Falta KIMI_API_KEY en el worker: no hay con que autenticarse contra Kimi.');
  const mcp = buildMcp(memberId);
  const modelo = model || DEFAULT_MODEL;
  let sessionId = resume || null;
  let finalText = '';
  const q = query({
    prompt,
    options: {
      model: modelo,
      env: entornoDelAgente(modelo),
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: { gcc: mcp },
      allowedTools: ['mcp__gcc__list_my_projects', 'mcp__gcc__buscar_talentos'],
      // NO usamos 'bypassPermissions' (pasa --dangerously-skip-permissions, que falla como
      // root en Railway). En su lugar, un callback aprueba SOLO nuestra herramienta (read-only)
      // y niega cualquier otra — sin prompts (headless).
      canUseTool: async (toolName, input) =>
        ['mcp__gcc__list_my_projects', 'mcp__gcc__buscar_talentos'].includes(toolName)
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
    // /health tambien reporta la CONFIGURACION viva: que herramientas expone el agente y si
    // la busqueda de talentos esta enchufada. Sirve para comprobar, sin generar una
    // cotizacion, que el servicio corre la version esperada.
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, {
        ok: true,
        tools: ['list_my_projects', 'buscar_talentos'],
        talentSearch: APP_URL ? 'app' : 'respaldo-texto',
        model: DEFAULT_MODEL,
        // La sonda tambien dice CONTRA QUIEN corre y si hay clave: comprobar el cambio de
        // proveedor sin gastar una cotizacion es el punto de todo esto.
        baseUrl: KIMI_BASE_URL,
        apiKey: KIMI_API_KEY ? 'ok' : 'FALTA',
      });
    }

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

server.listen(PORT, () => console.log(
  `[cotizador-worker] escuchando en :${PORT} (modelo ${DEFAULT_MODEL} en ${KIMI_BASE_URL}${KIMI_API_KEY ? '' : ' — ⚠️ SIN KIMI_API_KEY'})`,
));
