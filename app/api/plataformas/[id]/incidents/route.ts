import { rutasIncidentes } from '@/lib/incidents/rutas';

export const dynamic = 'force-dynamic';

/** Lista y alta de incidentes de una plataforma. Ver `lib/incidents/rutas.ts`. */
export const { GET, POST } = rutasIncidentes('plataforma').lista;
