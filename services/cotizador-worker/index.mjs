// Worker dedicado del Agente de Cotizaciones Software.
// Ejecuta el Agents SDK de OpenAI sobre gpt-5.6-luna, mantiene la conversacion viva y la
// reanuda por sessionId. La app web le habla por HTTP + token compartido (x-worker-token),
// fail-closed.
//
// Endpoints:
//   GET  /health              -> { ok: true }
//   POST /generate  { model, context }                 -> { sessionId, payload }
//   POST /chat      { sessionId, model, message, context } -> { sessionId, reply, payload? }
//
// Env: PORT (4610), COTIZADOR_WORKER_TOKEN, OPENAI_API_KEY, DATABASE_URL, COTIZADOR_MODEL, APP_URL.
//
// ── QUE CAMBIO EL 2026-08-21 ─────────────────────────────────────────────────
// Antes esto era el **Claude Agent SDK apuntado a Kimi K2.6**: funcionaba porque Moonshot
// expone a proposito un endpoint compatible con /v1/messages de Anthropic, asi que bastaba
// con reapuntar ANTHROPIC_BASE_URL. **OpenAI no expone nada equivalente**, de modo que
// unificar el proveedor obligaba a cambiar de SDK, no de variable de entorno.
//
// El cambio se lleva por delante tres fragilidades que estaban documentadas aqui:
//
//   1. **El subproceso.** El Agent SDK lanzaba el binario de Claude Code, que hacia
//      llamadas de modelo pequeño por su cuenta (compactacion, titulos, subagentes) con
//      IDs de Claude que Moonshot no conocia. Habia que fijar SEIS variables de entorno
//      para que no se cayera a mitad de una cotizacion. Ya no hay subproceso.
//   2. **La puerta doble de permisos.** Declarar las herramientas en `allowedTools` las
//      auto-aprobaba ANTES de consultar al callback `canUseTool`, asi que el comentario
//      que decia "solo se aprueban las nuestras" era mentira. Aqui el agente solo tiene
//      las herramientas que se le pasan: no hay nada que denegar.
//   3. **Las sesiones en disco.** Vivian en el contenedor, y Railway levanta uno nuevo en
//      CADA despliegue: toda cotizacion anterior al despliegue quedaba sin hilo para
//      siempre. Ahora la conversacion vive en OpenAI y sobrevive al despliegue.
//
// El thinking sigue DESACTIVADO por peticion del usuario: `reasoning.effort: 'none'`.

import http from 'node:http';
import { Agent, run, tool, setDefaultOpenAIKey } from '@openai/agents';
import { OpenAIConversationsSession } from '@openai/agents-openai';
import { z } from 'zod';
import pg from 'pg';

const PORT = Number(process.env.PORT || 4610);
const TOKEN = process.env.COTIZADOR_WORKER_TOKEN || '';
const DEFAULT_MODEL = process.env.COTIZADOR_MODEL || 'gpt-5.6-luna';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

if (OPENAI_API_KEY) setDefaultOpenAIKey(OPENAI_API_KEY);

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

/**
 * La fecha de HOY en Ecuador, para el prompt.
 *
 * ⚠️ No es un adorno. El modelo tiene el conocimiento cortado en febrero de 2026 y **no
 * sabe en que dia vive**: sin esto propuso una `deadline` de 2026-04-10 para una
 * cotizacion pedida el 2026-08-21 — cuatro meses en el pasado. Antes no hacia falta
 * porque el CLI de Claude Code inyectaba la fecha en su propio prompt de sistema; al
 * quitar el subproceso, esa muleta desaparecio con el.
 */
function hoyEnEcuador() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Guayaquil' }); // YYYY-MM-DD
}

function generatePrompt(ctx) {
  const rate = ctx?.service?.rate != null ? `$${ctx.service.rate} por hora` : 'no especificado (estima un precio de mercado razonable)';
  return `Genera una cotizacion nueva.

FECHA DE HOY: ${hoyEnEcuador()} (Ecuador). La deadline que propongas tiene que ser POSTERIOR a esta fecha.
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

/**
 * El prompt del chat lleva SIEMPRE la cotizacion tal como esta guardada, aunque se este
 * reanudando la sesion.
 *
 * ── POR QUE ─────────────────────────────────────────────────────────────────────
 * Antes el agente se apoyaba solo en su memoria de la sesion, y eso falla de dos formas:
 *   1. Si la sesion no existe (contenedor nuevo tras un despliegue), no hay memoria y el
 *      agente se INVENTARIA la cotizacion en vez de editar la real.
 *   2. Aunque exista, la cotizacion pudo cambiar FUERA de la conversacion (una edicion
 *      manual, otra sesion, el panel). La memoria del modelo queda desfasada y devuelve
 *      una cotizacion vieja como si fuera la buena.
 * La base de datos es la fuente de verdad; la sesion solo aporta el hilo de la charla.
 */
function chatPrompt(message, ctx) {
  const actual = ctx?.currentQuote
    ? `ESTADO ACTUAL DE LA COTIZACION (fuente de verdad — puede haber cambiado fuera de esta
conversacion; parte SIEMPRE de aqui, no de lo que recuerdes):
"""
${JSON.stringify(ctx.currentQuote, null, 1)}
"""

`
    : '';
  return `FECHA DE HOY: ${hoyEnEcuador()} (Ecuador). Cualquier fecha que propongas tiene que ser posterior.

${actual}El usuario pide lo siguiente sobre la cotizacion actual:
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

// Las DOS herramientas del agente, ambas de SOLO LECTURA.
//
// Antes iban dentro de un servidor MCP en proceso y habia que aprobarlas con un callback,
// porque el CLI de Claude Code traia ademas su propio arsenal (Bash, Read, Write…) y habia
// que apagarlo. Aqui el agente tiene EXACTAMENTE lo que se le pasa en `tools`, asi que la
// lista blanca y la lista negra sobran: no existe nada que denegar.
//
// ⚠️ Los parametros van con `.nullable()` y no con `.optional()`: el modo estricto exige
// que TODOS los campos esten en `required`, y un `.optional()` genera un esquema que la
// API rechaza. Es la misma trampa que en las herramientas del agente de WhatsApp.
function construirHerramientas(memberId) {
  const listarProyectos = tool({
    name: 'list_my_projects',
    description: 'Lista los proyectos/cotizaciones previos del miembro actual con sus requerimientos y costos, para calibrar precios y forma de desglose.',
    parameters: z.object({
      limit: z.number().int().min(1).max(50).nullable().describe('Cuantos proyectos traer. null = 20.'),
    }),
    execute: async ({ limit }) => {
      if (!pool || !memberId) return '[]';
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
          [memberId, limit || 20],
        );
        return JSON.stringify(rows);
      } catch (e) {
        return `[] (error: ${e.message})`;
      }
    },
  });

  const buscarTalentos = tool({
    name: 'buscar_talentos',
    description: 'Busca en la lista de talentos de la organizacion los que mejor encajan con una descripcion de trabajo. Devuelve candidatos con su NOMBRE EXACTO y un score de 0 a 1. Usalo para elegir los talentos de cada requerimiento; copia el nombre tal cual.',
    parameters: z.object({
      consulta: z.string().min(2).describe('Descripcion del trabajo del requerimiento.'),
      limite: z.number().int().min(1).max(25).nullable().describe('Cuantos candidatos traer. null = 8.'),
    }),
    execute: async ({ consulta, limite }) => {
      const texto = String(consulta || '').trim();
      if (!texto) return '[]';
      // Camino principal: la app resuelve la busqueda semantica (embeddings + pgvector).
      if (APP_URL && TOKEN) {
        try {
          const res = await fetch(`${APP_URL}/api/talentos/buscar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-worker-token': TOKEN },
            body: JSON.stringify({ query: texto, k: limite || 8 }),
          });
          if (res.ok) {
            const j = await res.json();
            return JSON.stringify(j.data || []);
          }
        } catch { /* cae al respaldo por texto */ }
      }
      // Respaldo: busqueda por texto contra la base (peor calidad, pero nunca deja al
      // agente sin candidatos si la app no responde).
      if (!pool) return '[]';
      try {
        const { rows } = await pool.query(
          `SELECT nombre FROM gcc_world.gd_talentos
            WHERE LOWER(nombre) ILIKE '%' || LOWER($1) || '%'
            ORDER BY LENGTH(nombre) LIMIT $2`,
          [texto, limite || 8],
        );
        return JSON.stringify(rows.map((r) => ({ nombre: r.nombre, score: null })));
      } catch (e) {
        return `[] (error: ${e.message})`;
      }
    },
  });

  return [listarProyectos, buscarTalentos];
}

/**
 * ¿El error viene de que la conversacion que queriamos reanudar no sirve?
 *
 * Antes eran las sesiones en DISCO del contenedor, que Railway borraba en cada despliegue.
 * Ahora la conversacion vive en OpenAI, asi que esto deberia ser raro — pero sigue siendo
 * posible: un `worker_session_id` corrupto en la base, una conversacion caducada, o una
 * clave distinta de la que la creo. El remedio es el mismo de siempre: empezar de cero.
 *
 * Que la conversacion se pierda NO es motivo para dejar tirado al usuario: el prompt del
 * chat ya lleva la cotizacion entera, asi que una conversacion nueva puede seguir
 * trabajando. Lo que se pierde es el hilo de la charla, no el trabajo.
 */
function esSesionPerdida(err) {
  if (err?.status === 404) return true;
  const m = String(err?.message ?? '');
  return /conversation.{0,30}(not found|does not exist)/i.test(m)
    || /no such conversation/i.test(m)
    || /invalid.{0,20}conversation/i.test(m);
}

async function runAgent({ prompt, model, resume, memberId }) {
  // Fail-closed: sin clave el SDK intentaria autenticarse por su cuenta y el fallo saldria
  // como un error opaco a mitad de la generacion.
  if (!OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY en el worker: no hay con que autenticarse contra OpenAI.');
  const modelo = model || DEFAULT_MODEL;

  const agente = new Agent({
    name: 'Agente de Cotizaciones Software',
    instructions: SYSTEM_PROMPT,
    model: modelo,
    tools: construirHerramientas(memberId),
    // ⚠️ NI temperature NI top_p: gpt-5.6-luna devuelve 400 con cualquiera de los dos, no
    // los ignora.
    //
    // El razonamiento sigue APAGADO, como pidio el usuario. Y aqui apagarlo no cuesta
    // nada: medido el 2026-08-21, con `effort: 'none'` el agente llama igual a
    // `buscar_talentos` una vez por requerimiento y copia los nombres exactos. Los seis
    // niveles se comportan igual en eso; lo unico que cambia es lo que se gasta pensando.
    modelSettings: { reasoning: { effort: 'none' } },
  });

  const ejecutar = async (reanudar) => {
    const session = new OpenAIConversationsSession(
      reanudar ? { conversationId: reanudar, apiKey: OPENAI_API_KEY } : { apiKey: OPENAI_API_KEY },
    );
    // maxTurns 14: el agente busca talentos una vez POR requerimiento, asi que necesita
    // varias vueltas de herramienta antes de escribir la cotizacion.
    const resultado = await run(agente, prompt, { session, maxTurns: 14 });
    const sessionId = await session.getSessionId();
    return { sessionId, finalText: resultado.finalOutput ?? '', reanudada: Boolean(reanudar) };
  };

  try {
    return await ejecutar(resume || null);
  } catch (err) {
    if (!resume || !esSesionPerdida(err)) throw err;
    // `console.log`, no `console.warn`: en Railway **todo lo que va a stderr se pinta como
    // error**, y esto es un caso previsto. Manchar de rojo el panel con lo que es normal
    // deja el contador de errores sin valor — que es exactamente lo que costo no ver los
    // 20 fallos de `agente-worker`. Los rojos se reservan para lo que si lo es.
    console.log(`[cotizador-worker] la conversacion ${resume} ya no existe; se arranca una nueva desde la cotizacion guardada`);
    return await ejecutar(null);
  }
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
        proveedor: 'openai',
        apiKey: OPENAI_API_KEY ? 'ok' : 'FALTA',
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
      const { sessionId, finalText, reanudada } = await runAgent({ prompt: chatPrompt(body.message, ctx), model: body.model, resume: body.sessionId, memberId: ctx.memberId });
      const parsed = parseJson(finalText);
      // `reanudada: false` con un sessionId pedido significa que la sesión vieja se perdió y
      // esta es nueva. La app lo persiste; se dice para que se pueda avisar en el chat.
      return send(res, 200, { sessionId, reply: parsed.reply || '', payload: parsed.quote || null, sesionNueva: Boolean(body.sessionId) && !reanudada });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('[cotizador-worker]', e?.message || e);
    return send(res, 500, { error: e?.message || 'Error interno del worker' });
  }
});

server.listen(PORT, () => console.log(
  `[cotizador-worker] escuchando en :${PORT} (modelo ${DEFAULT_MODEL} en OpenAI${OPENAI_API_KEY ? '' : ' — ⚠️ SIN OPENAI_API_KEY'})`,
));
