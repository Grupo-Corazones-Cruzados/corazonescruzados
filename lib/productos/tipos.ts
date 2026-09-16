/**
 * Lo que el catálogo del marketplace (componente de CLIENTE) necesita de los
 * accesos a productos, sin arrastrar `pg`: el tipo y el anfitrión de una dirección.
 */
export type AccesoProducto = {
  producto: 'reservas' | 'pedidos' | 'catering' | 'planificaciones';
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
