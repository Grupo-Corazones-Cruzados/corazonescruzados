import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { SITIO } from '@/lib/sitio/contenido';
import './globals.css';

/**
 * `metadataBase` es lo que convierte las rutas relativas de cada página —`canonical`,
 * `openGraph.url`— en URLs absolutas. Sin él, Next avisa y las etiquetas salen a medias.
 *
 * `title.template` deja que cada página ponga solo su parte y el nombre del negocio se
 * añada solo, en vez de repetirlo en cada archivo.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITIO.url),
  /**
   * ⭐ ESTO ES LO QUE SE VE EN GOOGLE AL BUSCAR EL PROYECTO, y hasta el 2026-08-20 estaba
   * viejo. Lo vio Fernando en un resultado real: decía *«De ahí nacen los servicios que
   * ofrecemos: plataformas de gestión a medida, agentes de atención con IA…»*, que es el
   * encuadre de proveedor de tecnología **que él mismo corrigió el 2026-08-02** por estar del
   * revés. Sobrevivió aquí porque nadie lo tocó: la portada no declara metadatos propios, así
   * que hereda estos, y son los únicos del sitio que quedaban sin revisar —el resto de páginas
   * declaran los suyos, comprobado—.
   *
   * ── DE DÓNDE SALE EL TEXTO NUEVO ─────────────────────────────────────────────
   * No lo he inventado: es **su propia definición del proyecto**, la que escribió a mano en
   * `DESARROLLO → el-proyecto.descripcion`, comprimida para caber en un resultado de búsqueda:
   *
   *   *«un proyecto de desarrollo humano que propone el reconocimiento y aprovechamiento de
   *   las condiciones; las cuales se usan como ancla para el progreso mental, laboral, social,
   *   y corporal de los sujetos, tanto de forma individual como colectiva»*
   *
   * Pidió que **describiera el proyecto y no le hablara a nadie**, y esa frase hace justo eso.
   *
   * ⚠️ **Los límites no son un capricho de estilo, son de Google**: el título se corta a unos
   * 60 caracteres y la descripción a unos 155. Medidos: 56 y 154. Si alguien los alarga, lo
   * que sobre no se pierde — desaparece del resultado, que es peor.
   *
   * ⚠️ Y esta descripción **solo gobierna la portada**. Las demás páginas tienen la suya; si
   * alguna se quedara sin ella, heredaría esta y diría algo que no le toca.
   */
  title: {
    default: `${SITIO.nombre} — Proyecto de desarrollo humano`,
    template: `%s · ${SITIO.nombre}`,
  },
  /**
   * ⚠️ **SIN CIUDAD NI PAÍS, por decisión de Fernando (2026-08-20).** La primera versión de
   * esta frase, publicada hace minutos, empezaba con «en Guayaquil, Ecuador». Él lo vio en un
   * resultado real junto a su dirección y su teléfono, y pidió que el sitio dejara de decirlo.
   *
   * ⚠️ **Tiene un coste que hay que saber**: «desarrollo humano Guayaquil» era de las pocas
   * búsquedas donde este sitio podía ganar sin competir con medio mundo. Sin la ciudad, se
   * compite en abierto. Es su decisión, tomada sabiéndolo.
   */
  description:
    'Proyecto de desarrollo humano que reconoce y aprovecha las condiciones como ancla del progreso mental, laboral, social y corporal, individual y colectivo.',
  /**
   * ⚠️ **EL ICONO ES DE 192×192 POR EXIGENCIA DE GOOGLE, no por gusto (2026-08-20).**
   *
   * Fernando avisó de que en los resultados no salía el logo, sino el globo genérico. La causa
   * medida: `app/icon.png` era de **32×32**, y Google solo muestra el favicon si es un cuadrado
   * cuyo lado es **múltiplo de 48**. 32 no lo es, así que lo descartaba y ponía el suyo.
   *
   * 192 = 48 × 4, generado desde `public/logo-gcc.png` (256×256), que es el logo de la
   * cabecera. Se añade además `app/favicon.ico` (48×48) porque `/favicon.ico` daba **404** y
   * hay rastreadores que lo piden ahí antes de mirar esta etiqueta.
   *
   * ⚠️ No basta con desplegarlo: Google solo lo cambia cuando vuelve a rastrear la portada.
   */
  icons: { icon: '/icon.png' },
  openGraph: { siteName: SITIO.nombre, locale: 'es_EC', type: 'website' },
  robots: { index: true, follow: true },

  /**
   * ⛔ NO BORRAR — es la llave de Google Search Console (2026-08-19).
   *
   * Next lo emite como `<meta name="google-site-verification" …>`. Es lo que le demuestra a
   * Google que somos dueños de `www.grupocc.org`, y con eso se puede enviar el mapa del
   * sitio, pedir que se indexe una página y ver qué encuentra el buscador. Hasta hoy no
   * había ninguna: el sitio estaba técnicamente listo para ser indexado pero **nadie podía
   * comprobarlo ni acelerarlo**.
   *
   * ⚠️ **Google lo vuelve a comprobar cada cierto tiempo.** No es un trámite de una vez: si
   * esta línea desaparece, se pierde la propiedad y con ella el histórico de datos. Por eso
   * va aquí, en el layout raíz, y no en una página suelta que alguien pueda rehacer.
   *
   * No es un secreto —viaja en el HTML de todas las páginas, a la vista de cualquiera—, así
   * que va en el código y no en una variable de entorno: en una variable, un despliegue en
   * otro entorno sin ella tumbaría la verificación sin que nadie se enterara.
   *
   * El código lo obtuvo Fernando en Search Console (propiedad de tipo «Prefijo de la URL»
   * sobre `https://www.grupocc.org`, método «Etiqueta HTML»).
   */
  verification: { google: 'UcFY0abNGykOVn6f6ChhFOvNUHpswGgte4Fc7_OOOro' },
};

/**
 * EL VIEWPORT, AHORA COMO EXPORT Y NO COMO `<meta>` A MANO.
 *
 * Estaba escrito directamente en el `<head>` de abajo con `maximum-scale=1,
 * user-scalable=no`, que **bloquea el pellizco para ampliar**. Eso tiene sentido en el
 * juego —un pellizco a media partida descoloca la escena— pero en una página de lectura es
 * un fallo de accesibilidad: quien necesita ampliar para leer, no puede. Y Google evalúa el
 * sitio por su versión móvil.
 *
 * Escrito como `export const viewport`, Next lo emite igual **y además** deja que una ruta
 * lo sobrescriba. El sitio público lo hace en `app/(sitio)/layout.tsx` para permitir el
 * zoom. Con la etiqueta a mano no se podía: saldrían dos `<meta viewport>` peleándose.
 *
 * ⚠️ Los valores de aquí son EXACTAMENTE los de antes, para no cambiar el juego.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // `scroll-smooth`: al pulsar un tema del índice de un documento legal, la página se
  // desliza hasta él en vez de saltar de golpe. Con veintidós secciones, el salto seco
  // desorienta — no se sabe si te has movido tres párrafos o veinte.
  return (
    <html lang="es" className="dark scroll-smooth">
      <head>
        {/* El viewport ya no se escribe aquí: vive en `export const viewport`, arriba, para
            que el sitio público pueda permitir el zoom sin pelearse con esta etiqueta. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Silkscreen:wght@400;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-digi-darker text-digi-text antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster theme="dark" richColors position="bottom-right" />
      </body>
    </html>
  );
}
