import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SITIO } from '@/lib/sitio/contenido';

/**
 * LA IMAGEN QUE SALE AL COMPARTIR UN ENLACE DEL SITIO (WhatsApp, Teams, Google, redes…).
 *
 * ── ⭐ 2026-10-29: EL LOGO, NO LA PORTADA ──────────────────────────────────────────────
 * Fernando: *«aparece una miniatura de mi página siendo como una réplica de la página de inicio
 * antigua; me gustaría que utilice el logo del Grupo Corazones Cruzados en todos los enlaces»*.
 * Del 2026-09-06 al 2026-10-29 dibujaba el titular de la portada vieja («Un Corazón puede
 * cruzar al mundo» en letra pixel), que la portada ya no tiene. Ahora es la MARCA: el logo de los
 * corazones cruzados en grande, con el nombre y el dominio debajo, sobre el fondo oscuro con el
 * resplandor violeta. No depende del diseño de ninguna página, así que no vuelve a quedarse vieja.
 *
 * La aplica Next a TODAS las rutas que no declaran su propio `openGraph`, y las que sí lo declaran
 * (`/clientes`, `/desarrollo-humano`, `/soluciones`…) la nombran con `OG_IMAGEN`: una sola imagen.
 *
 * El logo sale de `public/logo-gcc-512.png`: el círculo de `LogoApp.png` (1080 px) recortado a
 * 512 px y SIN la marca de agua «miro» de la esquina. El de la cabecera (`logo-gcc.png`, 256 px)
 * se vería borroso a este tamaño.
 *
 * ⚠️ Satori (lo que dibuja esto) no es un navegador: cada `div` con más de un hijo necesita
 * `display: flex`, y una imagen local va como `data:` URL.
 * ⚠️ WhatsApp, Teams y Google GUARDAN la miniatura de cada enlace: un enlace ya compartido puede
 * seguir enseñando la vieja un tiempo. Los enlaces nuevos salen con esta.
 */

export const alt = `${SITIO.nombre} — logo`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const logo = await readFile(join(process.cwd(), 'public', 'logo-gcc-512.png'));
  const logoUrl = `data:image/png;base64,${logo.toString('base64')}`;

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
          backgroundColor: '#0b0d14',
          backgroundImage:
            'radial-gradient(circle at 50% 40%, rgba(124,58,237,0.42) 0%, rgba(91,58,174,0.16) 34%, rgba(11,13,20,0) 64%)',
        }}
      >
        {/* El logo, protagonista, con un halo violeta como el de la marca en la portada. */}
        <div
          style={{
            display: 'flex',
            width: 300,
            height: 300,
            borderRadius: 9999,
            boxShadow: '0 0 0 10px rgba(167,139,250,0.18), 0 30px 80px rgba(124,58,237,0.45)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} width={300} height={300} alt="" style={{ borderRadius: 9999 }} />
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 52,
            fontSize: 54,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          {SITIO.nombre}
        </div>

        {/* Solo el dominio: sin ciudad (Fernando, 2026-08-20). */}
        <div
          style={{
            display: 'flex',
            marginTop: 14,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: '#a78bfa',
          }}
        >
          grupocc.org
        </div>
      </div>
    ),
    { ...size },
  );
}
