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
  { clave: 'automatizaciones', esquema: 'automatizaciones', nombre: 'Automatizaciones de WhatsApp', url: 'https://automatizaciones.grupocc.org' },
] as const;

export const DIAS_DE_GRACIA = 30;

export async function accesosDelUsuario(email: string | null | undefined): Promise<Record<string, AccesoProducto[]>> {
  const salida: Record<string, AccesoProducto[]> = {};
  if (!email) return salida;
  for (const p of PRODUCTOS) {
    try {
      const { rows } = await pool.query(
        `SELECT i.slug, i.nombre, i.cortesia, s.pagado_hasta
           FROM ${p.esquema}.inquilinos i
           LEFT JOIN ${p.esquema}.suscripciones s ON s.inquilino_id = i.id
          WHERE lower(i.contacto_email) = lower($1)
            AND i.estado <> 'SUSPENDIDO'
            AND NOT i.solo_lectura
            AND (i.cortesia OR (s.pagado_hasta IS NOT NULL AND s.pagado_hasta >= current_date - $2::int))
          ORDER BY i.nombre`,
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
