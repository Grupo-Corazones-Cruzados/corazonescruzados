/**
 * Lo que el catálogo del marketplace (componente de CLIENTE) necesita de los
 * accesos a productos, sin arrastrar `pg`: el tipo y el anfitrión de una dirección.
 */
export type AccesoProducto = {
  producto: 'reservas' | 'pedidos' | 'catering' | 'planificaciones' | 'automatizaciones';
  /** El nombre del producto («Gestión de Pedidos»), para el módulo Plataformas. */
  productoNombre: string;
  slug: string;
  nombre: string;
  url: string;
  cortesia: boolean;
  pagadoHasta: string | null;
  /** Días de retraso del pago (0 si está al día); null si es del grupo. */
  diasDeRetraso: number | null;
};

const CLAVES_PRODUCTO = ['reservas', 'pedidos', 'catering', 'planificaciones', 'automatizaciones'] as const;

/**
 * QUÉ PRODUCTO ES UNA DIRECCIÓN, que es como el catálogo y Accesos lo identifican (`project_url`).
 * Reconoce la dirección nueva (`/p/<producto>`, bajo GCC World) y las viejas (`<producto>.grupocc.org` y
 * `<producto>-….up.railway.app`), que siguen en `member_portfolio_items`. Antes era el anfitrión: con
 * todos los productos bajo `app.grupocc.org` habrían chocado (2026-11-08).
 */
export const productoDeUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  try {
    const u = new URL(url, 'https://app.grupocc.org');
    const ruta = u.pathname.match(/^\/p\/([a-z]+)/)?.[1];
    if (ruta) return ruta;
    const h = u.hostname;
    return CLAVES_PRODUCTO.find((c) => h === `${c}.grupocc.org` || (h.startsWith(`${c}-`) && h.endsWith('.up.railway.app'))) ?? h;
  } catch {
    return '';
  }
};

/**
 * DÓNDE VIVE CADA PRODUCTO. Desde el 2026-11-08 (Fernando: sin subdominios) los cinco se sirven desde
 * GCC World bajo `/p/<producto>` (la pasarela `app/p/[producto]`), con dirección RELATIVA.
 */
export const PRODUCTOS = [
  { clave: 'reservas', esquema: 'reservas', nombre: 'Gestión de Reservas', url: '/p/reservas' },
  { clave: 'pedidos', esquema: 'pedidos', nombre: 'Gestión de Pedidos', url: '/p/pedidos' },
  { clave: 'catering', esquema: 'catering', nombre: 'Gestión de Catering', url: '/p/catering' },
  { clave: 'planificaciones', esquema: 'planificaciones', nombre: 'Planificación de Clases', url: '/p/planificaciones' },
  // Quinto producto (2026-09-23): la sección «Automatizaciones» dejó de vivir dentro de la
  // plataforma y pasó a venderse como los demás, 5 $/mes con el agente de IA y las
  // campañas de correo y de WhatsApp dentro.
  { clave: 'automatizaciones', esquema: 'automatizaciones', nombre: 'Automatizaciones de WhatsApp', url: '/p/automatizaciones', gccSuscripcion: true },
] as const;
