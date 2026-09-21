import { slugify } from '@/lib/centralized/systems';

/**
 * LA DIRECCIÓN DE CADA REGISTRO DEL MARKETPLACE (Fernando, 2026-09-21):
 * `/marketplace-publico/gestion-de-reservas` abre el catálogo con la pestaña y el
 * registro ya elegidos, para que quien reciba el enlace vea el panel derecho con
 * «Quiero suscribirme». El slug sale del TÍTULO —ni los ítems de portafolio ni los
 * proyectos tienen columna de slug— y se calcula igual aquí y en el servidor, que
 * es lo que permite enlazar sin guardar nada nuevo.
 */
export const slugDeTitulo = (titulo: string | null | undefined) => slugify(titulo || '');

export const RUTA_MARKETPLACE_PUBLICO = '/marketplace-publico';

export const enlaceDeItem = (item: { title?: string | null }) =>
  `${RUTA_MARKETPLACE_PUBLICO}/${slugDeTitulo(item.title)}`;
