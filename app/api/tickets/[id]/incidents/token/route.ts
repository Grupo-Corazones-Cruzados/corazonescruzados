import { rutasIncidentes } from '@/lib/incidents/rutas';

export const dynamic = 'force-dynamic';

/** Enlace revocable del portal público de incidentes. Ver `lib/incidents/rutas.ts`. */
export const { POST, DELETE } = rutasIncidentes('ticket').token;
