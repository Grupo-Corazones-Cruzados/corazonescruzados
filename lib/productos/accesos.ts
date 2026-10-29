import { pool } from '@/lib/db';
import { anfitrionDe, type AccesoProducto } from './tipos';

export { anfitrionDe, type AccesoProducto };

/**
 * QUÉ PRODUCTOS PUEDE ABRIR UN USUARIO DESDE EL MARKETPLACE (Fernando, 2026-09-16:
 * «debería existir un botón para los usuarios que tienen acceso al producto, es decir
 * que han pagado su suscripción hasta máximo 30 días de retraso de pago […] para
 * acceder a su tenant desde allí»).
 *
 * Los cuatro productos viven en esquemas propios del MISMO Postgres, y cada uno
 * tiene su tabla `inquilinos` con `contacto_email`, `cortesia` y su `suscripciones`
 * con `pagado_hasta`. Esta es la ÚNICA lectura que la plataforma hace de esos
 * esquemas, y es de solo lectura: la fuente de verdad del acceso sigue siendo la
 * puerta de cada producto.
 *
 * LA LLAVE ES EL CORREO: el `contacto_email` del inquilino (el que el equipo GCC
 * escribe al darlo de alta en /gcc) tiene que ser el correo de la cuenta en GCC
 * World. Los `users.id` son UUID y `gcc_cliente_id` de los productos es entero: no
 * sirve de enlace.
 *
 * Se considera con acceso: no suspendido, no escaparate (la demostración ya tiene
 * su propio botón) y (del grupo, o pagado hasta hace como mucho 30 días).
 */
/**
 * Cada producto vive en su subdominio (Fernando, 2026-09-21): el nombre del oficio, a
 * secas, igual que el servicio de Railway y el esquema de la base. Las direcciones
 * `*.up.railway.app` siguen respondiendo, pero ya no se enlazan desde ningún sitio.
 */
export const PRODUCTOS = [
  { clave: 'reservas', esquema: 'reservas', nombre: 'Gestión de Reservas', url: 'https://reservas.grupocc.org' },
  { clave: 'pedidos', esquema: 'pedidos', nombre: 'Gestión de Pedidos', url: 'https://pedidos.grupocc.org' },
  { clave: 'catering', esquema: 'catering', nombre: 'Gestión de Catering', url: 'https://catering.grupocc.org' },
  { clave: 'planificaciones', esquema: 'planificaciones', nombre: 'Planificación de Clases', url: 'https://planificaciones.grupocc.org' },
  // Quinto producto (2026-09-23): la sección «Automatizaciones» dejó de vivir dentro de la
  // plataforma y pasó a venderse como los demás, 5 $/mes con el agente de IA y las
  // campañas de correo y de WhatsApp dentro.
  { clave: 'automatizaciones', esquema: 'automatizaciones', nombre: 'Automatizaciones de WhatsApp', url: 'https://automatizaciones.grupocc.org', gccSuscripcion: true },
] as const;

/**
 * Hasta cuándo está pagado un inquilino cuya mensualidad se cobra en la plataforma
 * (`inquilinos.gcc_suscripcion_id`, solo Automatizaciones): el último día del último mes
 * pagado en `gcc_world.subscription_payments`. Es la misma regla que la puerta del producto
 * (`productos/automatizaciones/src/lib/suscripcionGcc.ts`); su `suscripciones.pagado_hasta`
 * se queda en la prueba del alta y NO se lee —por eso Peter Tours salía «vencida» con octubre
 * pagado (Fernando, 2026-10-29).
 */
export const PAGADO_HASTA_GCC = `(
  SELECT (date_trunc('month', max(sp.period)) + interval '1 month - 1 day')::date
    FROM gcc_world.subscription_payments sp
    JOIN gcc_world.subscriptions gs ON gs.id = sp.subscription_id
   WHERE sp.subscription_id = i.gcc_suscripcion_id AND sp.paid AND gs.status <> 'cancelled')`;

export const DIAS_DE_GRACIA = 30;

export async function accesosDelUsuario(email: string | null | undefined): Promise<Record<string, AccesoProducto[]>> {
  const salida: Record<string, AccesoProducto[]> = {};
  if (!email) return salida;
  for (const p of PRODUCTOS) {
    try {
      const pagadoHasta = 'gccSuscripcion' in p
        ? `CASE WHEN i.gcc_suscripcion_id IS NULL THEN s.pagado_hasta ELSE ${PAGADO_HASTA_GCC} END`
        : 's.pagado_hasta';
      const { rows } = await pool.query(
        `SELECT * FROM (
           SELECT i.slug, i.nombre, i.cortesia, ${pagadoHasta} AS pagado_hasta
             FROM ${p.esquema}.inquilinos i
             LEFT JOIN ${p.esquema}.suscripciones s ON s.inquilino_id = i.id
            WHERE lower(i.contacto_email) = lower($1)
              AND i.estado <> 'SUSPENDIDO'
              AND NOT i.solo_lectura
         ) x
          WHERE cortesia OR (pagado_hasta IS NOT NULL AND pagado_hasta >= current_date - $2::int)
          ORDER BY nombre`,
        [email, DIAS_DE_GRACIA],
      );
      if (!rows.length) continue;
      const hoy = new Date();
      hoy.setUTCHours(0, 0, 0, 0);
      salida[anfitrionDe(p.url)] = rows.map((r: { slug: string; nombre: string; cortesia: boolean; pagado_hasta: Date | null }) => {
        const pagado = r.pagado_hasta ? new Date(r.pagado_hasta) : null;
        const retraso = r.cortesia || !pagado ? null : Math.max(0, Math.round((hoy.getTime() - pagado.getTime()) / 86_400_000));
        return {
          producto: p.clave,
          productoNombre: p.nombre,
          slug: r.slug,
          nombre: r.nombre,
          url: `${p.url}/${r.slug}`,
          cortesia: Boolean(r.cortesia),
          pagadoHasta: pagado ? pagado.toISOString().slice(0, 10) : null,
          diasDeRetraso: retraso,
        };
      });
    } catch (e: any) {
      // Un esquema que no existe (base de desarrollo) no rompe el marketplace.
      console.error(`[productos/accesos] ${p.esquema}:`, e?.message);
    }
  }
  return salida;
}
