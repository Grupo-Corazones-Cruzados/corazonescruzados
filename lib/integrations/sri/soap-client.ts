import { SRI_CONFIG, SRI_ENDPOINTS } from './config';

const SRI_FETCH_TIMEOUT_MS = 30_000;
const SRI_FETCH_RETRIES = 2;
const SRI_FETCH_RETRY_DELAY_MS = 1500;

/**
 * Fetch with timeout + retry for SRI endpoints. Retries only on network/timeout
 * errors (where the request never produced an HTTP response). Once the SRI
 * answers — even with 5xx — we surface that response so the caller can record
 * it instead of silently re-sending.
 */
async function sriFetch(endpoint: string, body: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= SRI_FETCH_RETRIES; attempt++) {
    try {
      return await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
        body,
        signal: AbortSignal.timeout(SRI_FETCH_TIMEOUT_MS),
      });
    } catch (err: any) {
      lastErr = err;
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      const isNetwork = err?.message === 'fetch failed' || err?.cause;
      if (!isTimeout && !isNetwork) throw err;
      if (attempt < SRI_FETCH_RETRIES) {
        await new Promise(r => setTimeout(r, SRI_FETCH_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  const reason = (lastErr as any)?.message || 'unknown';
  throw new Error(`SRI no responde tras ${SRI_FETCH_RETRIES + 1} intentos (${reason}). Reintenta en unos minutos.`);
}

/**
 * Envía el comprobante firmado al SRI para validación
 */
export async function enviarComprobante(xmlFirmado: string): Promise<{
  ok: boolean;
  estado: string;
  comprobantes: { claveAcceso: string; mensajes: { tipo: string; mensaje: string; informacionAdicional?: string }[] }[];
}> {
  const endpoint = SRI_ENDPOINTS[SRI_CONFIG.ambiente].recepcion;

  // Encode XML in base64 for SOAP
  const xmlBase64 = Buffer.from(xmlFirmado, 'utf-8').toString('base64');

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${xmlBase64}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await sriFetch(endpoint, soapEnvelope);

  const text = await res.text();

  // Parse response
  const estado = extractTag(text, 'estado') || 'DESCONOCIDO';
  const ok = estado === 'RECIBIDA';

  // Extract messages from <mensaje> blocks
  const mensajes: { tipo: string; mensaje: string; informacionAdicional?: string }[] = [];
  const regex = /<mensaje>\s*<identificador>[^<]*<\/identificador>\s*<mensaje>([^<]*)<\/mensaje>\s*(?:<informacionAdicional>([^<]*)<\/informacionAdicional>\s*)?<tipo>([^<]*)<\/tipo>\s*<\/mensaje>/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    mensajes.push({ tipo: m[3], mensaje: m[1], informacionAdicional: m[2] || undefined });
  }
  // Fallback: simple extraction
  if (mensajes.length === 0) {
    const simple = text.match(/<mensaje>([^<]+)<\/mensaje>/g);
    if (simple) simple.forEach(s => {
      const val = s.replace(/<\/?mensaje>/g, '').trim();
      if (val) mensajes.push({ tipo: '', mensaje: val });
    });
  }

  return {
    ok,
    estado,
    comprobantes: [{ claveAcceso: extractTag(text, 'claveAcceso') || '', mensajes }],
  };
}

/**
 * Consulta la autorización de un comprobante por clave de acceso
 */
export async function consultarAutorizacion(claveAcceso: string): Promise<{
  autorizado: boolean;
  numeroAutorizacion: string;
  fechaAutorizacion: string;
  estado: string;
  mensajes: { tipo: string; mensaje: string; informacionAdicional?: string }[];
  xmlAutorizado?: string;
}> {
  const endpoint = SRI_ENDPOINTS[SRI_CONFIG.ambiente].autorizacion;

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await sriFetch(endpoint, soapEnvelope);

  const text = await res.text();

  const estado = extractTag(text, 'estado') || 'DESCONOCIDO';
  const autorizado = estado === 'AUTORIZADO';
  const numeroAutorizacion = extractTag(text, 'numeroAutorizacion') || '';
  const fechaAutorizacion = extractTag(text, 'fechaAutorizacion') || '';

  const mensajes: { tipo: string; mensaje: string; informacionAdicional?: string }[] = [];
  const regex2 = /<mensaje>\s*<identificador>[^<]*<\/identificador>\s*<mensaje>([^<]*)<\/mensaje>\s*(?:<informacionAdicional>([^<]*)<\/informacionAdicional>\s*)?<tipo>([^<]*)<\/tipo>\s*<\/mensaje>/g;
  let m2;
  while ((m2 = regex2.exec(text)) !== null) {
    mensajes.push({ tipo: m2[3], mensaje: m2[1], informacionAdicional: m2[2] || undefined });
  }
  if (mensajes.length === 0) {
    const simple = text.match(/<mensaje>([^<]+)<\/mensaje>/g);
    if (simple) simple.forEach(s => {
      const val = s.replace(/<\/?mensaje>/g, '').trim();
      if (val) mensajes.push({ tipo: '', mensaje: val });
    });
  }

  return { autorizado, numeroAutorizacion, fechaAutorizacion, estado, mensajes };
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}
