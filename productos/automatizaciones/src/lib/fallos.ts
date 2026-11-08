/**
 * DE QUÉ ES UN FALLO DEL CANAL — para enseñarlo DONDE SE ARREGLA (2026-11-08).
 *
 * `canales.ultimo_error` es una sola columna para dos clases de fallo: los de la conexión con
 * WhatsApp (token de Meta, suscripción, número) y los del agente (la clave de OpenAI). Antes se
 * enseñaba en el Estudio y en Configuración a la vez; ahora cada pantalla enseña solo los suyos:
 * los de IA en el Estudio, donde está la clave; el resto en Configuración ▸ WhatsApp.
 */
export function esFalloDeIA(texto: string | null | undefined): boolean {
  if (!texto) return false;
  return /clave de ia|openai|modelo de ia/i.test(texto);
}
