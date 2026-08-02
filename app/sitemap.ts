import type { MetadataRoute } from 'next';
import { SITIO } from '@/lib/sitio/contenido';
import { DOCUMENTOS_LEGALES } from '@/lib/negocio/legal';

/**
 * Mapa del sitio. Solo las páginas PÚBLICAS: el panel está tras sesión y no debe indexarse.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();
  return [
    { url: SITIO.url, lastModified: ahora, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITIO.url}/negocio`, lastModified: ahora, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITIO.url}/recursos`, lastModified: ahora, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITIO.url}/contacto`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.7 },
    // Los legales salen del registro: uno nuevo entra en el mapa sin tocar este archivo.
    ...DOCUMENTOS_LEGALES.map((d) => ({
      url: `${SITIO.url}${d.ruta}`,
      lastModified: ahora,
      changeFrequency: 'yearly' as const,
      priority: 0.4,
    })),
  ];
}
