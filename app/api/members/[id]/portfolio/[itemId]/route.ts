import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { guardarFotosPortafolio, quitarFotos, puedeEditarPortafolio } from '@/lib/media/portafolio';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id, itemId } = await params;
    if (!(await puedeEditarPortafolio(user, id))) return NextResponse.json({ error: 'No es tu portafolio' }, { status: 403 });
    const body = await req.json();

    // Verify item belongs to this member
    const check = await pool.query(
      `SELECT id FROM gcc_world.member_portfolio_items WHERE id = $1 AND member_id = $2`,
      [itemId, id]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // `demo_*` y `es_suscripcion`: los datos de la demostración pública que se
    // enseñan en el marketplace. Se editan desde Portafolio como todo lo demás — un
    // dato que solo se pueda cambiar por SQL acaba desactualizado.
    const allowed = [
      'title', 'description', 'project_url', 'tags', 'item_type',
      'es_suscripcion', 'demo_url', 'demo_usuario', 'demo_clave', 'demo_nota',
    ];
    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    // Handle price -> cost mapping
    if ('price' in body) {
      fields.push(`cost = $${idx++}`);
      values.push(Number(body.price) || 0);
    }

    // El talento al que pertenece el ítem: decide en qué CV público aparece.
    if ('talent' in body) {
      fields.push(`talent = $${idx++}`);
      values.push(String(body.talent || '').trim() || null);
    }

    // Las fotos van al Drive de la empresa; la portada es siempre la primera.
    let quitadas: string[] = [];
    if ('images' in body) {
      const g = await guardarFotosPortafolio(itemId, body.images);
      quitadas = g.quitadas;
      fields.push(`images = $${idx++}`);
      values.push(g.imagenes);
      fields.push(`image_url = $${idx++}`);
      values.push(g.imagenes[0] || null);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(itemId);

    const { rows } = await pool.query(
      `UPDATE gcc_world.member_portfolio_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *, cost as price, item_type as type`,
      values
    );
    await quitarFotos(quitadas);

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Portfolio PUT error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id, itemId } = await params;
    if (!(await puedeEditarPortafolio(user, id))) return NextResponse.json({ error: 'No es tu portafolio' }, { status: 403 });

    const { rows: [borrado] } = await pool.query(
      `DELETE FROM gcc_world.member_portfolio_items WHERE id = $1 AND member_id = $2 RETURNING COALESCE(images, '{}') AS images`,
      [itemId, id]
    );
    if (borrado) await quitarFotos(borrado.images);

    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error('Portfolio DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
