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

/** El anfitrión de la dirección de un producto, que es como el catálogo lo identifica (`project_url`). */
export const anfitrionDe = (url: string | null | undefined) => {
  try {
    return url ? new URL(url).hostname : '';
  } catch {
    return '';
  }
};

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
