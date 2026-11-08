'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import { contextoEscritura, type Contexto } from '@/lib/inquilino';
import { esRazonamientoValido } from '@/lib/agente/modelos';
import { guardarSecreto } from '@/lib/agente/canales';
import { claveMaestraConfigurada } from '@/lib/agente/cifrado';

export type Resultado = { ok: true; mensaje?: string } | { ok: false; error: string };

/**
 * EL ESTUDIO DEL AGENTE: lo que el agente sabe y cómo se comporta.
 *
 * ⚠️ TODO PASA POR EL CANAL DEL INQUILINO. Ninguna acción recibe un `canalId` del
 * navegador y se fía: se resuelve siempre con `WHERE inquilino_id = …`, porque un
 * identificador de canal ajeno cambiaría las instrucciones del agente de OTRO cliente.
 */
type CanalDelCliente =
  | { ok: false; error: string }
  | { ok: true; canal: any; ctx: Contexto };

async function canalDelCliente(slug: string, minimo: 'OPERADOR' | 'ADMIN' = 'ADMIN'): Promise<CanalDelCliente> {
  const permiso = await contextoEscritura(slug, minimo);
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { rows: [canal] } = await pool.query(
    `SELECT c.* FROM canales c WHERE c.inquilino_id = $1 ORDER BY c.id LIMIT 1`,
    [permiso.ctx.inquilino.id],
  );
  if (!canal) return { ok: false, error: 'Todavía no hay un número conectado.' };
  return { ok: true, canal, ctx: permiso.ctx };
}

/**
 * Guardar una instrucción del agente.
 *
 * ⭐ NO SE SOBRESCRIBE: se crea una VERSIÓN NUEVA y se desactiva la anterior. Las
 * instrucciones son lo que hace que el agente diga lo que dice; si alguien empeora el
 * texto y no hay a qué volver, la única salida es reescribirlo de memoria. El índice
 * parcial `prompts_canal_tipo_activo_uq` garantiza que solo una esté activa.
 */
export async function guardarInstruccion(
  slug: string,
  tipo: 'perfil_agente' | 'reglas_negocio' | 'resumen_conversacion',
  contenido: string,
): Promise<Resultado> {
  const r = await canalDelCliente(slug);
  if (!r.ok) return { ok: false, error: r.error };
  const texto = String(contenido ?? '').trim();
  if (!texto) return { ok: false, error: 'La instrucción no puede quedar vacía.' };

  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    // Primero se apaga la vigente: el índice único solo admite una activa por tipo.
    await cli.query(`UPDATE prompts SET activo = false WHERE canal_id = $1 AND tipo = $2 AND activo`,
      [r.canal.id, tipo]);
    await cli.query(
      `INSERT INTO prompts (inquilino_id, canal_id, tipo, version, contenido, activo)
       SELECT c.inquilino_id, c.id, $2,
              COALESCE((SELECT MAX(version) FROM prompts WHERE canal_id = c.id AND tipo = $2), 0) + 1,
              $3, true
         FROM canales c WHERE c.id = $1`,
      [r.canal.id, tipo, texto]);
    await cli.query('COMMIT');
  } catch (e: any) {
    await cli.query('ROLLBACK');
    return { ok: false, error: e?.message ?? 'No se pudo guardar.' };
  } finally {
    cli.release();
  }

  revalidatePath(`/${slug}/estudio`);
  return { ok: true, mensaje: 'Guardado como versión nueva; la anterior queda archivada.' };
}

/** Crear o actualizar un bloque de conocimiento. La clave lo identifica dentro del canal. */
export async function guardarConocimiento(slug: string, datos: FormData): Promise<Resultado> {
  const r = await canalDelCliente(slug, 'OPERADOR');
  if (!r.ok) return { ok: false, error: r.error };

  const clave = String(datos.get('clave') || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const titulo = String(datos.get('titulo') || '').trim();
  const contenido = String(datos.get('contenido') || '').trim();
  const activo = String(datos.get('activo') || '') === 'on';
  if (!clave || !titulo) return { ok: false, error: 'Hacen falta una clave y un título.' };

  await pool.query(
    `INSERT INTO conocimiento (inquilino_id, canal_id, clave, titulo, contenido, orden, activo)
     SELECT c.inquilino_id, c.id, $2, $3, $4,
            COALESCE((SELECT MAX(orden) FROM conocimiento WHERE canal_id = c.id), 0) + 1, $5
       FROM canales c WHERE c.id = $1
     ON CONFLICT (canal_id, clave) DO UPDATE
       SET titulo = EXCLUDED.titulo, contenido = EXCLUDED.contenido,
           activo = EXCLUDED.activo, actualizado_en = NOW()`,
    [r.canal.id, clave, titulo, contenido, activo],
  );
  revalidatePath(`/${slug}/estudio`);
  return { ok: true, mensaje: `Bloque «${titulo}» guardado.` };
}

export async function borrarConocimiento(slug: string, clave: string): Promise<Resultado> {
  const r = await canalDelCliente(slug);
  if (!r.ok) return { ok: false, error: r.error };
  await pool.query(`DELETE FROM conocimiento WHERE canal_id = $1 AND clave = $2`, [r.canal.id, clave]);
  revalidatePath(`/${slug}/estudio`);
  return { ok: true, mensaje: 'Bloque borrado.' };
}

/**
 * Los ajustes del agente.
 *
 * `botActivo` es el interruptor general: apagarlo calla al agente en TODO el número, sin
 * tocar las conversaciones una por una. Es el botón que se busca cuando algo va mal.
 */
export async function guardarAjustes(slug: string, datos: FormData): Promise<Resultado> {
  const r = await canalDelCliente(slug);
  if (!r.ok) return { ok: false, error: r.error };

  const razonamiento = String(datos.get('razonamiento') || 'low');
  if (!esRazonamientoValido(razonamiento)) return { ok: false, error: 'Ese nivel de razonamiento no existe.' };
  const debounce = Math.max(0, Math.min(120, Number(datos.get('debounce') || 8)));
  const ventana = Math.max(5, Math.min(200, Number(datos.get('ventana') || 40)));
  const botActivo = String(datos.get('botActivo') || '') === 'on';

  await pool.query(
    `UPDATE canales SET razonamiento = $2, debounce_segundos = $3, ventana_mensajes = $4,
            bot_activo = $5, actualizado_en = NOW()
      WHERE id = $1`,
    [r.canal.id, razonamiento, debounce, ventana, botActivo],
  );
  revalidatePath(`/${slug}/estudio`);
  return {
    ok: true,
    mensaje: botActivo ? 'Ajustes guardados. El agente está encendido.' : 'Ajustes guardados. El agente queda APAGADO en todo el número.',
  };
}

/**
 * LA CLAVE DE OPENAI DEL CLIENTE (Fernando, 2026-11-08: «no puedo configurar o actualizar
 * la api key»). El agente usa la clave DEL CANAL (`ia_api_key_cifrada`), no la del
 * servidor: cada cliente paga su consumo. Existía la columna y el aviso «hay que
 * actualizarla en el Estudio», pero ninguna pantalla la escribía.
 *
 * Se PRUEBA antes de guardarla, contra el modelo del canal: una clave que no vale,
 * guardada, deja al agente pasando todo a una persona sin que se sepa por qué. Nunca
 * vuelve al navegador; la pantalla solo ve sus cuatro últimos caracteres.
 */
export async function guardarClaveIA(slug: string, datos: FormData): Promise<Resultado> {
  const r = await canalDelCliente(slug);
  if (!r.ok) return { ok: false, error: r.error };
  if (!claveMaestraConfigurada()) return { ok: false, error: 'Falta AGENTE_CLAVE_MAESTRA en el servidor: no se puede guardar la clave cifrada.' };

  const clave = String(datos.get('clave') || '').trim();
  if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(clave))
    return { ok: false, error: 'Eso no parece una clave de OpenAI: empieza por «sk-» y es larga.' };

  let res: Response;
  try {
    res = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(r.canal.modelo)}`, {
      headers: { Authorization: `Bearer ${clave}` },
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'No se pudo hablar con OpenAI para comprobar la clave. Inténtalo de nuevo.' };
  }
  if (res.status === 401) return { ok: false, error: 'OpenAI dice que esa clave no es válida (401).' };
  if (res.status === 403 || res.status === 404)
    return { ok: false, error: `La clave es válida, pero no tiene acceso al modelo ${r.canal.modelo}. Revisa el proyecto de la clave en OpenAI.` };
  if (res.status === 429) return { ok: false, error: 'La cuenta de OpenAI de esa clave no tiene saldo o llegó a su límite (429).' };
  if (!res.ok) return { ok: false, error: `OpenAI respondió ${res.status} al comprobar la clave.` };

  await guardarSecreto(r.canal.id, 'ia_api_key', clave);
  // Si el último fallo era por la clave, ya no aplica.
  await pool.query(
    `UPDATE canales SET ultimo_error = NULL, ultimo_error_en = NULL
      WHERE id = $1 AND ultimo_error ILIKE '%clave de IA%'`,
    [r.canal.id],
  );
  revalidatePath(`/${slug}/estudio`);
  return { ok: true, mensaje: 'Clave de OpenAI comprobada y guardada.' };
}
