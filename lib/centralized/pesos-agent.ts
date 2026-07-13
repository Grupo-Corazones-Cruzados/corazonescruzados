// Agente conversacional (Claude CLI, headless) que genera PESOS para una premisa desde Scopus.
// NO usa la API de OpenAI: spawnea el binario `claude` del servidor local. NUESTRO servidor ejecuta
// cada acción (Scopus/DB) → el alcance ("solo pesos de esta sesión/premisa") se fuerza aquí, no en el modelo.
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { searchScopus } from '@/lib/centralized/scopus';
import {
  getPremisaForAgent, getStyleExamplesPesos, agentListSessionWeights,
  agentAddWeight, agentUpdateWeight, agentDeleteWeight,
} from '@/lib/centralized/gestion-datos-db';

const execFileAsync = promisify(execFile);
const MAX_STEPS = 16;

export type AgentMsg =
  | { role: 'assistant'; text: string }
  | { role: 'tool'; kind: string; label: string; text?: string };

function claudeBin(): string {
  if (process.env.CLAUDE_CLI_PATH) return process.env.CLAUDE_CLI_PATH;
  const home = process.env.HOME || '';
  const cand = home ? `${home}/.local/bin/claude` : '';
  if (cand && existsSync(cand)) return cand;
  return 'claude';
}

async function callClaude(input: string, opts: { resume?: string; systemPrompt?: string }): Promise<{ result: string; sessionId: string }> {
  const args = ['-p', input, '--output-format', 'json', '--permission-mode', 'bypassPermissions'];
  if (opts.resume) args.push('--resume', opts.resume);
  // --system-prompt REEMPLAZA el prompt (sin la identidad de "agente de programación" de Claude Code,
  // que confundía al modelo — creía que debía leer el repo). Solo va en el primer turno; en --resume persiste.
  // (Sin --exclude-dynamic-system-prompt-sections: ese flag causaba respuestas vacías.)
  if (opts.systemPrompt) args.push('--system-prompt', opts.systemPrompt);
  // El agente NO debe usar herramientas propias del CLI: solo razonar y devolver JSON.
  args.push('--disallowedTools', 'WebSearch', 'WebFetch', 'Bash', 'Read', 'Write', 'Edit', 'Task', 'Glob', 'Grep');
  // cwd neutral (fuera del repo) para NO cargar el CLAUDE.md del proyecto (contexto de código).
  const { stdout } = await execFileAsync(claudeBin(), args, { maxBuffer: 24 * 1024 * 1024, timeout: 150000, cwd: tmpdir() });
  const parsed = JSON.parse(stdout);
  if (parsed.is_error) throw new Error(parsed.result || 'Error del agente Claude');
  return { result: parsed.result ?? '', sessionId: parsed.session_id };
}

// Recordatorio breve de acciones válidas (se añade a cada RESULTADO para evitar que el modelo derive).
const ACTIONS_HINT = 'Acciones válidas: scopus_search, add_weight, list_session_weights, update_weight, delete_weight, message.';

/** Extrae el objeto JSON de acción de la respuesta del modelo (tolerante a fences/prosa). */
function parseAction(raw: string): any {
  const s = (raw || '').trim();
  try { return JSON.parse(s); } catch { /* sigue */ }
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* sigue */ } }
  return { action: 'message', text: s };
}

function buildSystemPrompt(prem: any, styles: string[], yearFrom: number): string {
  const ejemplos = styles.length
    ? styles.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
    : '  (aún no hay ejemplos; redacta una afirmación clara y concisa que exprese el dato)';
  return `TAREA DE TRANSFORMACIÓN DE TEXTO GUIADA POR UN PROGRAMA EXTERNO. No dispones de herramientas y NO las
necesitas; NUNCA digas que te faltan herramientas ni intentes leer archivos o repositorios. En CADA turno tu
ÚNICA salida es UN objeto JSON en TEXTO PLANO (sin ningún texto adicional, sin markdown, sin fences). Un programa
externo lee tu JSON, ejecuta la acción y te responde con el RESULTADO como un nuevo mensaje; entonces produces el
siguiente JSON. Así "buscas" y "guardas": escribiendo el JSON correspondiente, no usando herramientas.

ROL: agente que REFUERZA una premisa creando PESOS con evidencia reciente de Scopus (últimos 5 años, desde ${yearFrom}).

PREMISA A REFORZAR (su tipo de dato base es "${prem.tipo_dato}"):
"${prem.contenido}"

Cada PESO (el JSON add_weight DEBE incluir SIEMPRE los 4 campos: contenido, tipo_dato, credibilidad, doi):
- "contenido": frase NO vacía con el hallazgo del estudio que apoya la premisa (dato de CANTIDAD: cifra/estadística,
  o de CUALIDAD: observación cualitativa). Los resultados de Scopus traen título/revista/año pero NO el resumen;
  redacta el hallazgo principal del estudio de forma clara y específica, imitando el estilo de estos ejemplos:
${ejemplos}
- "doi": el "doi" de un resultado de Scopus. Si un resultado NO tiene "doi", NO lo agregues.
- "tipo_dato": "cantidad" o "cualidad". "credibilidad": entero 0-100 que TÚ estimas por recencia, revista y nº de citas.

PROTOCOLO — responde SIEMPRE con UN ÚNICO objeto JSON en texto plano, UNA acción por turno:
- {"action":"scopus_search","query":"palabras clave en inglés"}   // el programa filtra a los últimos 5 años
- {"action":"add_weight","contenido":"...","tipo_dato":"cantidad|cualidad","credibilidad":0-100,"doi":"10...."}
- {"action":"list_session_weights"}   // lista los pesos que has creado en ESTA sesión (para modificarlos)
- {"action":"update_weight","id":<id>,"contenido"?:"...","tipo_dato"?:"...","credibilidad"?:0-100}
- {"action":"delete_weight","id":<id>}
- {"action":"message","text":"resumen para el usuario"}   // termina el turno

REGLAS:
- Empieza con términos GENERALES (2-4 palabras en inglés). Si una búsqueda no trae resultados con "doi", REFORMULA
  con términos más amplios; no te rindas tras un solo intento.
- Agrega SOLO pesos con "doi" verificable y datos recientes (>= ${yearFrom}).
- SOLO puedes modificar/eliminar pesos creados en ESTA sesión (te los listaré). NUNCA toques otras fuentes.
- Agrega entre 2 y 5 pesos de buena calidad y termina con "message" resumiendo. Redacta el "contenido" y el "text" en español.`;
}

export async function runAgentTurn(params: {
  premisaId: number;
  sessionId: string;
  claudeSessionId?: string;
  userMessage: string;
}): Promise<{ claudeSessionId: string; activity: AgentMsg[]; sessionWeights: any[] }> {
  const { premisaId, sessionId } = params;
  const yearFrom = new Date().getFullYear() - 4; // últimos 5 años (inclusive)
  const activity: AgentMsg[] = [];

  let claudeSid = params.claudeSessionId;
  let systemPrompt: string | undefined;
  if (!claudeSid) {
    const prem = await getPremisaForAgent(premisaId);
    if (!prem) throw new Error('La premisa no existe o no es de tipo premisa.');
    const styles = await getStyleExamplesPesos(15);
    systemPrompt = buildSystemPrompt(prem, styles, yearFrom);
  }

  let input = params.userMessage;
  let step = 0;
  while (step < MAX_STEPS) {
    step++;
    const { result, sessionId: sid } = await callClaude(input, { resume: claudeSid, systemPrompt: claudeSid ? undefined : systemPrompt });
    claudeSid = sid;
    const action = parseAction(result);
    const kind = action?.action;

    if (!kind || kind === 'message') {
      activity.push({ role: 'assistant', text: action?.text || result || '(sin respuesta)' });
      break;
    }
    if (kind === 'scopus_search') {
      const query = String(action.query || '').trim();
      activity.push({ role: 'tool', kind: 'scopus_search', label: `Buscó en Scopus: “${query}”` });
      try {
        const results = await searchScopus(query, 10, yearFrom);
        const compact = results.map((r, i) => ({ i, title: r.title, autor: r.creator, anio: r.year, revista: r.journal, doi: r.doi, citas: r.citedby, tipo: r.aggregationType }));
        const conDoi = compact.filter((c) => c.doi).length;
        const nudge = conDoi === 0
          ? 'Ninguno tiene DOI o no hubo resultados: reformula "scopus_search" con términos MÁS GENERALES.'
          : 'Usa "add_weight" con el "doi" de un resultado (omite los que no tengan doi).';
        input = `RESULTADO scopus_search (${compact.length} resultados, ${conDoi} con DOI, últimos 5 años):\n${JSON.stringify(compact)}\n${nudge} ${ACTIONS_HINT}`;
      } catch (e: any) { input = `RESULTADO scopus_search ERROR: ${e.message}`; }
      continue;
    }
    if (kind === 'add_weight') {
      try {
        const w = await agentAddWeight(premisaId, sessionId, { contenido: String(action.contenido || ''), tipoDato: action.tipo_dato, credibilidad: Number(action.credibilidad), doi: String(action.doi || '') });
        activity.push({ role: 'tool', kind: 'add_weight', label: `Agregó peso ${w.nomenclatura || ''} · ${action.tipo_dato} · ${Math.round(Number(action.credibilidad) || 0)}%`, text: String(action.contenido || '') });
        input = `RESULTADO add_weight: OK, peso id ${w.id} (${w.nomenclatura || ''}) creado y aplicado. Agrega otro con add_weight o termina con message. ${ACTIONS_HINT}`;
      } catch (e: any) {
        activity.push({ role: 'tool', kind: 'error', label: `No se pudo agregar el peso: ${e.message}` });
        input = `RESULTADO add_weight ERROR: ${e.message}`;
      }
      continue;
    }
    if (kind === 'update_weight') {
      try {
        await agentUpdateWeight(premisaId, sessionId, Number(action.id), { contenido: action.contenido != null ? String(action.contenido) : undefined, tipoDato: action.tipo_dato, credibilidad: action.credibilidad != null ? Number(action.credibilidad) : undefined });
        activity.push({ role: 'tool', kind: 'update_weight', label: `Modificó el peso id ${action.id}` });
        input = `RESULTADO update_weight: OK`;
      } catch (e: any) {
        activity.push({ role: 'tool', kind: 'error', label: e.message });
        input = `RESULTADO update_weight ERROR: ${e.message}`;
      }
      continue;
    }
    if (kind === 'delete_weight') {
      try {
        await agentDeleteWeight(premisaId, sessionId, Number(action.id));
        activity.push({ role: 'tool', kind: 'delete_weight', label: `Eliminó el peso id ${action.id}` });
        input = `RESULTADO delete_weight: OK`;
      } catch (e: any) {
        activity.push({ role: 'tool', kind: 'error', label: e.message });
        input = `RESULTADO delete_weight ERROR: ${e.message}`;
      }
      continue;
    }
    if (kind === 'list_session_weights') {
      const list = await agentListSessionWeights(premisaId, sessionId);
      input = `RESULTADO list_session_weights:\n${JSON.stringify(list.map((w: any) => ({ id: w.id, nomen: w.nomenclatura, tipo: w.tipo_dato, cred: w.credibilidad, contenido: w.contenido })))}`;
      continue;
    }
    input = `ERROR: acción desconocida "${kind}". Usa scopus_search | add_weight | update_weight | delete_weight | list_session_weights | message.`;
  }
  if (step >= MAX_STEPS) activity.push({ role: 'assistant', text: '(Alcancé el límite de pasos de este turno. Escríbeme para continuar.)' });

  const sessionWeights = await agentListSessionWeights(premisaId, sessionId);
  return { claudeSessionId: claudeSid!, activity, sessionWeights };
}
