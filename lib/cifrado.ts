/**
 * Cifrado de secretos POR USUARIO guardados en la base (hoy: los tokens de Google de
 * cada usuario, para su Drive/Gmail/Calendar).
 *
 * Es el MISMO esquema que `productos/automatizaciones/src/lib/agente/cifrado.ts` (los
 * productos son servicios aparte y no se pueden importar entre sí): AES-256-GCM, que
 * cifra y autentica, con el formato `v1.<iv>.<etiqueta>.<contenido>` en base64url.
 * Si se toca uno, se toca el otro.
 *
 * La clave maestra vive en `CLAVE_MAESTRA_SECRETOS` (Railway / .env.local), 32 bytes en
 * base64. Si se pierde, los secretos no se recuperan: cada usuario tendría que volver a
 * conectar Google. Nada más se rompe.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const ALGORITMO = 'aes-256-gcm';
const BYTES_IV = 12;
const BYTES_CLAVE = 32;

const b64u = (b: Buffer) => b.toString('base64url');
const deB64u = (s: string) => Buffer.from(s, 'base64url');

function claveMaestra(): Buffer {
  const bruto = process.env.CLAVE_MAESTRA_SECRETOS;
  if (!bruto) {
    throw new Error(
      'Falta CLAVE_MAESTRA_SECRETOS. Genérala con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  const clave = Buffer.from(bruto.trim(), 'base64');
  if (clave.length !== BYTES_CLAVE) {
    throw new Error(`CLAVE_MAESTRA_SECRETOS debe ser de ${BYTES_CLAVE} bytes en base64 (son ${clave.length}).`);
  }
  return clave;
}

export function claveMaestraConfigurada(): boolean {
  try { claveMaestra(); return true; } catch { return false; }
}

/**
 * `contexto` se autentica junto al contenido (AAD) sin guardarse: ata el secreto a la
 * fila donde vive. Un token copiado a la fila de otro usuario NO descifra.
 */
export function cifrar(texto: string, contexto: string): string {
  if (typeof texto !== 'string' || texto.length === 0) throw new Error('No se cifra un valor vacío');
  if (!contexto) throw new Error('El contexto es obligatorio: ata el secreto a dónde vive');
  const iv = randomBytes(BYTES_IV);
  const cipher = createCipheriv(ALGORITMO, claveMaestra(), iv);
  cipher.setAAD(Buffer.from(contexto, 'utf8'));
  const contenido = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return [VERSION, b64u(iv), b64u(cipher.getAuthTag()), b64u(contenido)].join('.');
}

/** Lanza si está manipulado, la clave no es la que cifró o el contexto no coincide. */
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
    throw new Error('No se pudo descifrar: clave, contexto o contenido incorrectos');
  }
}

/**
 * Contextos canónicos. ⚠️ Estas cadenas NO se renombran nunca: son el dato autenticado
 * con el que se cifró lo que ya está en la base.
 */
export type CampoGoogle = 'refresh_token' | 'access_token';
export function contextoGoogle(userId: string, campo: CampoGoogle): string {
  return `google_conexiones:${userId}:${campo}`;
}
