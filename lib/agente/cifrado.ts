/**
 * Cifrado de los secretos POR CLIENTE del agente de WhatsApp.
 *
 * Por qué existe: hasta ahora la regla del proyecto era «los secretos viven SOLO en
 * variables de entorno; la base guarda identificadores públicos pero nunca un token».
 * Con un solo número eso funcionaba. Con N clientes no: cada alta por Embedded Signup
 * devuelve un token propio del cliente, y además cada cliente pone su propia clave de
 * IA. No caben en el entorno. Pasan a la base, y pasan CIFRADOS.
 *
 * Es una decisión de arquitectura consciente, no un atajo — así consta en la guía y en
 * MEMORIA.md.
 *
 * AES-256-GCM: cifra y además autentica, así que un texto cifrado manipulado no
 * descifra, falla. La clave maestra vive en `AGENTE_CLAVE_MAESTRA` (Railway).
 *
 * Formato del texto cifrado, todo en base64url y separado por puntos:
 *
 *     v1.<iv>.<etiqueta>.<contenido>
 *
 * El prefijo de versión permite cambiar de algoritmo más adelante sin tener que adivinar
 * con qué se cifró cada fila.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

const VERSION = 'v1';
const ALGORITMO = 'aes-256-gcm';
const BYTES_IV = 12; // el tamaño que recomienda GCM
const BYTES_CLAVE = 32; // AES-256

const b64u = (b: Buffer) => b.toString('base64url');
const deB64u = (s: string) => Buffer.from(s, 'base64url');

/** Lee y valida la clave maestra. Falla ruidosamente: un secreto a medio cifrar es peor que un error. */
function claveMaestra(): Buffer {
  const bruto = process.env.AGENTE_CLAVE_MAESTRA;
  if (!bruto) {
    throw new Error(
      'Falta AGENTE_CLAVE_MAESTRA. Genérala con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  let clave: Buffer;
  try {
    clave = Buffer.from(bruto.trim(), 'base64');
  } catch {
    throw new Error('AGENTE_CLAVE_MAESTRA no es base64 válido');
  }
  if (clave.length !== BYTES_CLAVE) {
    throw new Error(
      `AGENTE_CLAVE_MAESTRA debe ser de ${BYTES_CLAVE} bytes en base64 (son ${clave.length}). Genera una nueva con randomBytes(32).`,
    );
  }
  return clave;
}

/** ¿Está configurada la clave? Para avisar en el panel en vez de reventar al guardar. */
export function claveMaestraConfigurada(): boolean {
  try {
    claveMaestra();
    return true;
  } catch {
    return false;
  }
}

/**
 * Cifra un secreto.
 *
 * `contexto` se autentica junto al contenido (AAD) sin guardarse: ata el texto cifrado a
 * dónde vive. Un token copiado de la fila de un cliente a la de otro **no descifra**,
 * porque el contexto ya no coincide. Sin esto, quien pudiera escribir en la base podría
 * mover secretos entre clientes y el sistema los usaría tan tranquilo.
 *
 * Se usa así: `cifrar(token, contextoCanal(canalId, 'wa_token'))`.
 */
export function cifrar(texto: string, contexto: string): string {
  if (typeof texto !== 'string' || texto.length === 0) {
    throw new Error('No se cifra un valor vacío');
  }
  if (!contexto) throw new Error('El contexto es obligatorio: ata el secreto a dónde vive');

  const iv = randomBytes(BYTES_IV);
  const cipher = createCipheriv(ALGORITMO, claveMaestra(), iv);
  cipher.setAAD(Buffer.from(contexto, 'utf8'));
  const contenido = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return [VERSION, b64u(iv), b64u(cipher.getAuthTag()), b64u(contenido)].join('.');
}

/**
 * Descifra. Lanza si el texto está manipulado, si la clave no es la que cifró, o si el
 * contexto no coincide — que es justo lo que queremos: **fallar, no devolver basura**.
 */
export function descifrar(blob: string, contexto: string): string {
  if (!blob) throw new Error('No hay nada que descifrar');
  const partes = blob.split('.');
  if (partes.length !== 4 || partes[0] !== VERSION) {
    throw new Error(`Texto cifrado con formato desconocido (se esperaba ${VERSION}.iv.tag.contenido)`);
  }
  const [, iv, tag, contenido] = partes;

  const decipher = createDecipheriv(ALGORITMO, claveMaestra(), deB64u(iv));
  decipher.setAAD(Buffer.from(contexto, 'utf8'));
  decipher.setAuthTag(deB64u(tag));
  try {
    return Buffer.concat([decipher.update(deB64u(contenido)), decipher.final()]).toString('utf8');
  } catch {
    // El mensaje del error de GCM no aporta nada y sí invita a jugar a adivinar.
    throw new Error('No se pudo descifrar: clave, contexto o contenido incorrectos');
  }
}

/** Descifra devolviendo `null` en vez de lanzar. Para pintar el panel sin tumbarlo. */
export function descifrarONulo(blob: string | null | undefined, contexto: string): string | null {
  if (!blob) return null;
  try {
    return descifrar(blob, contexto);
  } catch {
    return null;
  }
}

/** ¿Ya está cifrado? Evita cifrar dos veces al reguardar un formulario. */
export function estaCifrado(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.startsWith(`${VERSION}.`) && valor.split('.').length === 4;
}

/** Contextos canónicos. Una sola definición: si cada sitio inventa el suyo, nada descifra. */
export type CampoSecreto = 'wa_token' | 'ia_api_key' | 'pin';
export function contextoCanal(canalId: number, campo: CampoSecreto): string {
  return `agente_canales:${canalId}:${campo}`;
}

/**
 * Lo que se manda al navegador. NUNCA el secreto: solo si existe y sus últimos caracteres,
 * para que se reconozca en pantalla sin poder reconstruirlo.
 */
export function pistaSecreto(blob: string | null | undefined, contexto: string): { hay: boolean; final: string | null } {
  const claro = descifrarONulo(blob, contexto);
  if (!claro) return { hay: Boolean(blob), final: null };
  return { hay: true, final: claro.length <= 4 ? '••••' : `…${claro.slice(-4)}` };
}

/** Compara dos secretos en tiempo constante (para el token de verificación del webhook). */
export function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
