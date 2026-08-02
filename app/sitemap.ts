import type { MetadataRoute } from 'next';
import { SITIO } from '@/lib/sitio/contenido';

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
    { url: `${SITIO.url}/legal`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITIO.url}/legal/whatsapp`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
