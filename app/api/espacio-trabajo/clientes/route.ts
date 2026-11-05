import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { rechazo } from '@/lib/espacio-trabajo/guardia';

export const dynamic = 'force-dynamic';

/** Los clientes a quienes se les puede mandar un diagrama. Dentro de las apps no hay cookie de GCC World, por eso no sirve `/api/enlaces/clientes`. */
export async function GET(req: Request) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const { rows } = await pool.query(
    `SELECT c.id, COALESCE(c.name, c.full_name, u.email) AS nombre, u.email
       FROM gcc_world.clients c JOIN gcc_world.users u ON u.id = c.user_id
      WHERE c.account_type = 'client'
      ORDER BY 2`,
  );
  return NextResponse.json({ clientes: rows });
}
