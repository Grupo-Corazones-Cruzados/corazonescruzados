import { rutasIncidentes } from '@/lib/incidents/rutas';

export const dynamic = 'force-dynamic';

/** Lista y alta de incidentes. La lógica, común a proyecto y ticket, vive en `lib/incidents/rutas.ts`. */
export const { GET, POST } = rutasIncidentes('ticket').lista;
