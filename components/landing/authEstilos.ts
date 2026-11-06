/**
 * ESTILOS DE LAS SUPERFICIES DE ACCESO — definición única.
 *
 * Son los del diálogo de acceso de la portada (`ClientLoginModal`), que es el aspecto que
 * el proyecto dio por bueno: panel oscuro con los tokens del panel, campos SIN etiqueta
 * —solo marcador de posición—, y el botón primario a ancho completo.
 *
 * ── POR QUÉ SALEN DE AHÍ ───────────────────────────────────────────────────────
 * Las páginas `/auth/{tipo}` tienen que verse **igual** que ese diálogo: es la misma
 * acción, y quien llega por un enlace directo no debería encontrarse otra cosa que quien
 * llega desde la portada. Escribir estilos equivalentes en la página fue justo el error
 * que ya se cometió con la pantalla de plantillas (ver `Diseño.md`): equivalente no es
 * igual, y la diferencia aparece en cuanto alguien pone las dos pantallas juntas.
 */

import type React from 'react';

export const PANEL_AUTH: React.CSSProperties = {
  position: 'relative', width: '100%',
  background: 'var(--color-digi-card)',
  border: '1px solid var(--color-digi-border)',
  borderRadius: 8,
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  padding: '22px 20px',
  fontFamily: 'var(--font-body)',
};

export const TITULO_AUTH: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '1.06rem', fontWeight: 600,
  color: 'var(--color-digi-text)',
  margin: '0 0 6px', letterSpacing: '-0.01em',
};

export const SUBTITULO_AUTH: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.84rem',
  color: 'var(--auth-suave, #b9b2cf)', margin: '0 0 16px',
};

/** Campo sin etiqueta: el marcador de posición hace de rótulo. */
export const CAMPO_AUTH: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  background: 'var(--color-digi-darker)',
  color: 'var(--color-digi-text)',
  border: '1px solid var(--color-digi-border)',
  borderRadius: 4,
  fontFamily: 'var(--font-body)', fontSize: '0.85rem',
  outline: 'none',
};

/** Enlace de pie: «¿no tienes cuenta?», «he olvidado la contraseña». */
export const ENLACE_AUTH: React.CSSProperties = {
  background: 'transparent', border: 0, cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontSize: '0.78rem',
  color: 'var(--auth-enlace, #c9b6ff)', textDecoration: 'underline', marginTop: 2,
};

/** Texto de apoyo bajo el título (el mismo gris lila del diálogo). */
export const TEXTO_AUTH: React.CSSProperties = SUBTITULO_AUTH;

/**
 * EL FONDO DE LAS PÁGINAS DE ACCESO QUE LLEGAN POR CORREO (`/auth/verify`,
 * `/auth/reset-password`, 2026-11-04). El diálogo de la portada flota sobre la noche de
 * «Aventura» oscurecida por su velo; estas páginas no tienen portada detrás, así que pintan esa
 * misma noche ya velada: violeta casi negro con dos nebulosas suaves.
 */
export const FONDO_AUTH: React.CSSProperties = {
  background:
    'radial-gradient(rgba(233,229,247,0.07) 1px, transparent 1.6px) 0 0 / 34px 34px,' +
    'radial-gradient(36vw 36vw at 88% -6%, rgba(123,95,191,0.22), transparent 70%),' +
    'radial-gradient(30vw 30vw at 4% 106%, rgba(162,28,175,0.12), transparent 70%),' +
    'linear-gradient(180deg, #07060f 0%, #0c0a18 100%)',
  backgroundAttachment: 'fixed',
};

/** Mensaje de error del diálogo. */
export const ERROR_AUTH: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--auth-error, #ff8f8f)' };
