import { rutasIncidentes } from '@/lib/incidents/rutas';

export const dynamic = 'force-dynamic';

/** Catálogo de categorías → subcategorías. Ver `lib/incidents/rutas.ts`. */
export const { GET, PUT } = rutasIncidentes('ticket').categorias;
