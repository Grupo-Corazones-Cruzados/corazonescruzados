// Agente conversacional (Claude CLI, headless) que genera PESOS para una premisa desde Scopus.
// NO usa la API de OpenAI: spawnea el binario `claude` del servidor local. NUESTRO servidor ejecuta
// cada acción (Scopus/DB) → el alcance ("solo pesos de esta sesión/premisa") se fuerza aquí, no en el modelo.
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { searchScopus, openAlexAbstract } from '@/lib/centralized/scopus';
import { formatApaText } from '@/lib/centralized/apa';
import {
  getPremisaForAgent, getStyleExamplesPesos, agentListSessionWeights, getPremisaExistingWeights,
  getUnconnectedPesos, agentAddWeight, agentUpdateWeight, agentDeleteWeight,
} from '@/lib/centralized/gestion-datos-db';

const execFileAsync = promisify(execFile);

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

/** Extrae el objeto JSON de acción de la respuesta del modelo (tolerante a fences/prosa). */
function parseAction(raw: string): any {
  const s = (raw || '').trim();
  try { return JSON.parse(s); } catch { /* sigue */ }
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* sigue */ } }
  return { action: 'message', text: s };
}

function baseSystemPrompt(prem: any, styles: string[], yearFrom: number): string {
  const ejemplos = styles.length
    ? styles.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
    : '  (aún no hay ejemplos; redacta un texto claro y argumentado que exprese el dato)';
  return `Ayudas a REFORZAR una premisa creando PESOS (datos con referencia) a partir de evidencia reciente de Scopus
(últimos 5 años, desde ${yearFrom}). NO eres un asistente de programación; NO tienes herramientas ni acceso a
archivos: LEES lo que te doy y RESPONDES ÚNICAMENTE con el objeto JSON que se te pide en cada mensaje (en texto
plano, sin markdown, sin fences, sin texto extra).

PREMISA A REFORZAR (tipo de dato base "${prem.tipo_dato}"):
"${prem.contenido}"

Un PESO es un dato de CANTIDAD (cifra/estadística) o de CUALIDAD (observación) que APOYA la premisa, redactado en
español imitando el REGISTRO de estos ejemplos (si son párrafos elaborados y argumentados, redacta así, no frases
sueltas):
${ejemplos}
Cada peso se sustenta en un estudio real: usa el "abstract" del candidato para redactar su "contenido" con datos
CONCRETOS (no inventes cifras que no estén en el abstract) y guarda su "doi".`;
}

function queriesPrompt(userMessage: string, sessionWeights: any[], existing: { contenido: string; doi: string }[]): string {
  const w = sessionWeights.map((x) => ({ id: x.id, tipo: x.tipo_dato, cred: x.credibilidad, contenido: String(x.contenido || '').slice(0, 120) }));
  const ya = existing.map((e) => ({ doi: e.doi, resumen: String(e.contenido || '').slice(0, 90) }));
  return `PETICIÓN DEL USUARIO: "${userMessage}"
PESOS YA CREADOS EN ESTA SESIÓN (${w.length}): ${JSON.stringify(w)}
PESOS QUE YA EXISTEN EN LA PREMISA (de esta y de sesiones anteriores) — NO busques lo mismo ni repitas estos temas/referencias (${ya.length}): ${JSON.stringify(ya)}
Para atender la petición, ¿qué búsquedas en Scopus harías? Cada "query" = 2-3 PALABRAS CLAVE GENERALES en INGLÉS
(ej. "unemployment crime", "youth unemployment", "joblessness social unrest"), nunca frases largas ni español.
Elige ángulos/palabras DISTINTAS a lo ya cubierto para hallar evidencia NUEVA.
Responde SOLO con este JSON: {"queries":["...","..."]} (de 1 a 4 queries). Si la petición NO requiere buscar
(p. ej. solo modificar o eliminar pesos existentes), responde {"queries":[]}.`;
}

function generatePrompt(userMessage: string, candidates: any[], sessionWeights: any[], existing: { contenido: string; doi: string }[]): string {
  const w = sessionWeights.map((x) => ({ id: x.id, tipo: x.tipo_dato, cred: x.credibilidad, contenido: String(x.contenido || '').slice(0, 160) }));
  const ya = existing.map((e) => ({ doi: e.doi, resumen: String(e.contenido || '').slice(0, 90) }));
  return `CANDIDATOS de Scopus (usa su "abstract" para redactar; SOLO puedes usar DOIs de esta lista; ya excluí los DOIs repetidos):
${JSON.stringify(candidates)}
PESOS QUE YA EXISTEN EN LA PREMISA — NO los repitas (mismo dato o misma referencia) (${ya.length}): ${JSON.stringify(ya)}
PESOS DE ESTA SESIÓN que puedes modificar/eliminar (por su "id"): ${JSON.stringify(w)}
PETICIÓN DEL USUARIO: "${userMessage}"
Responde SOLO con este JSON (sin texto fuera del JSON):
{"pesos":[{"contenido":"...","tipo_dato":"cantidad|cualidad","credibilidad":0-100,"doi":"..."}],
 "updates":[{"id":0,"contenido":"...","tipo_dato":"cantidad|cualidad","credibilidad":0}],
 "deletes":[0],
 "message":"resumen breve para el usuario en español"}
- "pesos": de 0 a 5 pesos NUEVOS, cada uno fundamentado en el "abstract" de un candidato (con su "doi"), en español,
  imitando el estilo. Prefiere candidatos con "abstract". No repitas pesos ya creados en la sesión.
  "tipo_dato" debe ser EXACTAMENTE "cantidad" o "cualidad". "credibilidad" debe ser un NÚMERO entero 0-100 (no texto).
- "updates"/"deletes": SOLO si la petición lo pide, sobre pesos de la sesión (por su "id"). Si no aplica, deja [].
- Si no hay candidatos útiles con "abstract", deja "pesos":[] y explica por qué en "message".`;
}

// El modelo a veces escribe "cualitativo"/"cuantitativo" o credibilidad como texto ("alta"/"media"). Normalizamos.
function normTipo(v: any): 'cantidad' | 'cualidad' {
  return String(v || '').toLowerCase().startsWith('cual') ? 'cualidad' : 'cantidad';
}
function normCred(v: any): number {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  const s = String(v || '').toLowerCase();
  if (/alta|high|muy alta/.test(s)) return 85;
  if (/media|medium|moderad/.test(s)) return 60;
  if (/baja|low/.test(s)) return 40;
  return 60;
}

async function callClaudeJSON(input: string, opts: { resume?: string; systemPrompt?: string }): Promise<{ obj: any; sessionId: string }> {
  const { result, sessionId } = await callClaude(input, opts);
  return { obj: parseAction(result), sessionId };
}

// Sugerir, con IA, cuáles pesos EXISTENTES (no conectados) son pertinentes para reforzar la premisa.
// Single-shot: se le pasan todos los candidatos (contenido + referencia) y devuelve los pertinentes.
export async function suggestPesosForPremisa(premisaId: number): Promise<{ suggestions: { id: number; motivo: string }[]; evaluados: number }> {
  const prem = await getPremisaForAgent(premisaId);
  if (!prem) throw new Error('La premisa no existe o no es de tipo premisa.');
  const candidates = await getUnconnectedPesos(premisaId);
  if (!candidates.length) return { suggestions: [], evaluados: 0 };
  const compact = candidates.map((c: any) => ({ id: c.id, nomen: c.nomenclatura, contenido: String(c.contenido || '').slice(0, 450), referencia: formatApaText(c.ref_tipo, c.ref_datos) }));
  const sys = `Eres un evaluador que decide qué PESOS existentes (datos con su referencia bibliográfica) son PERTINENTES
para reforzar una premisa. No tienes herramientas ni acceso a archivos: LEES lo que te doy y respondes ÚNICAMENTE
con un objeto JSON en texto plano (sin markdown ni fences).
PREMISA A REFORZAR: "${prem.contenido}"
Un peso es PERTINENTE si su contenido/dato APOYA o se relaciona directamente con la premisa (mismo fenómeno o
evidencia que la sostiene). Descarta los que no tengan relación clara. Sé exigente: mejor pocos y buenos.`;
  const user = `PESOS CANDIDATOS (no conectados a la premisa):
${JSON.stringify(compact)}
Devuelve SOLO este JSON: {"suggestions":[{"id":<id>,"motivo":"por qué refuerza la premisa, 1 frase en español"}]}.
Incluye ÚNICAMENTE ids que aparezcan en la lista y que sean pertinentes. Si ninguno aplica, {"suggestions":[]}.`;
  const { obj } = await callClaudeJSON(user, { systemPrompt: sys });
  const valid = new Set(candidates.map((c: any) => c.id));
  const suggestions = Array.isArray(obj?.suggestions)
    ? obj.suggestions.filter((s: any) => valid.has(Number(s.id))).map((s: any) => ({ id: Number(s.id), motivo: String(s.motivo || '').slice(0, 220) }))
    : [];
  return { suggestions, evaluados: candidates.length };
}

// Un turno = 3 pasos orquestados por el servidor (evita el loop iterativo que confundía al CLI):
// (1) el modelo propone búsquedas → (2) el servidor busca en Scopus + enriquece abstracts (OpenAlex) →
// (3) el modelo genera los pesos/updates/deletes en un JSON, que el servidor ejecuta con el alcance forzado.
export async function runAgentTurn(params: {
  premisaId: number; sessionId: string; claudeSessionId?: string; userMessage: string;
}): Promise<{ claudeSessionId: string; activity: AgentMsg[]; sessionWeights: any[] }> {
  const { premisaId, sessionId } = params;
  const yearFrom = new Date().getFullYear() - 4;
  const activity: AgentMsg[] = [];
  const prem = await getPremisaForAgent(premisaId);
  if (!prem) throw new Error('La premisa no existe o no es de tipo premisa.');
  let claudeSid = params.claudeSessionId;
  const systemPrompt = claudeSid ? undefined : baseSystemPrompt(prem, await getStyleExamplesPesos(15), yearFrom);
  const before = await agentListSessionWeights(premisaId, sessionId);
  // TODOS los pesos ya en la premisa (de cualquier sesión) → para no repetir referencias/datos.
  const existing = await getPremisaExistingWeights(premisaId);
  const usedDois = new Set(existing.map((e) => e.doi).filter(Boolean));

  // Paso 1 — el modelo propone las búsquedas.
  let queries: string[] = [];
  try {
    const { obj, sessionId: sid } = await callClaudeJSON(queriesPrompt(params.userMessage, before, existing), { resume: claudeSid, systemPrompt });
    claudeSid = sid;
    queries = Array.isArray(obj?.queries) ? obj.queries.map((q: any) => String(q).trim()).filter(Boolean).slice(0, 4) : [];
  } catch (e: any) { activity.push({ role: 'tool', kind: 'error', label: `No se pudieron generar búsquedas: ${e.message}` }); }

  // Paso 2 — el servidor busca en Scopus y enriquece con abstracts (OpenAlex). Dedup por DOI y EXCLUYE DOIs ya usados en la premisa.
  const byDoi = new Map<string, any>();
  for (const q of queries) {
    activity.push({ role: 'tool', kind: 'scopus_search', label: `Buscó en Scopus: “${q}”` });
    try {
      const results = await searchScopus(q, 8, yearFrom);
      const fresh = results.filter((r) => r.doi && !byDoi.has(r.doi) && !usedDois.has(r.doi.toLowerCase())).slice(0, 6);
      const absMap = new Map<string, string>();
      await Promise.all(fresh.map(async (r) => { absMap.set(r.doi, (await openAlexAbstract(r.doi)).slice(0, 1000)); }));
      for (const r of results) {
        if (!r.doi || byDoi.has(r.doi) || usedDois.has(r.doi.toLowerCase())) continue; // salta repetidos y ya usados
        byDoi.set(r.doi, { titulo: r.title, autor: r.creator, anio: r.year, revista: r.journal, doi: r.doi, citas: r.citedby, abstract: absMap.get(r.doi) || '' });
      }
    } catch (e: any) { activity.push({ role: 'tool', kind: 'error', label: `Búsqueda falló: ${e.message}` }); }
  }
  const all = Array.from(byDoi.values());
  const candidates = [...all.filter((c) => c.abstract), ...all.filter((c) => !c.abstract)].slice(0, 12);

  // Paso 3 — el modelo genera pesos/updates/deletes en un solo JSON.
  let gen: any = {};
  try {
    const { obj, sessionId: sid } = await callClaudeJSON(generatePrompt(params.userMessage, candidates, before, existing), { resume: claudeSid });
    claudeSid = sid; gen = obj || {};
  } catch (e: any) { activity.push({ role: 'tool', kind: 'error', label: `No se pudo generar la respuesta: ${e.message}` }); }

  // Paso 4 — el servidor ejecuta (alcance forzado a la sesión/premisa).
  for (const p of Array.isArray(gen.pesos) ? gen.pesos : []) {
    try {
      const tipo = normTipo(p.tipo_dato); const cred = normCred(p.credibilidad);
      const wgt = await agentAddWeight(premisaId, sessionId, { contenido: String(p.contenido || ''), tipoDato: tipo, credibilidad: cred, doi: String(p.doi || '') });
      activity.push({ role: 'tool', kind: 'add_weight', label: `Agregó peso ${wgt.nomenclatura || ''} · ${tipo} · ${Math.round(cred)}%`, text: String(p.contenido || '') });
    } catch (e: any) { activity.push({ role: 'tool', kind: 'error', label: `No se pudo agregar un peso: ${e.message}` }); }
  }
  for (const u of Array.isArray(gen.updates) ? gen.updates : []) {
    try {
      await agentUpdateWeight(premisaId, sessionId, Number(u.id), { contenido: u.contenido != null ? String(u.contenido) : undefined, tipoDato: u.tipo_dato != null ? normTipo(u.tipo_dato) : undefined, credibilidad: u.credibilidad != null ? normCred(u.credibilidad) : undefined });
      activity.push({ role: 'tool', kind: 'update_weight', label: `Modificó el peso id ${u.id}` });
    } catch (e: any) { activity.push({ role: 'tool', kind: 'error', label: e.message }); }
  }
  for (const id of Array.isArray(gen.deletes) ? gen.deletes : []) {
    try { await agentDeleteWeight(premisaId, sessionId, Number(id)); activity.push({ role: 'tool', kind: 'delete_weight', label: `Eliminó el peso id ${id}` }); }
    catch (e: any) { activity.push({ role: 'tool', kind: 'error', label: e.message }); }
  }

  activity.push({ role: 'assistant', text: String(gen.message || '').trim() || 'Listo.' });
  const sessionWeights = await agentListSessionWeights(premisaId, sessionId);
  return { claudeSessionId: claudeSid!, activity, sessionWeights };
}
