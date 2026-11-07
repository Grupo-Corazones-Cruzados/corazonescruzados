/**
 * LA CLAVE DEL SERVIDOR — definición única (2026-11-07, auditoría de seguridad).
 *
 * Firma las sesiones (JWT) y sirve de base a otras firmas (captcha, límite de registros, solicitudes de
 * presupuesto). Antes cada sitio caía en una clave escrita en el código si faltaba `JWT_SECRET`: con un
 * entorno mal copiado (p. ej. en la mudanza al servidor propio) cualquiera podía fabricar una sesión de
 * administrador. Ahora, en producción, sin `JWT_SECRET` no se firma ni se acepta nada.
 *
 * La reserva solo vale en desarrollo, durante `next build` y en pruebas locales con
 * `PERMITIR_SECRETO_DE_PRUEBA=1`. Sin dependencias de Node: lo usa también el middleware (edge).
 */
const RESERVA_LOCAL = 'your-secret-key-change-in-production';

export function secretoServidor(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  const produccion = process.env.NODE_ENV === 'production'
    && process.env.NEXT_PHASE !== 'phase-production-build'
    && process.env.PERMITIR_SECRETO_DE_PRUEBA !== '1';
  if (produccion) throw new Error('Falta JWT_SECRET: no se usa una clave conocida en producción');
  return RESERVA_LOCAL;
}
