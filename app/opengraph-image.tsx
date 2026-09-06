import { ImageResponse } from 'next/og';
import { SITIO } from '@/lib/sitio/contenido';

/**
 * LA IMAGEN QUE SALE AL COMPARTIR UN ENLACE DEL SITIO.
 *
 * ── QUÉ CAMBIÓ (2026-09-06) ────────────────────────────────────────────────────
 * Dibujaba una tarjeta con el nombre de la empresa y «Un proyecto de desarrollo humano».
 * Era correcta y no decía nada: quien recibe el enlace ve un rótulo corporativo, no el
 * sitio. Fernando pidió que se vea **la portada** — «Un Corazón puede cruzar al mundo»—,
 * que es la frase con la que la gente reconoce el proyecto.
 *
 * Así que esta imagen **reproduce el héroe de la portada**: el mismo titular, con
 * «cruzar» en rojo, sobre el mismo fondo oscuro con el resplandor violeta de la marca.
 * Quien pega el enlace enseña la puerta de entrada, no una ficha.
 *
 * ── POR QUÉ SE DIBUJA Y NO ES UN `.png` ────────────────────────────────────────
 * Un archivo estático habría que rehacerlo a mano cada vez que cambie el eslogan. Esto se
 * genera con `next/og`, así que sigue al sitio.
 *
 * ⚠️ Se dibuja con Satori, que **no es un navegador**: solo entiende flexbox y un
 * subconjunto de CSS. Todo `div` con más de un hijo necesita `display: flex` explícito, no
 * hay `gap` fiable —de ahí los márgenes a mano— y **no existe `background-clip: text`**,
 * así que el degradado del titular de la portada se aproxima con colores planos: blanco,
 * el rojo de «cruzar» y el violeta de la marca. Es lo más cerca que se puede estar sin
 * mentir sobre lo que se ve al entrar.
 */

export const alt = 'Un Corazón puede cruzar al mundo — Grupo Corazones Cruzados';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * La tipografía de la portada (Silkscreen, de Google Fonts) en binario, que es lo único
 * que Satori entiende.
 *
 * ⚠️ EL `User-Agent` VIEJO NO ES UN DESCUIDO. A un navegador moderno, Google devuelve
 * **woff2**, y Satori no sabe leerlo: la imagen saldría con la fuente por defecto y sin
 * avisar. Con un agente antiguo devuelve **TTF**, que sí entiende.
 *
 * Si algo falla —sin red, Google caído— se devuelve `null` y la imagen se dibuja con la
 * fuente por defecto: **una miniatura con otra letra es mucho mejor que ninguna
 * miniatura**, que es lo que pasaría si esto lanzara.
 */
async function fuenteDeLaPortada(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch('https://fonts.googleapis.com/css2?family=Silkscreen:wght@700', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)' },
    }).then((r) => r.text());

    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function Image() {
  const pixel = await fuenteDeLaPortada();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 80px',
          textAlign: 'center',
          backgroundColor: '#0b0d14',
          // El mismo resplandor violeta del fondo de la portada.
          backgroundImage:
            'radial-gradient(circle at 50% 38%, rgba(123,95,191,0.34) 0%, rgba(75,45,142,0.14) 38%, rgba(11,13,20,0) 68%)',
          fontFamily: pixel ? 'Silkscreen' : undefined,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 66,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.25,
          }}
        >
          Un Corazón puede
        </div>

        {/* La segunda línea, con «cruzar» en rojo como en la portada. En Satori cada trozo
            de color es su propio nodo: no hay `<span>` con degradado que valga. */}
        <div style={{ display: 'flex', marginTop: 14, fontSize: 66, fontWeight: 700, lineHeight: 1.25 }}>
          <span style={{ color: '#ef4444' }}>cruzar</span>
          <span style={{ color: '#A78BFA', marginLeft: 18 }}>al mundo</span>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 46,
            fontSize: 22,
            letterSpacing: '0.08em',
            color: '#94A3B8',
          }}
        >
          PROYECTO DE DESARROLLO HUMANO
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 56,
            fontSize: 20,
            color: 'rgba(255,255,255,0.34)',
          }}
        >
          {/* Solo el dominio: Fernando pidió el 2026-08-20 que el sitio dejara de decir la
              ciudad después de ver esta imagen en un resultado de Google junto a su
              dirección. */}
          grupocc.org
        </div>

        {/* El nombre de la empresa, discreto abajo: el titular es el gancho, esto es la
            firma. Antes presidía la imagen y le quitaba el sitio a la frase. */}
        <div
          style={{
            display: 'flex',
            marginTop: 10,
            fontSize: 18,
            color: 'rgba(255,255,255,0.22)',
          }}
        >
          {SITIO.nombre}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: pixel
        ? [{ name: 'Silkscreen', data: pixel, style: 'normal' as const, weight: 700 as const }]
        : undefined,
    },
  );
}
