import type { Metadata } from 'next';
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // `scroll-smooth`: al pulsar un tema del índice de un documento legal, la página se
  // desliza hasta él en vez de saltar de golpe. Con veintidós secciones, el salto seco
  // desorienta — no se sabe si te has movido tres párrafos o veinte.
  return (
    <html lang="es" className="dark scroll-smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
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
