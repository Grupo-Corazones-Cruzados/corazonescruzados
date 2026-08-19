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
  title: {
    default: `${SITIO.nombre} — Proyecto de desarrollo humano y servicios de tecnología`,
    template: `%s · ${SITIO.nombre}`,
  },
  description:
    'Proyecto de desarrollo humano de Guayaquil, Ecuador. De ahí nacen los servicios que ofrecemos: plataformas de gestión a medida, agentes de atención con IA en WhatsApp, automatización y facturación electrónica ante el SRI.',
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
