import { pool } from '@/lib/db';
import { accesosDelUsuario, anfitrionDe, PAGADO_HASTA_GCC, PRODUCTOS, type AccesoProducto } from './accesos';

/**
 * PLATAFORMAS CON DETALLE (Fernando, 2026-10-29).
 *
 * Textual: *«que se pueda seleccionar el producto y ver los detalles como cliente […] en un
 * panel derecho, además […] una pestaña de incidentes […] y a la izquierda un panel para elegir
 * entre las soluciones […] y en el panel central todos los productos que tienes acceso para ese
 * tipo de solución»*.
 *
 * - Cada organización del cliente en un producto recibe un id de la plataforma
 *   (`gcc_world.plataformas`, migración 075), que es el dueño de sus incidentes.
 * - La solución sale por el talento: la ficha del producto en el marketplace
 *   (`member_portfolio_items`, enlazada por el anfitrión de `project_url`) lleva un `talent`, y
 *   `solucion_talentos` dice de qué soluciones es ese talento.
 * - Todo se lee de los esquemas de los productos en SOLO LECTURA, como `accesosDelUsuario`.
 */

export type Plataforma = AccesoProducto & {
  id: number;
  talento: string | null;
  soluciones: number[];
  portada: string | null;
};

export type Solucion = { id: number; nombre: string; slug: string };

const ESQUEMA: Record<string, string> = Object.fromEntries(PRODUCTOS.map((p) => [p.clave, p.esquema]));

export async function plataformasDelUsuario(email: string): Promise<{ soluciones: Solucion[]; plataformas: Plataforma[] }> {
  const accesos = Object.values(await accesosDelUsuario(email)).flat();

  const { rows: fichas } = await pool.query(
    `SELECT project_url, talent, COALESCE(images[1], image_url) AS portada
       FROM gcc_world.member_portfolio_items WHERE project_url IS NOT NULL ORDER BY id`,
  ).catch(() => ({ rows: [] as any[] }));
  const porAnfitrion = new Map<string, { talento: string | null; portada: string | null }>();
  for (const f of fichas) {
    const host = anfitrionDe(f.project_url);
    if (host && !porAnfitrion.has(host)) porAnfitrion.set(host, { talento: f.talent ?? null, portada: f.portada ?? null });
  }

  const { rows: sols } = await pool.query(`SELECT id, nombre, slug FROM gcc_world.soluciones ORDER BY orden, id`);
  const { rows: st } = await pool.query(`SELECT solucion_id, talento FROM gcc_world.solucion_talentos`);

  const plataformas: Plataforma[] = [];
  for (const a of accesos) {
    // El id es estable por (producto, slug); el nombre y el contacto se refrescan en cada lectura.
    const { rows: [r] } = await pool.query(
      `INSERT INTO gcc_world.plataformas (producto, slug, nombre, contacto_email) VALUES ($1, $2, $3, $4)
       ON CONFLICT (producto, slug) DO UPDATE SET nombre = EXCLUDED.nombre, contacto_email = EXCLUDED.contacto_email
       RETURNING id`,
      [a.producto, a.slug, a.nombre, email.toLowerCase()],
    );
    const ficha = porAnfitrion.get(anfitrionDe(a.url));
    const talento = ficha?.talento ?? null;
    plataformas.push({
      ...a,
      id: Number(r.id),
      talento,
      soluciones: talento ? st.filter((x: any) => x.talento === talento).map((x: any) => Number(x.solucion_id)) : [],
      portada: ficha?.portada ?? null,
    });
  }

  return {
    soluciones: sols.map((s: any) => ({ id: Number(s.id), nombre: s.nombre, slug: s.slug })),
    plataformas,
  };
}

/**
 * ¿Es del usuario? Se pregunta al esquema del producto EN VIVO —el correo de contacto del
 * inquilino es la llave (ver `accesos.ts`)—, no a la copia de `gcc_world.plataformas`: si el
 * producto cambia de contacto, el anterior deja de ver la plataforma al momento.
 */
export async function esSuPlataforma(owner: { producto?: string; slug?: string }, email: string | null | undefined): Promise<boolean> {
  const esquema = owner.producto ? ESQUEMA[owner.producto] : undefined;
  if (!esquema || !owner.slug || !email) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM ${esquema}.inquilinos WHERE slug = $1 AND lower(contacto_email) = lower($2) LIMIT 1`,
    [owner.slug, email],
  ).catch(() => ({ rows: [] as any[] }));
  return rows.length > 0;
}

export type DetallePlataforma = {
  id: number;
  producto: string;
  productoNombre: string;
  nombre: string;
  slug: string;
  creadoEn: string | null;
  estado: string | null;
  cortesia: boolean;
  suscripcion: { estado: string | null; inicio: string | null; pagadoHasta: string | null; metodoPago: string | null } | null;
  plan: { nombre: string; precio: number | null; moneda: string | null; maxUsuarios: number | null } | null;
  usuariosActivos: number;
  pagos: { periodo: string | null; monto: number; moneda: string | null; metodo: string | null; estado: string | null; pagadoEn: string | null }[];
};

const dia = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** Lo que el panel derecho enseña de una plataforma. `null` si no existe o no es del usuario. */
export async function detallePlataforma(id: number, user: { role: string; email: string }): Promise<DetallePlataforma | null> {
  const { rows: [p] } = await pool.query(`SELECT id, producto, slug, nombre FROM gcc_world.plataformas WHERE id = $1`, [id]);
  if (!p) return null;
  if (user.role !== 'admin' && !(await esSuPlataforma(p, user.email))) return null;
  const esquema = ESQUEMA[p.producto];
  const producto = PRODUCTOS.find((x) => x.clave === p.producto);
  if (!esquema || !producto) return null;

  // Fila entera: `gcc_suscripcion_id` solo existe en algunos esquemas.
  const { rows: [fila] } = await pool.query(
    `SELECT to_jsonb(i) AS i FROM ${esquema}.inquilinos i WHERE slug = $1`, [p.slug]);
  const i = fila?.i;
  if (!i) return null;
  const { rows: [s] } = await pool.query(
    `SELECT s.estado, s.inicio, s.pagado_hasta, s.metodo_pago, to_jsonb(pl) AS plan
       FROM ${esquema}.suscripciones s LEFT JOIN ${esquema}.planes pl ON pl.id = s.plan_id
      WHERE s.inquilino_id = $1 ORDER BY s.id DESC LIMIT 1`, [i.id]);
  const { rows: [u] } = await pool.query(
    `SELECT count(*)::int AS n FROM ${esquema}.usuarios WHERE inquilino_id = $1 AND activo`, [i.id]);

  // La mensualidad cobrada en la plataforma manda sobre la suscripción propia del producto
  // (ver `PAGADO_HASTA_GCC`): de allí salen el inicio, hasta cuándo está pagado y los pagos.
  const gcc = i.gcc_suscripcion_id
    ? (await pool.query(
        `SELECT gs.status, gs.start_date, ${PAGADO_HASTA_GCC} AS pagado_hasta
           FROM (SELECT $1::int AS gcc_suscripcion_id) i JOIN gcc_world.subscriptions gs ON gs.id = i.gcc_suscripcion_id`,
        [i.gcc_suscripcion_id])).rows[0] ?? null
    : null;
  const { rows: pagos } = gcc
    ? await pool.query(
        `SELECT to_char(sp.period, 'YYYY-MM') AS periodo, sp.amount AS monto, gs.currency AS moneda, NULL AS metodo,
                CASE WHEN sp.paid THEN 'PAGADO' ELSE 'PENDIENTE' END AS estado, sp.paid_at AS pagado_en
           FROM gcc_world.subscription_payments sp JOIN gcc_world.subscriptions gs ON gs.id = sp.subscription_id
          WHERE sp.subscription_id = $1 ORDER BY sp.period DESC LIMIT 24`, [i.gcc_suscripcion_id])
    : await pool.query(
        `SELECT periodo, monto, moneda, metodo, estado, pagado_en FROM ${esquema}.pagos_mensuales
          WHERE inquilino_id = $1 ORDER BY periodo DESC NULLS LAST, id DESC LIMIT 24`, [i.id]);

  const plan = s?.plan ?? null;
  return {
    id: Number(p.id),
    producto: p.producto,
    productoNombre: producto.nombre,
    nombre: i.nombre,
    slug: p.slug,
    creadoEn: dia(i.creado_en),
    estado: i.estado ?? null,
    cortesia: Boolean(i.cortesia),
    suscripcion: gcc
      ? { estado: gcc.status ?? null, inicio: dia(gcc.start_date), pagadoHasta: dia(gcc.pagado_hasta), metodoPago: null }
      : s ? { estado: s.estado ?? null, inicio: dia(s.inicio), pagadoHasta: dia(s.pagado_hasta), metodoPago: s.metodo_pago ?? null } : null,
    plan: plan ? {
      nombre: plan.nombre,
      precio: plan.precio_mensual != null ? Number(plan.precio_mensual) : null,
      moneda: plan.moneda ?? null,
      maxUsuarios: plan.max_usuarios != null ? Number(plan.max_usuarios) : null,
    } : null,
    usuariosActivos: u?.n ?? 0,
    pagos: pagos.map((x: any) => ({
      periodo: x.periodo == null ? null : String(x.periodo instanceof Date ? dia(x.periodo) : x.periodo),
      monto: Number(x.monto) || 0,
      moneda: x.moneda ?? null,
      metodo: x.metodo ?? null,
      estado: x.estado ?? null,
      pagadoEn: dia(x.pagado_en),
    })),
  };
}
