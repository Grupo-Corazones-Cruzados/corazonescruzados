import { rutasIncidentes } from '@/lib/incidents/rutas';

export const dynamic = 'force-dynamic';

/** Detalle, edición y borrado de un incidente de una plataforma. Ver `lib/incidents/rutas.ts`. */
export const { GET, PATCH, DELETE } = rutasIncidentes('plataforma').uno;
