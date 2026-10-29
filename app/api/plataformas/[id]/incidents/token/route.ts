import { rutasIncidentes } from '@/lib/incidents/rutas';

export const dynamic = 'force-dynamic';

/** Enlace del portal público de una plataforma. Ver `lib/incidents/rutas.ts`. */
export const { POST, DELETE } = rutasIncidentes('plataforma').token;
