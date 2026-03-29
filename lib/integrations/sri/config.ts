// Configuración del emisor y SRI para facturación electrónica Ecuador

export const SRI_CONFIG = {
  // Emisor
  ruc: '0930095922001',
  razonSocial: 'GONZALEZ MUYULEMA LUIS FERNANDO',
  nombreComercial: 'GCC WORLD',
  dirMatriz: 'Barrio 7 Lagos, Calle Tabacundo #12, Guasmo Central',
  dirEstablecimiento: 'Barrio 7 Lagos, Calle Tabacundo #12, Guasmo Central',
  obligadoContabilidad: 'NO',
  contribuyenteEspecial: '',
  agenteRetencion: '',
  regimenMicroempresas: '', // RIMPE Negocio Popular no usa este campo

  // Punto de emisión
  establecimiento: '001',
  puntoEmision: '001',

  // Ambiente: 1 = Pruebas, 2 = Producción
  ambiente: '2' as '1' | '2',
  tipoEmision: '1', // 1 = Normal

  // Tipo de comprobante
  tipoComprobante: '01', // 01 = Factura

  // Moneda
  moneda: 'DOLAR',
};

// Endpoints del SRI
export const SRI_ENDPOINTS = {
  '1': {
    recepcion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
  '2': {
    recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
};

// Códigos de impuesto IVA
export const IVA_CODES = {
  '0': { codigo: '0', codigoPorcentaje: '0', tarifa: 0, descripcion: '0%' },
  '15': { codigo: '2', codigoPorcentaje: '4', tarifa: 15, descripcion: '15%' },
};

// Tipos de identificación
export const TIPO_IDENTIFICACION: Record<string, string> = {
  ruc: '04',
  cedula: '05',
  pasaporte: '06',
  consumidorFinal: '07',
  exterior: '08',
};

export const FORMAS_PAGO = [
  { code: '01', label: 'Sin utilizacion del sistema financiero' },
  { code: '15', label: 'Compensacion de deudas' },
  { code: '16', label: 'Tarjeta de debito' },
  { code: '17', label: 'Dinero electronico' },
  { code: '18', label: 'Tarjeta prepago' },
  { code: '19', label: 'Tarjeta de credito' },
  { code: '20', label: 'Otros con utilizacion del sistema financiero' },
  { code: '21', label: 'Endoso de titulos' },
];

export function getTipoIdentificacion(id: string): string {
  if (!id || id === '9999999999999') return TIPO_IDENTIFICACION.consumidorFinal;
  if (id.length === 13 && id.endsWith('001')) return TIPO_IDENTIFICACION.ruc;
  if (id.length === 10) return TIPO_IDENTIFICACION.cedula;
  return TIPO_IDENTIFICACION.pasaporte;
}
