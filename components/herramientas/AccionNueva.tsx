'use client';

import { createContext } from 'react';
import type { AccionLista } from '@/components/ui/BarraLista';

/**
 * EL BOTÓN «GENERAR…» DE ENLACE Y ENTREGA DE UN SOLO USO cuando su historial se muestra dentro de la
 * herramienta (apps, 2026-11-08). Sus páginas de historial no pueden recibir props (son páginas de
 * Next), así que la página de Herramientas les pasa la acción por contexto y ellas la ponen en su
 * barra, al lado del buscador, igual que el resto de herramientas. Fuera de ahí no hay acción.
 */
export const AccionNuevaCtx = createContext<AccionLista | null>(null);
