/**
 * MARCO DEL CV PÚBLICO.
 *
 * Desde el 2026-11-04 va dentro de `MarcoPublico`, como las demás páginas que se abren por
 * enlace (Fernando: «está muy bien el tema y el diseño implementado, creo que hace falta
 * aplicarlo en el CV también»). Deroga el «CV siempre en claro» del 2026-08-14: el tema es el
 * del visitante (el último que usó en el panel, o el de su sistema) y los colores son los
 * tokens del panel. Imprimir sigue saliendo en claro (`@media print` en `cv-publico.css`).
 *
 * La cabecera es la mínima del marco (logo y nada más): quien abre el enlace viene a leer el
 * CV de una persona, no a navegar por el sitio del grupo.
 */
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import MarcoPublico from '@/components/public/MarcoPublico';
import './cv-publico.css';

/**
 * ⚠️ EL VIEWPORT SE ANULA CAMPO POR CAMPO.
 *
 * Next **fusiona** este viewport con el de la raíz, que bloquea el pellizco para
 * ampliar porque el juego lo necesita. Declarar solo `width` dejaría pasar
 * `maximumScale: 1` y el zoom seguiría bloqueado — ya costó un despliegue en el
 * sitio público. En una página de LEER, no poder agrandar el texto es un fallo de
 * accesibilidad.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

/**
 * NOINDEX EN TODA LA RAMA `/cv`.
 *
 * Es un currículum con datos personales protegido por un token. Un token indexado
 * deja de ser un token: bastaría buscar en Google para encontrar el enlace de
 * cualquiera. Se declara aquí, en el layout, para que ninguna página de la rama
 * pueda olvidarlo. Los endpoints mandan además la cabecera `X-Robots-Tag`, porque
 * un JSON o un PDF no tienen `<head>` donde poner esta etiqueta.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function CvLayout({ children }: { children: ReactNode }) {
  // `cv-publico` solo lleva lo propio del CV (maqueta, barra, animaciones); los colores y el
  // fondo los pone el marco.
  return (
    <MarcoPublico sinContenedor className="cv-publico antialiased">
      {children}
    </MarcoPublico>
  );
}
