import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { regenerateRidePdf } from '@/lib/integrations/sri';

/**
 * Re-renderiza y **persiste** el RIDE de todas las facturas ya autorizadas.
 *
 * La descarga (`/api/invoices/[id]/pdf`) ya re-renderiza al vuelo, pero el PDF que
 * viaja por correo (envío inicial y reenvío) sale de `pdf_data`. Cuando cambia la
 * plantilla del RIDE —p. ej. la leyenda del régimen tributario— esas copias guardadas
 * quedan con el texto viejo: esto las pone al día.
 *
 * Solo toca `pdf_data`, que es una representación derivada; no altera el XML firmado
 * ni la autorización del SRI, que son inmutables.
 *
 * POST { dryRun?: boolean }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { dryRun } = await req.json().catch(() => ({ dryRun: false }));

    const { rows } = await pool.query(
      `SELECT id, invoice_number FROM gcc_world.invoices
        WHERE authorization_number IS NOT NULL
        ORDER BY id`
    );

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, candidatas: rows.length, facturas: rows.map((r: any) => r.invoice_number) });
    }

    const fallidas: { id: number; invoice_number: string; error: string }[] = [];
    let actualizadas = 0;

    for (const row of rows) {
      try {
        await regenerateRidePdf(Number(row.id), true);
        actualizadas++;
      } catch (err: any) {
        // Una factura con datos incompletos no debe abortar el resto: se reporta y se sigue.
        fallidas.push({ id: Number(row.id), invoice_number: row.invoice_number, error: err.message });
      }
    }

    return NextResponse.json({ ok: true, candidatas: rows.length, actualizadas, fallidas });
  } catch (err: any) {
    console.error('Regenerate RIDEs error:', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
