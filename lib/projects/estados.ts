/**
 * Estados de un proyecto: la etiqueta que se lee y el tono de su `PixelBadge`. Definición
 * única — antes vivía solo dentro de la lista de Proyectos.
 */
export const PROJECT_STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  cotizacion: 'info', cotizacion_rechazada: 'error', draft: 'default', open: 'info', in_progress: 'warning',
  review: 'info', in_review: 'info', completed: 'success', closed: 'success', cancelled: 'error',
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  cotizacion: 'Cotización', cotizacion_rechazada: 'Rechazada', draft: 'Borrador', open: 'Abierto', in_progress: 'En progreso',
  review: 'En revisión', in_review: 'En revisión', completed: 'Completado', closed: 'Cerrado', cancelled: 'Cancelado',
};
