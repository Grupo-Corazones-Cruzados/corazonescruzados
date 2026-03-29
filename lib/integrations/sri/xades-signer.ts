import { signInvoiceXml } from 'ec-sri-invoice-signer';
import fs from 'fs';

let _p12Data: Buffer | null = null;

function loadP12(): Buffer {
  if (_p12Data) return _p12Data;

  const p12Path = process.env.SRI_P12_PATH || '';

  if (process.env.SRI_P12_BASE64) {
    _p12Data = Buffer.from(process.env.SRI_P12_BASE64, 'base64');
  } else if (p12Path && fs.existsSync(p12Path)) {
    _p12Data = fs.readFileSync(p12Path);
  } else {
    throw new Error('Certificado .p12 no encontrado. Configure SRI_P12_PATH o SRI_P12_BASE64');
  }

  return _p12Data;
}

/**
 * Sign factura XML with XAdES-BES for Ecuador SRI
 * Uses ec-sri-invoice-signer which implements the exact XAdES-BES format the SRI accepts
 */
export function signXml(xml: string): string {
  const p12 = loadP12();
  const password = process.env.SRI_P12_PASSWORD || '';

  return signInvoiceXml(xml, p12, { pkcs12Password: password });
}
