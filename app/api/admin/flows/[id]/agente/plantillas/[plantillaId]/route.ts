/** Editar o borrar UNA plantilla. Ambas cosas ocurren también en Meta, no solo aquí. */

import { NextResponse } from 'next/server';
import { getCurrentUser, type TokenPayload } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { pool } from '@/lib/db';
import { asegurarCanal, secretoDelCanal } from '@/lib/agente/canales';
import { editarPlantilla, borrarPlantilla } from '@/lib/agente/meta';
import { cuantasVariables } from '@/lib/agente/plantillas';

async function plantillaDelFlujo(user: TokenPayload | null, flowId: string, plantillaId: string) {
  const flujo = await flujoPermitido(user, flowId);
  if (flujo?.type !== 'ai_agent') return null;
  const canal = await asegurarCanal(flujo.id);
  const { rows: [p] } = await pool.query(
    `SELECT * FROM gcc_world.agente_plantillas WHERE id = $1 AND canal_id = $2`,
    [plantillaId, canal.id],
  );
  return p ? { canal, plantilla: p } : null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; plantillaId: string }> }) {
  const user = await getCurrentUser();
  const { id, plantillaId } = await params;
  const encontrada = await plantillaDelFlujo(user, id, plantillaId);
  if (!encontrada) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  const { canal, plantilla } = encontrada;

  const { cuerpo, pie, variables, ejemplos, categoria } = await req.json();
  if (!cuerpo) return NextResponse.json({ error: 'Falta el cuerpo del mensaje.' }, { status: 400 });

  const cuantas = cuantasVariables(cuerpo);
  const vars: string[] = Array.isArray(variables) ? variables.slice(0, cuantas) : [];
  if (vars.length !== cuantas) {
    return NextResponse.json(
      { error: `El mensaje usa ${cuantas} variable(s) y solo se asignaron ${vars.length}.` },
      { status: 400 },
    );
  }

  // ⚠️ Meta NO deja cambiar el nombre ni el idioma: eso sería otra plantilla. Y editar el
  // contenido la devuelve a revisión, así que una aprobada deja de poder enviarse hasta
  // que la vuelvan a aprobar. Se avisa arriba, en la interfaz.
  const token = secretoDelCanal(canal, 'wa_token');
  if (plantilla.meta_id && token) {
    const componentes: any[] = [{
      type: 'BODY', text: cuerpo,
      ...(cuantas ? { example: { body_text: [ejemplos?.length ? ejemplos : vars.map(() => 'Ejemplo')] } } : {}),
    }];
    if (pie) componentes.push({ type: 'FOOTER', text: pie });
    try {
      await editarPlantilla(String(plantilla.meta_id), token, {
        components: componentes, ...(categoria ? { category: categoria } : {}),
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? 'Meta rechazó el cambio' }, { status: 400 });
    }
  }

  const { rows: [fila] } = await pool.query(
    `UPDATE gcc_world.agente_plantillas
        SET cuerpo = $2, pie = $3, variables = $4, categoria = COALESCE($5, categoria),
            estado = CASE WHEN meta_id IS NULL THEN estado ELSE 'PENDING' END,
            motivo_rechazo = NULL, updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [plantilla.id, cuerpo, pie ?? null, JSON.stringify(vars), categoria ?? null],
  );

  return NextResponse.json({ data: fila });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; plantillaId: string }> }) {
  const user = await getCurrentUser();
  const { id, plantillaId } = await params;
  const encontrada = await plantillaDelFlujo(user, id, plantillaId);
  if (!encontrada) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  const { canal, plantilla } = encontrada;

  const token = secretoDelCanal(canal, 'wa_token');
  if (plantilla.meta_id && token && canal.waba_id) {
    try {
      await borrarPlantilla(String(canal.waba_id), token, plantilla.nombre);
    } catch (e: any) {
      // Si en Meta ya no está, borrar aquí es lo correcto: se sigue.
      if (!/does not exist|not found/i.test(String(e?.message))) {
        return NextResponse.json({ error: e?.message ?? 'Meta no dejó borrarla' }, { status: 400 });
      }
    }
  }

  await pool.query(`DELETE FROM gcc_world.agente_plantillas WHERE id = $1`, [plantilla.id]);
  return NextResponse.json({ ok: true });
}
