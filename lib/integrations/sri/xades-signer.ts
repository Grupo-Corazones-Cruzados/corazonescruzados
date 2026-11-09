import { signInvoiceXml, signCreditNoteXml } from 'ec-sri-invoice-signer';
import forge from 'node-forge';
import fs from 'fs';
import { pool } from '@/lib/db';
import { descifrar, contextoFirmaEmisor } from '@/lib/cifrado';
import type { Emisor } from './emisor';

/**
 * LA FIRMA ELECTRÓNICA DE CADA EMISOR (fase 4, paso 3).
 *
 *  · GCC (`firmaDesdeEntorno`): el .p12 de SRI_P12_BASE64 / SRI_P12_PATH + SRI_P12_PASSWORD, como siempre.
 *  · Los demás: el .p12 y su clave guardados CIFRADOS en `sri_emisores` (`lib/cifrado.ts`). Solo este archivo los
 *    descifra, solo en el servidor y solo para firmar; nunca se devuelven a ninguna ruta.
 *
 * Un emisor que no esté `en_pruebas` o `activo` no firma (los miembros aún no emiten: eso es el paso 4).
 */

let _p12Entorno: Buffer | null = null;

function p12DelEntorno(): Buffer {
  if (_p12Entorno) return _p12Entorno;

  const p12Path = process.env.SRI_P12_PATH || '';

  if (process.env.SRI_P12_BASE64) {
    _p12Entorno = Buffer.from(process.env.SRI_P12_BASE64, 'base64');
  } else if (p12Path && fs.existsSync(p12Path)) {
    _p12Entorno = fs.readFileSync(p12Path);
  } else {
    throw new Error('Certificado .p12 no encontrado. Configure SRI_P12_PATH o SRI_P12_BASE64');
  }

  return _p12Entorno;
}

async function credenciales(emisor: Emisor): Promise<{ p12: Buffer; password: string }> {
  if (emisor.firmaDesdeEntorno) return { p12: p12DelEntorno(), password: process.env.SRI_P12_PASSWORD || '' };
  if (emisor.id === null) throw new Error('Emisor sin firma');
  if (emisor.estado !== 'activo' && emisor.estado !== 'en_pruebas') {
    throw new Error('La cuenta de emisor no está habilitada para emitir');
  }
  const { rows: [r] } = await pool.query(
    `SELECT p12_enc, p12_password_enc FROM gcc_world.sri_emisores WHERE id = $1`, [emisor.id],
  );
  if (!r?.p12_enc) throw new Error('El emisor no tiene firma electrónica registrada');
  return {
    p12: Buffer.from(descifrar(r.p12_enc, contextoFirmaEmisor(emisor.id, 'p12')), 'base64'),
    password: r.p12_password_enc ? descifrar(r.p12_password_enc, contextoFirmaEmisor(emisor.id, 'p12_password')) : '',
  };
}

const yaFirmado = (xml: string) =>
  /<ds:Signature\b/.test(xml) || /<\w+:Signature\b[^>]*xmlns:\w+="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#"/.test(xml);

/**
 * Firma una factura con XAdES-BES (ec-sri-invoice-signer, el formato exacto que acepta el SRI) con la firma de
 * `emisor`.
 */
export async function firmarFactura(xml: string, emisor: Emisor): Promise<string> {
  // Idempotent: if already signed, return as-is. Re-signing breaks the existing signature
  // and matters when retrying an invoice whose previous send failed mid-flow.
  if (yaFirmado(xml)) return xml;
  const { p12, password } = await credenciales(emisor);
  return signInvoiceXml(xml, p12, { pkcs12Password: password });
}

/** Firma una nota de crédito con la firma de `emisor` (el de la factura que anula). */
export async function firmarNotaCredito(xml: string, emisor: Emisor): Promise<string> {
  const { p12, password } = await credenciales(emisor);
  return signCreditNoteXml(xml, p12, { pkcs12Password: password });
}

// ── Revisar un .p12 antes de guardarlo ──────────────────────────────────────────────────────────────────────

export type RevisionP12 =
  | {
      ok: true;
      titular: string;
      /** AAAA-MM-DD */
      vence: string;
      venceInstante: Date;
      /** Las cédulas/RUC que trae el certificado (vacío si no trae ninguna legible). */
      identificaciones: string[];
    }
  | { ok: false; error: string };

/**
 * Abre el .p12 con la clave Y COMO LO ABRE EL FIRMADOR: `ec-sri-invoice-signer` firma con el PRIMER certificado
 * del archivo y la primera clave privada (salvo los del Banco Central, con la de «Signing Key»). Si ese
 * certificado no es el de la clave, la firma sale y el SRI la rechaza; por eso se comprueba aquí que casan.
 *
 * Las certificadoras ecuatorianas guardan la cédula y el RUC en extensiones propias (Security Data
 * 1.3.6.1.4.1.37746.3.1 / .3.11, Banco Central 1.3.6.1.4.1.37947.3.1 / .3.11…) o en el `serialNumber` del sujeto:
 * se recogen todos los números de 10 o 13 dígitos de esos campos.
 */
export function revisarP12(archivo: Buffer, password: string): RevisionP12 {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(archivo.toString('binary')), password);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/mac|password|invalid/i.test(msg)) return { ok: false, error: 'La contraseña no abre este archivo .p12.' };
    return { ok: false, error: 'El archivo no es un certificado .p12 válido.' };
  }

  const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
  const cert = certBag?.cert;
  if (!cert) return { ok: false, error: 'El archivo no trae el certificado.' };

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
  const nombre = String(certBag?.attributes?.friendlyName?.[0] ?? '');
  const keyBag = /banco central/i.test(nombre)
    ? keyBags.find((b) => /signing key/i.test(String(b?.attributes?.friendlyName?.[0] ?? '')))
    : keyBags[0];
  const clave = keyBag?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!clave) return { ok: false, error: 'El archivo no trae la clave privada para firmar.' };
  const publica = cert.publicKey as forge.pki.rsa.PublicKey;
  if (!publica?.n || publica.n.compareTo(clave.n) !== 0) {
    return { ok: false, error: 'El certificado y la clave privada del archivo no corresponden: no serviría para firmar.' };
  }

  const ahora = new Date();
  if (cert.validity.notAfter <= ahora) return { ok: false, error: 'Este certificado ya venció.' };
  if (cert.validity.notBefore > ahora) return { ok: false, error: 'Este certificado todavía no es válido.' };

  const titular = String(cert.subject.getField('CN')?.value ?? '').trim();
  const fuentes: string[] = [String(cert.subject.getField({ type: '2.5.4.5' })?.value ?? '')];
  for (const ext of cert.extensions as { id: string; value?: string }[]) {
    if (/^1\.3\.6\.1\.4\.1\./.test(ext.id) && typeof ext.value === 'string') fuentes.push(ext.value);
  }
  const identificaciones = [...new Set(fuentes.flatMap((t) => t.match(/(?<!\d)(\d{13}|\d{10})(?!\d)/g) ?? []))];

  return {
    ok: true,
    titular: titular || 'Sin nombre',
    vence: cert.validity.notAfter.toISOString().slice(0, 10),
    venceInstante: cert.validity.notAfter,
    identificaciones,
  };
}
