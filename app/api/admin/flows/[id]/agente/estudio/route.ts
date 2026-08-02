/**
 * EL ESTUDIO: el pipeline y el contenido de cada fuente.
 *
 * ⚠️ REGLA QUE JUSTIFICA QUE ESTO EXISTA: el contenido de las fuentes lo sirven **las
 * mismas funciones que usa el runner** (`textoConocimiento`, `capacidadesDe`,
 * `clavesPendientes`…). Si esta pantalla y el modelo vieran cosas distintas, el diagrama
 * mentiría — y se usa para decidir.
 *
 *   GET                → el pipeline entero, con el estado real del canal
 *   GET ?fuente=<id>   → el contenido de una fuente
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { asegurarCanal, canalPublico } from '@/lib/agente/canales';
import { capacidadesDe, cacheaElPrefijo, MODELOS_OFRECIDOS } from '@/lib/agente/modelos';
import { textoConocimiento, clavesPendientes, type BloqueConocimiento } from '@/lib/agente/conocimiento';
import { HERRAMIENTAS } from '@/lib/agente/herramientas';
import { construirPipeline, FUENTES } from '@/lib/agente/estudio/pipeline';
import { recortar, type ContenidoFuente } from '@/lib/agente/estudio/tipos';

async function flujoDeAgente(id: string) {
  const { rows: [flujo] } = await pool.query(
    `SELECT id, name, type FROM gcc_world.flows WHERE id = $1`, [id],
  );
  return flujo?.type === 'ai_agent' ? flujo : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const flujo = await flujoDeAgente(id);
  if (!flujo) return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const canal = await asegurarCanal(flujo.id);
  const fuente = new URL(req.url).searchParams.get('fuente');

  if (fuente) {
    const contenido = await resolverFuente(fuente, canal);
    if (!contenido) return NextResponse.json({ error: 'Fuente desconocida' }, { status: 404 });
    return NextResponse.json({ data: contenido });
  }

  const { rows: bloques } = await pool.query(
    `SELECT clave, titulo, contenido, orden, activo FROM gcc_world.agente_conocimiento
      WHERE canal_id = $1 ORDER BY orden, clave`, [canal.id],
  );
  const { rows: [cola] } = await pool.query(
    `SELECT count(*)::int AS n FROM gcc_world.agente_cola c
       JOIN gcc_world.agente_conversaciones v ON v.id = c.conversacion_id
      WHERE v.canal_id = $1 AND c.estado IN ('pendiente','procesando')`, [canal.id],
  );

  return NextResponse.json({
    data: {
      pipeline: construirPipeline({
        botActivo: canal.bot_activo,
        modelo: canal.modelo,
        estadoCanal: canal.estado,
        numero: canal.numero_visible ?? null,
        tieneClaveIA: canal.ia_api_key_cifrada != null,
        tieneToken: canal.wa_token_cifrado != null,
        pendientes: clavesPendientes(bloques as BloqueConocimiento[]),
        enCola: cola?.n ?? 0,
        ultimoError: canal.ultimo_error ?? null,
      }),
      canal: canalPublico(canal),
      capacidades: capacidadesDe(canal.modelo),
      modelos: MODELOS_OFRECIDOS,
      appId: process.env.WHATSAPP_APP_ID ?? null,
      configId: process.env.WHATSAPP_ES_CONFIG_ID ?? null,
    },
  });
}

/* ═══════════════════════ RESOLUTORES ═══════════════════════ */

async function promptDe(canalId: number, tipo: string) {
  const { rows: [p] } = await pool.query(
    `SELECT contenido, version FROM gcc_world.agente_prompts
      WHERE canal_id = $1 AND tipo = $2 AND activo LIMIT 1`, [canalId, tipo],
  );
  return p as { contenido: string; version: number } | undefined;
}

async function resolverFuente(fuenteId: string, canal: any): Promise<ContenidoFuente | null> {
  const meta = FUENTES[fuenteId];
  if (!meta) return null;

  switch (fuenteId) {
    case 'prompt_perfil':
    case 'prompt_reglas':
    case 'prompt_resumen': {
      const tipo = fuenteId === 'prompt_perfil' ? 'perfil_agente'
        : fuenteId === 'prompt_reglas' ? 'reglas_negocio' : 'resumen_conversacion';
      const p = await promptDe(canal.id, tipo);
      const { texto, aviso } = recortar(p?.contenido ?? '');
      return {
        meta: { ...meta, detalle: `${meta.detalle}${p ? ` · versión ${p.version}` : ' · sin escribir'}` },
        texto, aviso,
        // ⚠️ Si se recortó, NO editable: guardar el recorte borraría el resto del prompt.
        editable: aviso ? undefined : { tipo: 'prompt', clave: tipo },
      };
    }

    case 'conocimiento': {
      const { rows } = await pool.query(
        `SELECT clave, titulo, contenido, orden, activo FROM gcc_world.agente_conocimiento
          WHERE canal_id = $1 ORDER BY orden, clave`, [canal.id],
      );
      const bloques = rows as BloqueConocimiento[];
      // La MISMA función que arma el prompt del runner. Ese es el punto.
      const completo = textoConocimiento(bloques);
      const pendientes = clavesPendientes(bloques);
      return {
        meta: { ...meta, detalle: `${meta.detalle} · ${rows.length} bloque(s), ${completo.length.toLocaleString('es-ES')} caracteres` },
        lista: rows.map((b: any) => ({
          id: b.clave, label: b.titulo,
          detalle: b.contenido?.trim() ? `${b.contenido.length.toLocaleString('es-ES')} caracteres` : 'sin rellenar → [PENDIENTE]',
          vacio: !b.contenido?.trim(),
        })),
        aviso: pendientes.length
          ? `${pendientes.length} bloque(s) sin rellenar. El agente escalará esas preguntas a una persona, y la instrucción se añade sola a las reglas — no hay que escribirla.`
          : undefined,
        editable: { tipo: 'conocimiento' },
      };
    }

    case 'parametros':
      return {
        meta,
        json: {
          modelo: canal.modelo,
          max_tokens: canal.max_tokens,
          debounce_segundos: canal.debounce_segundos,
          ventana_mensajes: canal.ventana_mensajes,
          bot_activo: canal.bot_activo,
        },
        editable: { tipo: 'parametros' },
      };

    case 'conexion':
      return {
        meta,
        json: {
          estado: canal.estado,
          numero: canal.numero_visible,
          nombre_verificado: canal.nombre_verificado,
          waba_id: canal.waba_id,
          phone_number_id: canal.phone_number_id,
          coexistencia_verificada: canal.coexistencia_verificada,
        },
        editable: { tipo: 'conexion' },
      };

    case 'secretos':
      return {
        meta,
        lista: [
          { id: 'ia', label: 'Clave de IA del cliente', detalle: canal.ia_api_key_cifrada ? 'guardada y cifrada' : 'sin poner', vacio: !canal.ia_api_key_cifrada },
          { id: 'wa', label: 'Token de WhatsApp', detalle: canal.wa_token_cifrado ? 'guardado y cifrado' : 'lo genera el alta', vacio: !canal.wa_token_cifrado },
          { id: 'pin', label: 'PIN de dos pasos', detalle: canal.pin_cifrado ? 'guardado y cifrado' : 'sin poner', vacio: !canal.pin_cifrado },
        ],
        aviso: 'Se cifran con AES-256-GCM y cada uno queda atado a su canal y a su campo. No se pueden volver a leer: para cambiar uno se escribe otro encima.',
        editable: { tipo: 'parametros' },
      };

    case 'herramientas':
      return { meta, json: HERRAMIENTAS };

    case 'capacidades':
      return { meta, json: capacidadesDe(canal.modelo) };

    case 'historial': {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS mensajes,
                (SELECT count(*)::int FROM gcc_world.agente_conversaciones WHERE canal_id = $1) AS conversaciones
           FROM gcc_world.agente_mensajes m
           JOIN gcc_world.agente_conversaciones v ON v.id = m.conversacion_id
          WHERE v.canal_id = $1`, [canal.id],
      );
      return {
        meta,
        json: {
          ventana_mensajes: canal.ventana_mensajes,
          conversaciones: rows[0]?.conversaciones ?? 0,
          mensajes_guardados: rows[0]?.mensajes ?? 0,
          nota: 'Al modelo van los últimos `ventana_mensajes` de ESTA conversación, más el resumen acumulado si existe.',
        },
      };
    }

    case 'cola': {
      const { rows } = await pool.query(
        `SELECT c.estado, count(*)::int AS n FROM gcc_world.agente_cola c
           JOIN gcc_world.agente_conversaciones v ON v.id = c.conversacion_id
          WHERE v.canal_id = $1 GROUP BY c.estado`, [canal.id],
      );
      return {
        meta,
        lista: rows.length
          ? rows.map((r: any) => ({ id: r.estado, label: r.estado, detalle: `${r.n} trabajo(s)` }))
          : [{ id: 'vacia', label: 'Sin trabajos', detalle: 'nada en cola ahora mismo', vacio: true }],
      };
    }

    case 'uso': {
      const { rows: [u] } = await pool.query(
        `SELECT coalesce(sum(tokens_entrada),0)::int e, coalesce(sum(tokens_salida),0)::int s,
                coalesce(sum(tokens_cache_escritura),0)::int ce, coalesce(sum(tokens_cache_lectura),0)::int cl,
                count(*)::int n
           FROM gcc_world.agente_uso_modelo m
           JOIN gcc_world.agente_conversaciones v ON v.id = m.conversacion_id
          WHERE v.canal_id = $1`, [canal.id],
      );
      return {
        meta,
        json: {
          llamadas: u?.n ?? 0,
          tokens_entrada: u?.e ?? 0,
          tokens_salida: u?.s ?? 0,
          cache_escritura: u?.ce ?? 0,
          cache_lectura: u?.cl ?? 0,
          cachea: cacheaElPrefijo(canal.modelo, 0).cachea,
          nota: 'Si `cache_lectura` se queda en 0 tras varias corridas, el prefijo NO está cacheando y se paga entero cada vez.',
        },
      };
    }

    default:
      return { meta };
  }
}
