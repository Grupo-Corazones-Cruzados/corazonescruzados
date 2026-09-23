import type { MetadataRoute } from 'next';

/**
 * EL MANIFIESTO DE «GCC WORLD» — el primer escalón del camino a las tiendas.
 *
 * ── POR QUÉ EXISTE (Fernando, 2026-09-23) ────────────────────────────────────────────
 * El plan acordado es **un solo proyecto** que se prueba primero como PWA y después se
 * empaqueta con Capacitor para App Store y Play Store. Este archivo es lo que hace que la
 * aplicación se pueda **instalar** en el teléfono: sin él, anclarla al inicio deja un
 * marcador que se abre en el navegador, con su barra de direcciones y sus botones — que es
 * justo lo que no queremos.
 *
 * `start_url: '/dashboard'` y no `/`: quien instala la aplicación es alguien que trabaja
 * con ella, no quien viene a conocer el proyecto. La portada sigue en el navegador.
 *
 * ⚠️ `id` fijo: es lo que permite que una instalación ya hecha se reconozca como la misma
 * aplicación cuando cambien `start_url` o `scope`. Sin `id`, un cambio de esas dos deja al
 * teléfono creyendo que es otra app distinta y quedan dos iconos.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/gcc-world',
    name: 'GCC World',
    short_name: 'GCC World',
    description:
      'Plataforma del Grupo Corazones Cruzados: proyectos, tickets, facturación, marketplace y el mundo GCC.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    theme_color: '#4B2D8E',
    background_color: '#faf9f8',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // `maskable` es lo que evita que Android recorte el logo dentro de su círculo.
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Atajos del icono: lo que se hace a diario, a un toque desde el escritorio.
    shortcuts: [
      { name: 'Mi día', short_name: 'Mi día', url: '/dashboard/mi-dia' },
      { name: 'Tickets', short_name: 'Tickets', url: '/dashboard/tickets' },
      { name: 'Marketplace', short_name: 'Marketplace', url: '/dashboard/marketplace' },
    ],
  };
}
