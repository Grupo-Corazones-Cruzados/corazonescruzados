import { SRI_CONFIG } from './config';

/**
 * Genera la clave de acceso de 49 dígitos para el SRI
 * Estructura:
 * - 8 dígitos: fecha (ddmmaaaa)
 * - 2 dígitos: tipo comprobante
 * - 13 dígitos: RUC
 * - 1 dígito: ambiente
 * - 3 dígitos: establecimiento (serie)
 * - 3 dígitos: punto de emisión (serie)
 * - 9 dígitos: secuencial
 * - 8 dígitos: código numérico
 * - 1 dígito: tipo de emisión
 * + 1 dígito verificador (módulo 11) = 49 total
 */
export function generateAccessKey(fecha: Date, secuencial: number): string {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const aaaa = String(fecha.getFullYear());
  const fechaStr = `${dd}${mm}${aaaa}`;

  const tipoComp = SRI_CONFIG.tipoComprobante;
  const ruc = SRI_CONFIG.ruc;
  const ambiente = SRI_CONFIG.ambiente;
  const serie = `${SRI_CONFIG.establecimiento}${SRI_CONFIG.puntoEmision}`;
  const seq = String(secuencial).padStart(9, '0');
  const codigoNumerico = String(Math.floor(Math.random() * 99999999) + 1).padStart(8, '0');
  const tipoEmision = SRI_CONFIG.tipoEmision;

  const base = `${fechaStr}${tipoComp}${ruc}${ambiente}${serie}${seq}${codigoNumerico}${tipoEmision}`;

  const digitoVerificador = modulo11(base);
  return `${base}${digitoVerificador}`;
}

/**
 * Cálculo del dígito verificador módulo 11
 */
function modulo11(cadena: string): string {
  const pesos = [2, 3, 4, 5, 6, 7];
  let suma = 0;
  let pesoIdx = 0;

  for (let i = cadena.length - 1; i >= 0; i--) {
    suma += parseInt(cadena[i]) * pesos[pesoIdx % pesos.length];
    pesoIdx++;
  }

  const residuo = suma % 11;
  let digito = 11 - residuo;
  if (digito === 11) digito = 0;
  if (digito === 10) digito = 1;

  return String(digito);
}

/**
 * Formatea el número de factura
 */
export function formatInvoiceNumber(secuencial: number): string {
  return `${SRI_CONFIG.establecimiento}-${SRI_CONFIG.puntoEmision}-${String(secuencial).padStart(9, '0')}`;
}
