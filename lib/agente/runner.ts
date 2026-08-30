/**
 * El cerebro: procesa una conversación de punta a punta.
 *
 *   reclamar trabajo → armar el prompt → una llamada al modelo → ejecutar SU decisión
 *
 * Una sola llamada, una sola herramienta, sin bucle de tool-use. Las tres herramientas
 * no devuelven información: **son** la decisión, así que un bucle solo sumaría turnos,
 * latencia y costo.
 */

import { pool } from '@/lib/db';
import { canalPorId, secretoDelCanal, anotarError, limpiarError, type Canal } from './canales';
import { ensamblarSistema, type BloqueConocimiento } from './conocimiento';
import { decidir } from './ia';
import { enviarTexto } from './whatsapp';
import { registrarSaliente } from './ingesta';
import { resolverMedios } from './medios';
import { terminar, fallar, type Trabajo } from './cola';
import { MODELO_POR_DEFECTO, RAZONAMIENTO_POR_DEFECTO, esRazonamientoValido } from './modelos';

export interface ResultadoCorrida {
  conversacionId: number;
  accion: 'respondido' | 'callado' | 'escalado' | 'omitido' | 'error';
  detalle?: string;
}

/** Procesa un trabajo de la cola. Nunca lanza: el worker no puede caerse por una conversación. */
export async function procesarTrabajo(trabajo: Trabajo): Promise<ResultadoCorrida> {
  try {
    const r = await procesarConversacion(trabajo.conversacion_id);
    if (r.accion === 'error') {
      const estado = await fallar(trabajo, r.detalle ?? 'error desconocido');
      return { ...r, detalle: `${r.detalle} (${estado})` };
    }
    await terminar(trabajo.id);
    return r;
  } catch (err: any) {
    const estado = await fallar(trabajo, err?.message ?? String(err));
    return { conversacionId: trabajo.conversacion_id, accion: 'error', detalle: `${err?.message} (${estado})` };
  }
}

export async function procesarConversacion(conversacionId: number): Promise<ResultadoCorrida> {
  const { rows: [conv] } = await pool.query(
    `SELECT c.*, ct.wa_id, ct.nombre_perfil
       FROM gcc_world.agente_conversaciones c
       JOIN gcc_world.agente_contactos ct ON ct.id = c.contacto_id
      WHERE c.id = $1`,
    [conversacionId],
  );
  if (!conv) return { conversacionId, accion: 'omitido', detalle: 'La conversación ya no existe' };

  const canal = await canalPorId(conv.canal_id);
  if (!canal) return { conversacionId, accion: 'omitido', detalle: 'El canal ya no existe' };

  const claveIA = secretoDelCanal(canal, 'ia_api_key');
  const tokenWa = secretoDelCanal(canal, 'wa_token');

  /**
   * ⇒ LEER LAS NOTAS DE VOZ Y LAS FOTOS VA **ANTES QUE TODOS LOS CORTES**, y es a propósito.
   *
   * Estaba más abajo, después de comprobar si el agente estaba encendido y si la
   * conversación la llevaba una persona. Consecuencia: en las conversaciones que había
   * tomado alguien del equipo —que en Peter Tours son la mayoría— **no se transcribía
   * nada**. Justo al revés de lo que conviene: la transcripción de una nota de voz le
   * sirve sobre todo a la PERSONA que atiende, que así lee en dos segundos lo que tardaría
   * veinte en escuchar.
   *
   * Así que se convierte siempre, conteste el agente o no. Lo que viene después decide si
   * además se responde; esto solo hace legible lo que llegó.
   *
   * Sigue sin ir en el webhook: ese tiene que devolver 200 rápido o Meta lo deshabilita.
   * Descargar y transcribir son segundos — trabajo de worker.
   */
  if (claveIA) await resolverMedios(conversacionId, claveIA, tokenWa);

  // ── A partir de aquí se decide si además se RESPONDE ────────────────────────

  // Alguien la tomó entre el encolado y ahora. El mensaje quedó guardado —y ya
  // transcrito—; el bot calla.
  if (conv.bot_activo === false) {
    return { conversacionId, accion: 'omitido', detalle: 'La tiene una persona' };
  }
  if (!canal.bot_activo) return { conversacionId, accion: 'omitido', detalle: 'El agente está apagado' };

  if (!claveIA) {
    // La clave la pone el cliente. Si falta o no descifra, se ESCALA y se avisa en el
    // panel: un agente mudo en silencio es el peor final posible.
    await anotarError(canal.id, 'Falta la clave de IA del cliente, o no se pudo descifrar. La conversación pasa a una persona.');
    await escalar(conversacionId, 'Sin clave de IA configurada', '');
    return { conversacionId, accion: 'escalado', detalle: 'Sin clave de IA' };
  }

  // ── El prompt ───────────────────────────────────────────────────────────────
  const [prompts, bloques, historial] = await Promise.all([
    promptsDelCanal(canal.id),
    conocimientoDelCanal(canal.id),
    historialDe(conversacionId, canal.ventana_mensajes),
  ]);

  const sistema = ensamblarSistema({
    perfilAgente: prompts.perfil_agente ?? '',
    bloques,
    reglasNegocio: prompts.reglas_negocio ?? '',
  });

  const mensajes: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  // La memoria larga va primero, como contexto previo a la ventana.
  if (conv.resumen) {
    mensajes.push({ role: 'user', content: `[Resumen de lo hablado antes]\n${conv.resumen}` });
    mensajes.push({ role: 'assistant', content: 'Entendido, sigo desde ahí.' });
  }
  for (const m of historial) {
    mensajes.push({ role: m.direccion === 'entrante' ? 'user' : 'assistant', content: m.texto ?? '(sin texto)' });
  }
  // La API exige que el último turno sea del usuario.
  if (mensajes.length === 0 || mensajes[mensajes.length - 1].role !== 'user') {
    return { conversacionId, accion: 'omitido', detalle: 'No hay ningún mensaje entrante que responder' };
  }

  // ── La decisión ─────────────────────────────────────────────────────────────
  const resultado = await decidir({
    apiKey: claveIA,
    modelo: canal.modelo || MODELO_POR_DEFECTO,
    maxTokens: canal.max_tokens,
    // Un nivel inventado en la base sería un 400 en la primera conversación: se valida
    // aquí, que es donde se lee, y no se confía solo en el CHECK de la tabla.
    esfuerzo: esRazonamientoValido(canal.razonamiento) ? canal.razonamiento : RAZONAMIENTO_POR_DEFECTO,
    // Agrupa las peticiones de este canal para que el prefijo cacheado se reencuentre.
    claveCache: `agente-canal-${canal.id}`,
    perfil: sistema.perfil,
    conocimiento: sistema.conocimiento,
    reglas: sistema.reglas,
    mensajes,
  });

  await registrarUso(conversacionId, resultado.uso, resultado.decision?.tipo);

  if (!resultado.ok || !resultado.decision) {
    await anotarError(canal.id, resultado.motivo ?? 'El modelo no devolvió una decisión');
    return { conversacionId, accion: 'error', detalle: resultado.motivo };
  }
  await limpiarError(canal.id);

  // ── Ejecutar la decisión ────────────────────────────────────────────────────
  const d = resultado.decision;

  if (d.tipo === 'no_responder') {
    await registrarSaliente({
      conversacionId, texto: '', herramienta: 'no_responder', motivo: d.motivo, enviadoOk: true,
    });
    return { conversacionId, accion: 'callado', detalle: d.motivo };
  }

  if (d.tipo === 'escalar_a_humano') {
    if (d.aviso) await mandar(canal, conv.wa_id, d.aviso, tokenWa, conversacionId, 'escalar_a_humano', d.motivo);
    else await registrarSaliente({ conversacionId, texto: '', herramienta: 'escalar_a_humano', motivo: d.motivo, enviadoOk: true });
    await escalar(conversacionId, d.motivo, d.aviso);
    return { conversacionId, accion: 'escalado', detalle: d.motivo };
  }

  const envio = await mandar(canal, conv.wa_id, d.texto, tokenWa, conversacionId, 'responder', null);
  return envio.ok
    ? { conversacionId, accion: 'respondido' }
    : { conversacionId, accion: 'error', detalle: envio.error };
}

/* ── Auxiliares ─────────────────────────────────────────────────────────────── */

async function mandar(
  canal: Canal, para: string, texto: string, token: string | null,
  conversacionId: number, herramienta: string, motivo: string | null,
) {
  if (!token) {
    const error = 'El canal no tiene token de WhatsApp descifrable. Hay que rehacer la conexión.';
    await anotarError(canal.id, error);
    await registrarSaliente({ conversacionId, texto, herramienta, motivo, enviadoOk: false, errorEnvio: error });
    return { ok: false, error };
  }
  const envio = await enviarTexto({
    phoneNumberId: canal.phone_number_id ?? '', token, para, texto,
  });
  await registrarSaliente({
    conversacionId, texto, waMessageId: envio.waMessageId, herramienta, motivo,
    enviadoOk: envio.ok, errorEnvio: envio.error,
  });
  // Que el modelo decidiera bien y el envío fallara son dos cosas distintas: si Meta
  // rechaza, el motivo tiene que verse en el panel o nadie se entera.
  if (!envio.ok) await anotarError(canal.id, envio.error ?? 'Fallo al enviar por WhatsApp');
  return envio;
}

async function escalar(conversacionId: number, motivo: string, _aviso: string) {
  await pool.query(
    `UPDATE gcc_world.agente_conversaciones
        SET bot_activo = false, motivo_escalado = $2, tomada_en = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [conversacionId, motivo],
  );
}

async function promptsDelCanal(canalId: number): Promise<Record<string, string>> {
  const { rows } = await pool.query(
    `SELECT tipo, contenido FROM gcc_world.agente_prompts WHERE canal_id = $1 AND activo`,
    [canalId],
  );
  return Object.fromEntries(rows.map((r: { tipo: string; contenido: string }) => [r.tipo, r.contenido]));
}

async function conocimientoDelCanal(canalId: number): Promise<BloqueConocimiento[]> {
  const { rows } = await pool.query(
    `SELECT clave, titulo, contenido, orden, activo
       FROM gcc_world.agente_conocimiento WHERE canal_id = $1 ORDER BY orden, clave`,
    [canalId],
  );
  return rows as BloqueConocimiento[];
}

/** La ventana de historial, en orden cronológico. */
async function historialDe(conversacionId: number, ventana: number) {
  const { rows } = await pool.query(
    `SELECT direccion, texto FROM (
       SELECT direccion, texto, created_at
         FROM gcc_world.agente_mensajes
        WHERE conversacion_id = $1 AND (texto IS NOT NULL AND texto <> '')
        ORDER BY created_at DESC LIMIT $2
     ) t ORDER BY created_at ASC`,
    [conversacionId, Math.max(2, ventana || 40)],
  );
  return rows as Array<{ direccion: string; texto: string | null }>;
}

async function registrarUso(conversacionId: number, uso: any, herramienta?: string) {
  await pool.query(
    `INSERT INTO gcc_world.agente_uso_modelo
       (conversacion_id, modelo, tokens_entrada, tokens_salida, tokens_cache_escritura, tokens_cache_lectura, herramienta, duracion_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [conversacionId, uso.modelo, uso.tokensEntrada, uso.tokensSalida,
     uso.tokensCacheEscritura, uso.tokensCacheLectura, herramienta ?? null, uso.duracionMs],
  );
}
