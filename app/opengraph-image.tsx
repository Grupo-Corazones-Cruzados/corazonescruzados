import { ImageResponse } from 'next/og';
import { SITIO } from '@/lib/sitio/contenido';

/**
 * LA IMAGEN QUE SALE AL COMPARTIR UN ENLACE DEL SITIO.
 *
 * ── POR QUÉ HACÍA FALTA ────────────────────────────────────────────────────────
 * Las páginas declaraban `openGraph` pero **sin `images`**. Resultado: al pegar un enlace
 * en WhatsApp, LinkedIn o X salía una tarjeta gris, sin imagen. No cambia el
 * posicionamiento, pero sí **cuánta gente pulsa** un enlace compartido — y ahora mismo
 * compartir el enlace a mano es la vía principal para que alguien llegue al sitio.
 *
 * ── POR QUÉ SE DIBUJA Y NO ES UN `.png` ────────────────────────────────────────
 * Un archivo estático habría que rehacerlo a mano cada vez que cambie el nombre o el
 * eslogan. Esto se genera con `next/og` a partir de `lib/sitio/contenido.ts`, que ya es la
 * fuente única del texto del sitio: **cambia ahí y la imagen cambia sola**.
 *
 * Al vivir en `app/`, vale para TODAS las rutas. Si una página quiere la suya propia, se
 * pone un `opengraph-image.tsx` en su carpeta y esta se queda de reserva.
 *
 * ⚠️ Se dibuja con Satori, que **no es un navegador**: solo entiende flexbox y un subconjunto
 * de CSS. Todo `div` con más de un hijo necesita `display: flex` explícito, y no hay `gap`
 * fiable — de ahí los márgenes a mano.
 */

export const alt = `${SITIO.nombre} — proyecto de desarrollo humano`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 90px',
          backgroundColor: '#0b0d14',
          // El resplandor violeta de la marca, el mismo gesto que `FondoHeroe`.
          backgroundImage:
            'linear-gradient(135deg, rgba(123,95,191,0.42) 0%, rgba(123,95,191,0.08) 45%, rgba(11,13,20,0) 70%)',
        }}
      >
        {/* La barra violeta: identifica la marca sin depender de un archivo de logo. */}
        <div style={{ display: 'flex', width: 96, height: 8, backgroundColor: '#7B5FBF' }} />

        <div
          style={{
            display: 'flex',
            marginTop: 44,
            fontSize: 78,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          {SITIO.nombre}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 36,
            color: 'rgba(255,255,255,0.62)',
            lineHeight: 1.3,
          }}
        >
          Un proyecto de desarrollo humano
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 52,
            fontSize: 26,
            color: 'rgba(255,255,255,0.38)',
          }}
        >
          {/* ⚠️ Aquí ponía «{SITIO.ciudad}, {SITIO.pais} · grupocc.org». Fernando vio esta
              imagen en un resultado de Google, junto a su dirección, y pidió que el sitio
              dejara de decir la ciudad (2026-08-20). Queda solo el dominio. */}
          grupocc.org
        </div>
      </div>
    ),
    size,
  );
}
