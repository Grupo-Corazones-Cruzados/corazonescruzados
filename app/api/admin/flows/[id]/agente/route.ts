/**
 * El canal del agente de un flujo: parámetros, estado y secretos.
 *
 * Lo que sale hacia el navegador pasa SIEMPRE por `canalPublico()`, que quita los tres
 * campos cifrados y deja en su lugar un `tiene_*`. Un secreto no viaja al cliente ni
 * aunque quien mire sea admin: no le hace falta para nada de esta pantalla.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser, type TokenPayload } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { pool } from '@/lib/db';
import { asegurarCanal, canalPorFlujo, canalPublico, guardarSecreto } from '@/lib/agente/canales';
import { claveMaestraConfigurada } from '@/lib/agente/cifrado';
import { capacidadesDe, cacheaElPrefijo, MODELOS_OFRECIDOS } from '@/lib/agente/modelos';
import { textoConocimiento, clavesPendientes, type BloqueConocimiento } from '@/lib/agente/conocimiento';

/**
 * ⚠️ El flujo se busca por `flujoPermitido()`, no con un `SELECT` directo: además de
 * traerlo, comprueba que ESTE usuario pueda verlo. Antes bastaba con tener sesión, y eso
 * dejaba a un cliente entrar al agente de otro escribiendo su identificador en la URL.
 */
async function flujoDeAgente(user: TokenPayload | null, id: string) {
  const flujo = await flujoPermitido(user, id);
  return flujo?.type === 'ai_agent' ? flujo : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const flujo = await flujoDeAgente(user, id);
  if (!flujo) return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const canal = await asegurarCanal(flujo.id);

  // Aviso de caché: si el prefijo no llega al mínimo del modelo NO cachea, y la API no
  // lo dice. Se calcula aquí para poder advertirlo antes de que le cueste dinero.
  const { rows: bloques } = await pool.query(
    `SELECT clave, titulo, contenido, orden, activo FROM gcc_world.agente_conocimiento
      WHERE canal_id = $1 ORDER BY orden, clave`, [canal.id],
  );
  const { rows: prompts } = await pool.query(
    `SELECT tipo, contenido FROM gcc_world.agente_prompts WHERE canal_id = $1 AND activo`, [canal.id],
  );
  const perfil = prompts.find((p: any) => p.tipo === 'perfil_agente')?.contenido ?? '';
  const caracteres = perfil.length + textoConocimiento(bloques as BloqueConocimiento[]).length;

  return NextResponse.json({
    data: {
      canal: canalPublico(canal),
      capacidades: capacidadesDe(canal.modelo),
      cache: cacheaElPrefijo(canal.modelo, caracteres),
      pendientes: clavesPendientes(bloques as BloqueConocimiento[]),
      modelos: MODELOS_OFRECIDOS,
      cifradoListo: claveMaestraConfigurada(),
      // Públicos los dos: el SDK de Meta los necesita en el navegador para abrir el
      // alta. El app_secret NO sale de aquí ni aunque quien mire sea admin.
      appId: process.env.WHATSAPP_APP_ID ?? null,
      configId: process.env.WHATSAPP_ES_CONFIG_ID ?? null,
    },
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const flujo = await flujoDeAgente(user, id);
  if (!flujo) return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const canal = await asegurarCanal(flujo.id);
  const body = await req.json();

  // Los parámetros. Los rangos los valida también la base (CHECK), pero un mensaje claro
  // aquí evita que el usuario se coma un error de Postgres.
  const campos: string[] = [];
  const valores: any[] = [];
  const poner = (col: string, val: any) => { campos.push(`${col} = $${campos.length + 1}`); valores.push(val); };

  if (typeof body.modelo === 'string' && body.modelo.trim()) poner('modelo', body.modelo.trim());
  if (typeof body.max_tokens === 'number') poner('max_tokens', Math.max(256, Math.min(128_000, body.max_tokens)));
  if (typeof body.debounce_segundos === 'number') {
    if (body.debounce_segundos < 0 || body.debounce_segundos > 120) {
      return NextResponse.json({ error: 'El debounce va de 0 a 120 segundos' }, { status: 400 });
    }
    poner('debounce_segundos', body.debounce_segundos);
  }
  if (typeof body.ventana_mensajes === 'number') {
    if (body.ventana_mensajes < 2 || body.ventana_mensajes > 400) {
      return NextResponse.json({ error: 'La ventana va de 2 a 400 mensajes' }, { status: 400 });
    }
    poner('ventana_mensajes', body.ventana_mensajes);
  }
  if (typeof body.bot_activo === 'boolean') poner('bot_activo', body.bot_activo);

  if (campos.length) {
    valores.push(canal.id);
    await pool.query(
      `UPDATE gcc_world.agente_canales SET ${campos.join(', ')}, updated_at = NOW() WHERE id = $${valores.length}`,
      valores,
    );
  }

  // La clave de IA la pone el cliente. Se cifra atada a ESTE canal y a ESTE campo.
  if (typeof body.ia_api_key === 'string' && body.ia_api_key.trim()) {
    if (!claveMaestraConfigurada()) {
      return NextResponse.json(
        { error: 'Falta AGENTE_CLAVE_MAESTRA en el servidor: sin ella no se puede guardar un secreto.' },
        { status: 500 },
      );
    }
    await guardarSecreto(canal.id, 'ia_api_key', body.ia_api_key.trim());
  }

  const fresco = await canalPorFlujo(flujo.id);
  return NextResponse.json({ data: canalPublico(fresco!) });
}
