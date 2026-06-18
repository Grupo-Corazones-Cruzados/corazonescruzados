import { SRI_CONFIG } from './config';

/**
 * Descompone una fecha en sus partes de día/mes/año **en hora de Ecuador**
 * (America/Guayaquil = UTC-5 fijo, sin horario de verano).
 *
 * El servidor de producción (Railway) corre en UTC: usar `getDate()/getMonth()`
 * sobre `new Date()` lee la fecha en UTC, que entre las 19:00 y medianoche de
 * Ecuador ya está en el día siguiente. El SRI entonces rechaza el comprobante con
 * "FECHA EMISION EXTEMPORANEA … es mayor a la fecha del servidor". Calcular las
 * partes restando 5h y leyendo getUTC* da la fecha de pared de Ecuador sin
 * importar la zona del servidor.
 */
export function ecuadorDateParts(fecha: Date): { dd: string; mm: string; aaaa: string } {
  const ec = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
  return {
    dd: String(ec.getUTCDate()).padStart(2, '0'),
    mm: String(ec.getUTCMonth() + 1).padStart(2, '0'),
    aaaa: String(ec.getUTCFullYear()),
  };
}

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
  const { dd, mm, aaaa } = ecuadorDateParts(fecha);
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
