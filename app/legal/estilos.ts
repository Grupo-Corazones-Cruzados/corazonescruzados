/**
 * ESTILOS COMPARTIDOS de las páginas legales — definición ÚNICA.
 *
 * Las páginas de `/legal` son **públicas y sin sesión**: no usan el tema `.corp` del
 * panel ni sus componentes, porque las abre gente que no ha entrado nunca a la app
 * (candidatos, clientes, y los revisores de Meta). Por eso llevan estilo propio.
 *
 * Vivían inline dentro de `app/legal/page.tsx`. Al aparecer la segunda página
 * (`/legal/whatsapp`) se extrajeron aquí: dos documentos legales que se ven distinto
 * es exactamente el drift que el sistema de diseño existe para evitar. Cambiar un color
 * o un tamaño aquí los cambia en todas.
 *
 * Los colores son literales a propósito y NO salen de los tokens del tema: estas páginas
 * se sirven a terceros y deben verse igual pase lo que pase con el tema del panel.
 */

import type { CSSProperties } from 'react';

export const pagina: CSSProperties = {
  minHeight: '100vh',
  background: '#0e1118',
  color: '#d9d4ea',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  padding: '48px 20px 80px',
};

export const articulo: CSSProperties = {
  maxWidth: 820,
  margin: '0 auto',
  lineHeight: 1.65,
  fontSize: '0.98rem',
};

export const h1: CSSProperties = { fontSize: '1.6rem', color: '#f1eefb', margin: 0 };

export const h2: CSSProperties = {
  fontSize: '1.12rem',
  color: '#f1eefb',
  marginTop: 34,
  marginBottom: 8,
};

/** Encabezado de PARTE (A/B/C): separa bloques que se dirigen a públicos distintos. */
export const h2Parte: CSSProperties = {
  fontSize: '1.24rem',
  color: '#f1eefb',
  marginTop: 52,
  marginBottom: 10,
  paddingTop: 18,
  borderTop: '1px solid #2a2740',
};

export const ul: CSSProperties = {
  paddingLeft: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

export const b: CSSProperties = { color: '#fff', fontWeight: 700 };

export const link: CSSProperties = { color: '#7B5FBF', textDecoration: 'underline' };

export const sutil: CSSProperties = { color: '#9b95b3' };

/** Aviso destacado. `tono` cambia solo el color del borde y del fondo. */
export function recuadro(tono: 'aviso' | 'nota' = 'nota'): CSSProperties {
  return {
    borderLeft: `3px solid ${tono === 'aviso' ? '#c98a2e' : '#7B5FBF'}`,
    background: tono === 'aviso' ? 'rgba(201,138,46,0.08)' : 'rgba(123,95,191,0.08)',
    padding: '12px 16px',
    borderRadius: 6,
    margin: '16px 0',
  };
}

/** Tabla de datos: se usa para inventarios (qué datos, qué subencargados). */
export const tabla: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  margin: '14px 0',
  fontSize: '0.92rem',
};

export const th: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #2a2740',
  color: '#f1eefb',
  verticalAlign: 'top',
};

export const td: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #1c1a2b',
  verticalAlign: 'top',
};
