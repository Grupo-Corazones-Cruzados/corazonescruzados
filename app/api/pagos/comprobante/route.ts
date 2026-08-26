/**
 * EL CLIENTE SUBE SU COMPROBANTE DE TRANSFERENCIA.
 *
 * Con esto el cobro pasa a **`awaiting`**: no está pagado, está esperando que una persona
 * mire el banco y lo confirme. Es el único camino de la pasarela donde el dinero lo da por
 * bueno un humano, y es así porque **una imagen no prueba nada**.
 *
 * ⚠️ NO SE EMITE FACTURA AQUÍ. Se emite al confirmar. Emitirla al recibir el comprobante
 * sería facturar sobre la palabra del que paga.
 *
 * Quién puede subirlo: el mismo que podía pagar ese cobro —cliente con sesión o portador del
 * enlace—, comprobado con `autorizarCobro` y contra el intento, no contra lo que diga el
 * navegador.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizarCobro, SinAcceso } from '@/lib/pagos/acceso';
import { registrarComprobante } from '@/lib/pagos/intentos';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const intentId = Number(form.get('intent_id'));
    const archivo = form.get('archivo') as File | null;
    const link = String(form.get('link') || '') || null;

    if (!intentId) return NextResponse.json({ error: 'Falta el cobro.' }, { status: 400 });
    if (!archivo) return NextResponse.json({ error: 'Adjunta el comprobante.' }, { status: 400 });

    // ⚠️ EL COBRO MANDA SOBRE LO QUE VENGA DEL NAVEGADOR. Se lee de la base a qué pertenece
    // este intento y se comprueba el acceso CONTRA ESO; fiarse del `project_id` que llegue
    // en el formulario dejaría subir un comprobante al cobro de otra persona.
    const { rows: [intento] } = await pool.query(
      `SELECT id, source_type, source_id, stage_id, status FROM gcc_world.payment_intents WHERE id = $1`,
      [intentId],
    );
    if (!intento) return NextResponse.json({ error: 'Este cobro no existe.' }, { status: 404 });

    await autorizarCobro({
      sourceType: intento.source_type,
      sourceId: intento.source_id,
      stageId: intento.stage_id,
      linkToken: link,
    });

    await registrarComprobante({
      intentId,
      archivo: {
        nombre: archivo.name || 'comprobante',
        tipo: archivo.type,
        bytes: Buffer.from(await archivo.arrayBuffer()),
      },
      referencia: String(form.get('referencia') || ''),
      banco: String(form.get('banco') || ''),
    });

    return NextResponse.json({
      ok: true,
      estado: 'awaiting',
      mensaje: 'Recibimos tu comprobante. En cuanto verifiquemos la transferencia te enviamos la factura.',
    });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[pagos] comprobante:', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
