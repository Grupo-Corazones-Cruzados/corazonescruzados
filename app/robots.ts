import type { MetadataRoute } from 'next';
import { SITIO } from '@/lib/sitio/contenido';

/**
 * El panel, la API y las páginas de sesión NO se indexan: no aportan nada en un buscador y
 * exponen la forma interna de la aplicación.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/', '/auth/', '/portal/', '/panel/', '/ticket/', '/proforma/', '/proyecto/'],
    }],
    sitemap: `${SITIO.url}/sitemap.xml`,
  };
}
