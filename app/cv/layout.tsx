/**
 * MARCO DEL CV PÚBLICO.
 *
 * No usa el marco de `/negocio` (`CabeceraSitio` + `PieSitio`) a propósito: quien
 * abre este enlace viene a leer el CV de una persona, no a navegar por el sitio del
 * grupo. Una cabecera con «Negocio · Recursos · Contacto» encima de un currículum
 * compite con lo único que hay que mirar.
 *
 * Fondo y tipografía LITERALES, como en todo lo que se sirve a terceros: la página
 * tiene que verse igual pase lo que pase con el tema del panel.
 */
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
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
  return (
    <div
      className="cv-publico relative min-h-screen bg-[#0b0d14] text-white/70 antialiased"
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      <div className="cv-fondo" aria-hidden />
      <div className="cv-rejilla" aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
