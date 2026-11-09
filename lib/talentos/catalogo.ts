import { pool } from '@/lib/db';
import { ensureEncuadreTables } from '@/lib/centralized/encuadre-db';

/**
 * EL CATÁLOGO DE TALENTOS ES UNO: `gcc_world.gd_talentos` (Fernando, 2026-11-09).
 *
 * Existía dos veces —la lista en código `lib/centralized/talentos.ts` y la tabla, que se edita
 * en Admin ▸ Listas y tiene los embeddings del agente de cotizaciones—, y cada ruta validaba
 * contra la que tenía a mano. En cuanto alguien añadiera o renombrara un talento en Admin, los
 * tickets lo habrían rechazado por «no existe en el catálogo». Ahora valida y ofrece opciones
 * la TABLA; la lista en código solo siembra la tabla cuando nace vacía (`ensureEncuadreTables`).
 *
 * Se guarda en memoria del proceso un minuto: las rutas que validan se llaman en cada alta y
 * la lista cambia rarísima vez (un talento recién añadido en Admin vale, a lo sumo, un minuto
 * después). Si la lectura falla se olvida, no se queda vacía: un catálogo vacío rechazaría
 * todo y parecería un error del usuario.
 */

const VIGENCIA_MS = 60_000;
let cache: { nombres: string[]; set: Set<string>; hasta: number } | null = null;
let leyendo: Promise<{ nombres: string[]; set: Set<string> }> | null = null;

async function leer(): Promise<{ nombres: string[]; set: Set<string> }> {
  if (cache && cache.hasta > Date.now()) return cache;
  if (leyendo) return leyendo;
  leyendo = (async () => {
    await ensureEncuadreTables();
    const { rows } = await pool.query(`SELECT nombre FROM gcc_world.gd_talentos ORDER BY LOWER(nombre)`);
    const nombres = rows.map((r: any) => String(r.nombre));
    cache = { nombres, set: new Set(nombres), hasta: Date.now() + VIGENCIA_MS };
    return cache;
  })().finally(() => { leyendo = null; });
  return leyendo;
}

/** Los nombres del catálogo, en orden alfabético. */
export async function talentosDelCatalogo(): Promise<string[]> {
  return (await leer()).nombres;
}

/** Conjunto para validar. */
export async function conjuntoDeTalentos(): Promise<Set<string>> {
  return (await leer()).set;
}

/**
 * Deja solo los talentos que existen en el catálogo, sin repetidos y en el orden recibido.
 * Acepta cualquier cosa (cuerpo de una petición): lo que no es texto se descarta.
 */
export async function filtrarAlCatalogo(input: unknown): Promise<string[]> {
  if (!Array.isArray(input)) return [];
  const set = await conjuntoDeTalentos();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (t && set.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

