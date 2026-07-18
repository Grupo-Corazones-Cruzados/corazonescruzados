// Agente de VISIÓN (Claude CLI, headless) del sistema "Percepción Social".
// Recibe un conjunto de imágenes de un entorno, las escribe a un directorio temporal y spawnea el
// binario `claude` del servidor local con la tool Read HABILITADA (Claude Code lee imágenes
// visualmente). El modelo distingue objetos/animales/personas y sus propiedades y responde con UN JSON.
//
// Local-only: el binario `claude` corre como child_process DENTRO del server Next.js local (igual que
// el agente de pesos de Gestión de Datos). No funciona en Railway (no hay binario ni sesión autenticada).
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export type PsCategoria = 'objeto' | 'animal' | 'persona';
export interface PsElementoIA {
  categoria: PsCategoria;
  nombre: string;
  confianza: number | null;
  resumen: string | null;
  propiedades: Record<string, string>;
  foto_indices: number[];
}
export interface PsAnalisisIA {
  resumen: string;
  elementos: PsElementoIA[];
}

export interface ImagenEntrada {
  buffer: Buffer;
  ext: string; // 'jpg' | 'png' | 'webp' ...
}

function claudeBin(): string {
  if (process.env.CLAUDE_CLI_PATH) return process.env.CLAUDE_CLI_PATH;
  const home = process.env.HOME || '';
  const cand = home ? `${home}/.local/bin/claude` : '';
  if (cand && existsSync(cand)) return cand;
  return 'claude';
}

const SYSTEM_PROMPT = `Eres un analista de PERCEPCIÓN VISUAL del entorno físico. NO eres un asistente de
programación y NO estás trabajando en ningún repositorio. Tu tarea es OBSERVAR imágenes y describir lo que hay.

Recibes una o varias IMÁGENES (indicadas por su ruta de archivo) que muestran un MISMO entorno real. Usa la
herramienta Read con la ruta de CADA imagen para VERLA. Luego identifica TODOS los elementos presentes en el
conjunto, clasificándolos en una de tres categorías: "objeto", "animal" o "persona".

Para cada elemento entrega TODAS las propiedades que puedas reconocer VISUALMENTE (por ejemplo: color, material,
tamaño aparente, estado/condición, cantidad, posición, y según el caso: especie o raza del animal, color/tipo de
cabello, vestimenta, edad aparente, etc.). Sé exhaustivo pero NO inventes lo que no se ve; si dudas, baja la
confianza. Agrupa objetos idénticos en un solo elemento e indica la cantidad en sus propiedades.

Tu ÚNICA salida es UN objeto JSON en texto plano (sin markdown, sin fences, sin texto adicional) con esta forma:
{"resumen":"descripción breve del entorno en español (1-2 frases)",
 "elementos":[
   {"categoria":"objeto|animal|persona","nombre":"nombre corto en español","confianza":0-100,
    "resumen":"observación breve del elemento en español","propiedades":{"clave":"valor", ...},
    "foto_indices":[1,2]}
 ]}
Reglas: "categoria" DEBE ser exactamente "objeto", "animal" o "persona". "confianza" es un entero 0-100.
"propiedades" es un objeto de pares clave→valor en español (valores como texto). "foto_indices" lista en qué
fotos (numeradas desde 1) aparece el elemento. Si no reconoces ningún elemento, devuelve "elementos":[].`;

/** Extrae el objeto JSON de la respuesta del modelo (tolerante a fences/prosa). */
function parseJson(raw: string): any {
  const s = (raw || '').trim();
  try { return JSON.parse(s); } catch { /* sigue */ }
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* sigue */ } }
  return {};
}

function normCategoria(v: any): PsCategoria {
  const s = String(v || '').toLowerCase();
  if (s.startsWith('anim')) return 'animal';
  if (s.startsWith('pers') || s.startsWith('hum') || s.startsWith('gente')) return 'persona';
  return 'objeto';
}
function normConfianza(v: any): number | null {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  const s = String(v || '').toLowerCase();
  if (/alta|high/.test(s)) return 85;
  if (/media|medium|moderad/.test(s)) return 60;
  if (/baja|low/.test(s)) return 40;
  return null;
}
function normPropiedades(v: any): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val == null) continue;
    const key = String(k).trim().slice(0, 60);
    if (!key) continue;
    out[key] = Array.isArray(val) ? val.map(String).join(', ').slice(0, 240) : String(val).slice(0, 240);
  }
  return out;
}
function normFotoIndices(v: any, max: number): number[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(
    v.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= max),
  ));
}

/**
 * Analiza el conjunto de imágenes con el Claude CLI local. Escribe las imágenes a un directorio
 * temporal, invoca `claude` permitiendo la tool Read, y devuelve el análisis normalizado.
 */
export async function analizarEntorno(imagenes: ImagenEntrada[]): Promise<PsAnalisisIA> {
  if (!imagenes.length) return { resumen: '', elementos: [] };
  const dir = mkdtempSync(join(tmpdir(), 'ps-vision-'));
  try {
    const paths: string[] = [];
    imagenes.forEach((img, i) => {
      const ext = /^(jpg|jpeg|png|webp|gif)$/.test(img.ext) ? img.ext : 'jpg';
      const p = join(dir, `foto-${i + 1}.${ext}`);
      writeFileSync(p, img.buffer);
      paths.push(p);
    });
    const lista = paths.map((p, i) => `Foto ${i + 1}: ${p}`).join('\n');
    const input = `Analiza el entorno mostrado en estas ${paths.length} foto(s). Usa la herramienta Read en CADA una de estas rutas para verlas y luego responde SOLO con el objeto JSON de elementos (sin texto adicional):\n${lista}`;

    const args = [
      '-p', input,
      '--output-format', 'json',
      '--permission-mode', 'bypassPermissions',
      '--system-prompt', SYSTEM_PROMPT,
      // Read HABILITADA (para VER las imágenes). El resto de herramientas deshabilitadas: solo observa y responde JSON.
      '--allowedTools', 'Read',
      '--disallowedTools', 'WebSearch', 'WebFetch', 'Bash', 'Write', 'Edit', 'Task', 'Glob', 'Grep',
    ];
    // cwd = el propio dir temporal (sin CLAUDE.md del repo) y con acceso a las imágenes.
    const { stdout } = await execFileAsync(claudeBin(), args, { maxBuffer: 32 * 1024 * 1024, timeout: 280000, cwd: dir });
    const parsed = JSON.parse(stdout);
    if (parsed.is_error) throw new Error(parsed.result || 'Error del agente Claude');
    const obj = parseJson(parsed.result ?? '');
    const elementosRaw = Array.isArray(obj?.elementos) ? obj.elementos : [];
    const elementos: PsElementoIA[] = elementosRaw
      .filter((e: any) => e && (e.nombre != null))
      .map((e: any) => ({
        categoria: normCategoria(e.categoria),
        nombre: String(e.nombre).trim().slice(0, 120),
        confianza: normConfianza(e.confianza),
        resumen: e.resumen != null ? String(e.resumen).slice(0, 400) : null,
        propiedades: normPropiedades(e.propiedades),
        foto_indices: normFotoIndices(e.foto_indices, paths.length),
      }))
      .filter((e: PsElementoIA) => e.nombre);
    return { resumen: String(obj?.resumen || '').slice(0, 600), elementos };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}
