/**
 * Verificación de la firma de los webhooks de Meta (`X-Hub-Signature-256`).
 *
 * Sin esto, cualquiera que descubra la URL puede inyectar conversaciones falsas en la
 * bandeja de un cliente y hacer que el agente responda —y gaste— a mensajes inventados.
 * El chatbot que había antes en este repo no la verificaba en absoluto.
 *
 * Va en su propio módulo, sin `pg` ni nada de Next, para poder probarlo en seco.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * ⚠️ La firma se calcula sobre el CUERPO CRUDO, byte a byte.
 * Si en la ruta se hace `await req.json()` y luego se vuelve a serializar, la firma
 * **nunca** va a coincidir: `JSON.stringify` reordena espacios y escapes. Hay que leer
 * `await req.text()` y validar sobre esa cadena exacta.
 */
export function firmaValida(cuerpoCrudo: string, cabecera: string | null, appSecret: string | undefined): boolean {
  if (!appSecret) return false;             // sin secreto configurado no se valida nada
  if (!cabecera) return false;              // sin firma, fuera
  if (!cabecera.startsWith('sha256=')) return false;

  const recibida = cabecera.slice('sha256='.length).trim();
  if (!/^[0-9a-f]{64}$/i.test(recibida)) return false;

  const esperada = createHmac('sha256', appSecret).update(cuerpoCrudo, 'utf8').digest('hex');

  // Comparación en tiempo constante: comparar con === filtra, byte a byte, cuánto se
  // acertó, y con suficientes intentos eso permite construir una firma válida.
  const a = Buffer.from(esperada, 'hex');
  const b = Buffer.from(recibida.toLowerCase(), 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Firma un cuerpo. Solo para las pruebas: simula lo que hace Meta. */
export function firmar(cuerpoCrudo: string, appSecret: string): string {
  return 'sha256=' + createHmac('sha256', appSecret).update(cuerpoCrudo, 'utf8').digest('hex');
}
