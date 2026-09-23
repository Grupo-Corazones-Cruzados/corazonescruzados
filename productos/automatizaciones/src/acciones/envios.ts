'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import { contextoEscritura, type Contexto } from '@/lib/inquilino';
import { sincronizarPlantillas, enviarAListado, sePuedeEnviar } from '@/lib/agente/plantillas';

export type Resultado =
  | { ok: true; mensaje?: string }
  | { ok: false; error: string };

type CanalDelCliente =
  | { ok: false; error: string }
  | { ok: true; canal: any; ctx: Contexto };

async function canalDelCliente(slug: string, minimo: 'OPERADOR' | 'ADMIN' = 'OPERADOR'): Promise<CanalDelCliente> {
  const permiso = await contextoEscritura(slug, minimo);
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { rows: [canal] } = await pool.query(
    `SELECT c.* FROM canales c WHERE c.inquilino_id = $1 ORDER BY c.id LIMIT 1`,
    [permiso.ctx.inquilino.id],
  );
  if (!canal) return { ok: false, error: 'Todavía no hay un número conectado.' };
  return { ok: true, canal, ctx: permiso.ctx };
}

/** Traer de Meta el estado de las plantillas. Lo nuestro (el mapeo de variables) no se pisa. */
export async function sincronizar(slug: string): Promise<Resultado> {
  const r = await canalDelCliente(slug);
  if (!r.ok) return { ok: false, error: r.error };
  try {
    const { total, nuevas } = await sincronizarPlantillas(r.canal);
    revalidatePath(`/${slug}/envios`);
    return { ok: true, mensaje: `${total} plantillas en Meta, ${nuevas} nuevas por aquí.` };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'No se pudo sincronizar con Meta.' };
  }
}

/**
 * LANZAR UN ENVÍO MASIVO.
 *
 * ⚠️ Es la acción que más daño puede hacer del producto: manda mensajes de verdad a
 * personas de verdad y **no se puede deshacer**. Por eso comprueba tres cosas antes, y las
 * tres por separado para poder decir cuál falla:
 *   · que la plantilla sea de ESTE cliente,
 *   · que Meta la tenga APROBADA —una en revisión no sale—,
 *   · y que la lista sea suya y tenga a alguien con teléfono.
 */
export async function lanzar(slug: string, plantillaId: number, listaId: number): Promise<Resultado> {
  const r = await canalDelCliente(slug);
  if (!r.ok) return { ok: false, error: r.error };

  const { rows: [plantilla] } = await pool.query(
    `SELECT * FROM plantillas_agente WHERE id = $1 AND canal_id = $2`,
    [plantillaId, r.canal.id],
  );
  if (!plantilla) return { ok: false, error: 'Esa plantilla no existe.' };
  if (!sePuedeEnviar(plantilla.estado))
    return { ok: false, error: `La plantilla está en «${plantilla.estado}»: solo se puede enviar una aprobada por Meta.` };

  const { rows: [lista] } = await pool.query(
    `SELECT l.id, l.nombre,
            (SELECT COUNT(*)::int FROM contactos_lista c
              WHERE c.lista_id = l.id AND c.telefono IS NOT NULL AND TRIM(c.telefono) <> '') con_telefono
       FROM listas_contactos l WHERE l.id = $1 AND l.inquilino_id = $2`,
    [listaId, r.ctx.inquilino.id],
  );
  if (!lista) return { ok: false, error: 'Esa lista no existe.' };
  if (lista.con_telefono === 0)
    return { ok: false, error: `«${lista.nombre}» no tiene ningún contacto con teléfono.` };

  try {
    const { enviados, fallidos } = await enviarAListado(r.canal, plantilla, listaId, r.ctx.sesion.uid);
    revalidatePath(`/${slug}/envios`);
    return {
      ok: true,
      mensaje: fallidos
        ? `Enviados ${enviados}, fallaron ${fallidos}. Mira el detalle en el historial.`
        : `Enviados ${enviados} mensajes.`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'El envío no pudo arrancar.' };
  }
}
