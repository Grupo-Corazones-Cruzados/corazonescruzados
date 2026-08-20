import type { MetadataRoute } from 'next';
import { SITIO, ACCESOS, DESARROLLO } from '@/lib/sitio/contenido';
import { listarSoluciones } from '@/lib/soluciones';
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
   * Cambió de nombre y dirección dos veces: `/negocio` → `/soluciones` (08-17) → `/clientes`
   * (08-18, al ceder el nombre «Soluciones» a la página de ámbitos). Un cambio de
   * URL es justo lo que hay que anunciar aquí, porque es lo que hace que Google venga a ver
   * la nueva pronto en vez de seguir sirviendo la vieja durante semanas.
   */
  /** Las cinco puertas: `/negocio` → `/soluciones` → `/clientes` (08-17 y 08-18). */
  clientes: '2026-08-18',
  /** `/recursos` → `/desarrollo-humano` el 2026-08-17, y de paso pasó a tema claro. */
  desarrolloHumano: '2026-08-17',
  /**
   * La página de los ámbitos. Nació vacía en `/soluciones` el 2026-08-17, se llenó el 08-18 y
   * ese mismo día pasó a llamarse **Soluciones** y a vivir en `/soluciones`.
   */
  soluciones: '2026-08-18',
  contacto: '2026-08-02',
  /** Los documentos legales, que se mueven en bloque. */
  legales: '2026-08-02',
} as const;

/**
 * ⚠️ ASÍNCRONO DESDE EL 2026-08-18, porque las páginas de talento salen de la BASE.
 *
 * Si la base no contesta durante el build, el mapa se genera **sin ellas** en vez de tumbar
 * el despliegue. Un mapa incompleto se arregla solo en la siguiente compilación; un
 * despliegue caído, no.
 */
async function paginasDeTalento(): Promise<MetadataRoute.Sitemap> {
  try {
    const soluciones = await listarSoluciones();
    return soluciones.flatMap((a) =>
      a.talentos.map((t) => ({
        url: `${SITIO.url}/soluciones/${t.slug}`,
        lastModified: ULTIMO_CAMBIO.soluciones,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    );
  } catch {
    return [];
  }
}

/**
 * ⚠️ SE GENERA EN CADA PETICIÓN, Y NO ES UN CAPRICHO.
 *
 * Las páginas de talento salen de la base, y **el build de Railway no llega a la base**: si
 * el mapa se generara al compilar, saldría siempre sin ellas —comprobado en producción el
 * 2026-08-18, donde faltaban—.
 *
 * Se probó con `revalidate = 3600` y no basta: **la primera versión, la del build, es la
 * equivocada**, y se serviría durante una hora después de cada despliegue. Justo cuando un
 * buscador viene a mirar qué cambió.
 *
 * El coste es una consulta por petición, y un mapa del sitio lo pide un rastreador muy de
 * vez en cuando. Barato a cambio de que nunca mienta.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: SITIO.url, lastModified: ULTIMO_CAMBIO.portada, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITIO.url}/clientes`, lastModified: ULTIMO_CAMBIO.clientes, changeFrequency: 'monthly', priority: 0.9 },
    // Las cinco puertas salen del mismo sitio que las tarjetas: añadir una en
    // `contenido.ts` la mete en el mapa sin tocar este archivo.
    // ⚠️ Aquí van SOLO las URLs nuevas. Las viejas de `/negocio` redirigen (301) y una URL
    // que redirige no se pone en el mapa del sitio: se le estaría pidiendo a Google que
    // indexe algo que él mismo va a descartar.
    ...ACCESOS.map((a) => ({
      url: `${SITIO.url}/clientes/${a.id}`,
      lastModified: ULTIMO_CAMBIO.clientes,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${SITIO.url}/desarrollo-humano`, lastModified: ULTIMO_CAMBIO.desarrolloHumano, changeFrequency: 'monthly', priority: 0.8 },
    // Sus cuatro secciones, igual que las de `/clientes`: desde el 2026-08-19 cada una es su
    // propia página con su contenido, y no un bloque escondido detrás de un clic.
    ...DESARROLLO.map((a) => ({
      url: `${SITIO.url}/desarrollo-humano/${a.id}`,
      lastModified: ULTIMO_CAMBIO.desarrolloHumano,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // Entra ahora, no antes: hasta el 2026-08-18 era un titular sin contenido, y
    // ofrecerle a Google una página vacía resta al dominio entero.
    { url: `${SITIO.url}/soluciones`, lastModified: ULTIMO_CAMBIO.soluciones, changeFrequency: 'weekly', priority: 0.8 },
    // Una entrada por talento: cada uno es su propia página desde el 2026-08-18, y esto es
    // lo que hace que Google las descubra sin depender de que rastree el panel izquierdo.
    ...(await paginasDeTalento()),
    // ⚠️ `/contacto` se borró el 2026-08-20 y ahora redirige a `/legal`. Fuera del mapa: una
    // URL que redirige no se pone aquí — sería pedirle a Google que indexe algo que él mismo
    // va a descartar. Es la misma regla que ya aplican las viejas de `/negocio`.
    // Los legales salen del registro: uno nuevo entra en el mapa sin tocar este archivo.
    ...DOCUMENTOS_LEGALES.map((d) => ({
      url: `${SITIO.url}${d.ruta}`,
      lastModified: ULTIMO_CAMBIO.legales,
      changeFrequency: 'yearly' as const,
      priority: 0.4,
    })),
  ];
}
