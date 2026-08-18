import type { MetadataRoute } from 'next';
import { SITIO, ACCESOS } from '@/lib/sitio/contenido';
import { DOCUMENTOS_LEGALES } from '@/lib/negocio/legal';

/**
 * Mapa del sitio. Solo las páginas PÚBLICAS: el panel está tras sesión y no debe indexarse.
 *
 * ── POR QUÉ LAS FECHAS SON LITERALES Y NO `new Date()` (2026-08-03) ────────────
 * Antes todas las entradas llevaban la hora del despliegue. Como este archivo se genera en
 * cada `build`, el resultado era que **cada despliegue juraba que las seis páginas habían
 * cambiado**, aunque solo se hubiese tocado el juego. Una fecha que siempre dice "hoy" no
 * es información: el buscador aprende a ignorarla, y con ella pierde la señal de cuándo
 * algo cambió DE VERDAD.
 *
 * Así que cada página lleva la fecha de la última vez que **cambió su contenido**.
 *
 * ⚠️ **Al reescribir una página, actualiza su fecha aquí.** Es una línea, y es lo que hace
 * que el buscador vuelva a mirarla pronto en vez de dejarla para dentro de unas semanas.
 */
const ULTIMO_CAMBIO = {
  /** Portada. Última reescritura de su contenido. */
  portada: '2026-08-02',
  /**
   * Rehecha como cinco puertas el 2026-08-04; sus cinco páginas comparten esta fecha.
   * El 2026-08-17 cambió de nombre y de dirección: `/negocio` → `/soluciones`. Un cambio de
   * URL es justo lo que hay que anunciar aquí, porque es lo que hace que Google venga a ver
   * la nueva pronto en vez de seguir sirviendo la vieja durante semanas.
   */
  soluciones: '2026-08-17',
  /** `/recursos` → `/desarrollo-humano` el 2026-08-17, y de paso pasó a tema claro. */
  desarrolloHumano: '2026-08-17',
  /** Nació vacía el 2026-08-17 y se llenó el 2026-08-18, cuando ya tenía ámbitos. */
  ambitos: '2026-08-18',
  contacto: '2026-08-02',
  /** Los documentos legales, que se mueven en bloque. */
  legales: '2026-08-02',
} as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITIO.url, lastModified: ULTIMO_CAMBIO.portada, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITIO.url}/soluciones`, lastModified: ULTIMO_CAMBIO.soluciones, changeFrequency: 'monthly', priority: 0.9 },
    // Las cinco puertas salen del mismo sitio que las tarjetas: añadir una en
    // `contenido.ts` la mete en el mapa sin tocar este archivo.
    // ⚠️ Aquí van SOLO las URLs nuevas. Las viejas de `/negocio` redirigen (301) y una URL
    // que redirige no se pone en el mapa del sitio: se le estaría pidiendo a Google que
    // indexe algo que él mismo va a descartar.
    ...ACCESOS.map((a) => ({
      url: `${SITIO.url}/soluciones/${a.id}`,
      lastModified: ULTIMO_CAMBIO.soluciones,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${SITIO.url}/desarrollo-humano`, lastModified: ULTIMO_CAMBIO.desarrolloHumano, changeFrequency: 'monthly', priority: 0.8 },
    // Entra ahora, no antes: hasta el 2026-08-18 era un titular sin contenido, y
    // ofrecerle a Google una página vacía resta al dominio entero.
    { url: `${SITIO.url}/ambitos`, lastModified: ULTIMO_CAMBIO.ambitos, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITIO.url}/contacto`, lastModified: ULTIMO_CAMBIO.contacto, changeFrequency: 'yearly', priority: 0.7 },
    // Los legales salen del registro: uno nuevo entra en el mapa sin tocar este archivo.
    ...DOCUMENTOS_LEGALES.map((d) => ({
      url: `${SITIO.url}${d.ruta}`,
      lastModified: ULTIMO_CAMBIO.legales,
      changeFrequency: 'yearly' as const,
      priority: 0.4,
    })),
  ];
}
