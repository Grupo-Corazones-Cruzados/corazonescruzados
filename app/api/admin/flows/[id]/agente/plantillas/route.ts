/**
 * Las plantillas de un canal: listarlas, sincronizarlas con Meta y crear una nueva.
 *
 * La lista sale del espejo local (`agente_plantillas`) porque llamar a Meta en cada carga
 * de pantalla es lento y gasta cuota. El estado real se refresca con `?sincronizar=1`, que
 * es lo que hace el botón de actualizar.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser, type TokenPayload } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { pool } from '@/lib/db';
import { asegurarCanal, secretoDelCanal } from '@/lib/agente/canales';
import { crearPlantilla } from '@/lib/agente/meta';
import { sincronizarPlantillas, cuantasVariables, COLUMNAS_CONTACTO } from '@/lib/agente/plantillas';

async function canalDelFlujo(user: TokenPayload | null, id: string) {
  const flujo = await flujoPermitido(user, id);
  if (flujo?.type !== 'ai_agent') return null;
  return asegurarCanal(flujo.id);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const canal = await canalDelFlujo(user, id);
  if (!canal) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const sincronizar = new URL(req.url).searchParams.get('sincronizar') === '1';
  let aviso: string | null = null;

  if (sincronizar) {
    try {
      await sincronizarPlantillas(canal);
    } catch (e: any) {
      // Que la sincronización falle no puede dejar la pantalla en blanco: se devuelve lo
      // que hay guardado y se dice por qué está viejo.
      aviso = e?.message ?? 'No se pudo consultar a Meta';
    }
  }

  // Cada plantilla viene con las listas que usa y a cuánta gente CON TELÉFONO llega. El
  // recuento se calcula aquí y no en la pantalla: contar contactos en el navegador
  // obligaría a traerse todos los contactos de todas las listas para pintar un número.
  const { rows } = await pool.query(
    `SELECT p.*,
            (SELECT COUNT(*)::int FROM gcc_world.agente_envios e WHERE e.plantilla_id = p.id) AS envios,
            COALESCE((SELECT json_agg(pl.lista_id) FROM gcc_world.agente_plantilla_listas pl
                       WHERE pl.plantilla_id = p.id), '[]') AS listas,
            (SELECT COUNT(DISTINCT c.id)::int
               FROM gcc_world.agente_plantilla_listas pl
               JOIN gcc_world.flow_contacts c ON c.list_id = pl.lista_id
              WHERE pl.plantilla_id = p.id AND c.phone IS NOT NULL AND TRIM(c.phone) <> '') AS destinatarios
       FROM gcc_world.agente_plantillas p
      WHERE p.canal_id = $1 ORDER BY p.updated_at DESC`,
    [canal.id],
  );

  return NextResponse.json({
    data: rows,
    columnas: COLUMNAS_CONTACTO,
    conectado: !!canal.waba_id && canal.estado === 'conectado',
    aviso,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const canal = await canalDelFlujo(user, id);
  if (!canal) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const { nombre, idioma, categoria, cuerpo, pie, variables, ejemplos } = await req.json();

  if (!nombre || !cuerpo) {
    return NextResponse.json({ error: 'Hacen falta el nombre y el cuerpo del mensaje.' }, { status: 400 });
  }
  // Meta solo acepta minúsculas, números y guion bajo. Decirlo aquí evita un viaje a Meta
  // para volver con un error críptico.
  if (!/^[a-z0-9_]+$/.test(nombre)) {
    return NextResponse.json(
      { error: 'El nombre solo admite minúsculas, números y guion bajo. Por ejemplo: confirmacion_atencion.' },
      { status: 400 },
    );
  }

  const cuantas = cuantasVariables(cuerpo);
  const vars: string[] = Array.isArray(variables) ? variables.slice(0, cuantas) : [];
  if (vars.length !== cuantas) {
    return NextResponse.json(
      { error: `El mensaje usa ${cuantas} variable(s) y solo se asignaron ${vars.length}. Elige de dónde sale cada una.` },
      { status: 400 },
    );
  }

  const token = secretoDelCanal(canal, 'wa_token');
  if (!token || !canal.waba_id) {
    return NextResponse.json(
      { error: 'El canal no tiene un número conectado: sin eso no hay cuenta donde crear la plantilla.' },
      { status: 400 },
    );
  }

  // ⚠️ El ejemplo de cada variable es OBLIGATORIO para Meta: sin él rechaza el alta. Se
  // manda lo que el formulario usó para previsualizar, que ya es un valor verosímil.
  const componentes: any[] = [{
    type: 'BODY',
    text: cuerpo,
    ...(cuantas ? { example: { body_text: [ejemplos?.length ? ejemplos : vars.map(() => 'Ejemplo')] } } : {}),
  }];
  if (pie) componentes.push({ type: 'FOOTER', text: pie });

  let metaId: string | null = null;
  let estado = 'local';
  try {
    const r: any = await crearPlantilla(String(canal.waba_id), token, {
      name: nombre, language: idioma || 'es', category: categoria || 'UTILITY', components: componentes,
    });
    metaId = r?.id ?? null;
    estado = r?.status ?? 'PENDING';
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Meta rechazó la plantilla' }, { status: 400 });
  }

  const { rows: [fila] } = await pool.query(
    `INSERT INTO gcc_world.agente_plantillas
       (canal_id, meta_id, nombre, idioma, categoria, estado, cuerpo, pie, variables, sincronizado_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (canal_id, nombre, idioma) DO UPDATE
        SET meta_id = EXCLUDED.meta_id, estado = EXCLUDED.estado, cuerpo = EXCLUDED.cuerpo,
            pie = EXCLUDED.pie, variables = EXCLUDED.variables, categoria = EXCLUDED.categoria,
            motivo_rechazo = NULL, sincronizado_en = NOW(), updated_at = NOW()
     RETURNING *`,
    [canal.id, metaId, nombre, idioma || 'es', categoria || 'UTILITY', estado, cuerpo, pie ?? null,
     JSON.stringify(vars)],
  );

  return NextResponse.json({ data: fila }, { status: 201 });
}
