import { rutasIncidentes } from '@/lib/incidents/rutas';

export const dynamic = 'force-dynamic';

/** Catálogo de categorías de una plataforma. Ver `lib/incidents/rutas.ts`. */
export const { GET, PUT } = rutasIncidentes('plataforma').categorias;
