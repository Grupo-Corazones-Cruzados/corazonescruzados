import { SRI_CONFIG, getTipoIdentificacion } from './config';
import { generateAccessKey, formatInvoiceNumber, ecuadorDateParts } from './access-key';
import { sriText, sriAttr, SRI_MAX } from './text';

export interface InvoiceItem {
  codigoPrincipal?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  ivaRate: number; // 0, 5, 15
}

export interface PaymentMethod {
  code: string; // 01=Sin sist. financiero, 16=Tarjeta débito, 19=Tarjeta crédito, 20=Otros sist. financiero
  total: number;
  term?: number;
  timeUnit?: string; // dias, meses
}

export interface AdditionalField {
  name: string;
  value: string;
}

export interface InvoiceData {
  secuencial: number;
  fecha: Date;
  clienteIdTipo?: string; // 04=RUC, 05=Cedula, 06=Pasaporte, 07=Consumidor Final, 08=Id. Exterior
  clienteRuc: string;
  clienteNombre: string;
  clienteDireccion?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  items: InvoiceItem[];
  payments?: PaymentMethod[];
  additionalFields?: AdditionalField[];
}

/**
 * Construye el XML de la factura electrónica según esquema del SRI
 */
export function buildFacturaXml(data: InvoiceData): { xml: string; claveAcceso: string; numeroFactura: string } {
  const claveAcceso = generateAccessKey(data.fecha, data.secuencial);
  const numeroFactura = formatInvoiceNumber(data.secuencial);

  const { dd, mm, aaaa } = ecuadorDateParts(data.fecha);
  const fechaEmision = `${dd}/${mm}/${aaaa}`;

  const tipoIdComprador = data.clienteIdTipo || getTipoIdentificacion(data.clienteRuc);

  // SRI requires 9999999999999 for exterior (08) identification
  const idCompradorSri = tipoIdComprador === '08' ? '9999999999999' : data.clienteRuc;
  // Keep real ID for additional fields
  const realIdExterior = tipoIdComprador === '08' && data.clienteRuc !== '9999999999999' ? data.clienteRuc : null;

  // IVA code mapping: rate -> codigoPorcentaje
  const ivaCodeMap: Record<number, string> = { 0: '0', 5: '5', 15: '4' };

  // Calculate totals per IVA rate
  const ivaTotals: Record<number, { base: number; iva: number }> = {};
  let totalSinImpuestos = 0;
  let totalDescuento = 0;

  const detallesXml = data.items.map((item, idx) => {
    const discount = item.discount || 0;
    const subtotal = Math.round((item.quantity * item.unitPrice - discount) * 100) / 100;
    totalSinImpuestos += subtotal;
    totalDescuento += discount;

    const ivaMonto = Math.round(subtotal * (item.ivaRate / 100) * 100) / 100;
    if (!ivaTotals[item.ivaRate]) ivaTotals[item.ivaRate] = { base: 0, iva: 0 };
    ivaTotals[item.ivaRate].base += subtotal;
    ivaTotals[item.ivaRate].iva += ivaMonto;

    const codigoPorcentaje = ivaCodeMap[item.ivaRate] || '0';
    const codigo = item.codigoPrincipal || `SRV${String(idx + 1).padStart(3, '0')}`;

    return `
      <detalle>
        <codigoPrincipal>${sriText(codigo, SRI_MAX.codigoPrincipal)}</codigoPrincipal>
        <descripcion>${sriText(item.description, SRI_MAX.descripcion)}</descripcion>
        <cantidad>${item.quantity.toFixed(2)}</cantidad>
        <precioUnitario>${item.unitPrice.toFixed(2)}</precioUnitario>
        <descuento>${discount.toFixed(2)}</descuento>
        <precioTotalSinImpuesto>${subtotal.toFixed(2)}</precioTotalSinImpuesto>
        <impuestos>
          <impuesto>
            <codigo>2</codigo>
            <codigoPorcentaje>${codigoPorcentaje}</codigoPorcentaje>
            <tarifa>${item.ivaRate.toFixed(2)}</tarifa>
            <baseImponible>${subtotal.toFixed(2)}</baseImponible>
            <valor>${ivaMonto.toFixed(2)}</valor>
          </impuesto>
        </impuestos>
      </detalle>`;
  }).join('');

  // Total IVA amount
  const totalIvaMonto = Object.values(ivaTotals).reduce((s, t) => s + t.iva, 0);
  const importeTotal = Math.round((totalSinImpuestos + totalIvaMonto) * 100) / 100;

  // Build totalConImpuestos
  const totalConImpuestosXml = Object.entries(ivaTotals)
    .map(([rate, { base, iva }]) => `
        <totalImpuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${ivaCodeMap[Number(rate)] || '0'}</codigoPorcentaje>
          <baseImponible>${base.toFixed(2)}</baseImponible>
          <valor>${iva.toFixed(2)}</valor>
        </totalImpuesto>`)
    .join('');

  // Build pagos (payment methods)
  const payments = (data.payments?.length ? data.payments : [{ code: '20', total: 0 }])
    .map(p => ({ ...p, total: p.total > 0 ? p.total : importeTotal }));
  const pagosXml = payments.map(p => {
    let pago = `
      <pago>
        <formaPago>${p.code}</formaPago>
        <total>${p.total.toFixed(2)}</total>`;
    if (p.term) pago += `
        <plazo>${p.term}</plazo>
        <unidadTiempo>${p.timeUnit || 'dias'}</unidadTiempo>`;
    pago += `
      </pago>`;
    return pago;
  }).join('');

  // Build infoAdicional
  const additionalFields = [
    ...(data.clienteEmail ? [{ name: 'email', value: data.clienteEmail }] : []),
    ...(data.clienteTelefono ? [{ name: 'telefono', value: data.clienteTelefono }] : []),
    ...(data.clienteDireccion ? [{ name: 'direccion', value: data.clienteDireccion }] : []),
    ...(realIdExterior ? [{ name: 'identificacionExterior', value: realIdExterior }] : []),
    ...(data.additionalFields || []),
  ];
  const infoAdicionalXml = additionalFields.length > 0
    ? `
  <infoAdicional>${additionalFields.map(f => `
    <campoAdicional nombre="${sriAttr(f.name, SRI_MAX.campoAdicionalNombre)}">${sriText(f.value, SRI_MAX.campoAdicionalValor)}</campoAdicional>`).join('')}
  </infoAdicional>`
    : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>${SRI_CONFIG.ambiente}</ambiente>
    <tipoEmision>${SRI_CONFIG.tipoEmision}</tipoEmision>
    <razonSocial>${sriText(SRI_CONFIG.razonSocial, SRI_MAX.razonSocial)}</razonSocial>
    <nombreComercial>${sriText(SRI_CONFIG.nombreComercial, SRI_MAX.nombreComercial)}</nombreComercial>
    <ruc>${SRI_CONFIG.ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>${SRI_CONFIG.tipoComprobante}</codDoc>
    <estab>${SRI_CONFIG.establecimiento}</estab>
    <ptoEmi>${SRI_CONFIG.puntoEmision}</ptoEmi>
    <secuencial>${String(data.secuencial).padStart(9, '0')}</secuencial>
    <dirMatriz>${sriText(SRI_CONFIG.dirMatriz, SRI_MAX.dirMatriz)}</dirMatriz>
${SRI_CONFIG.regimenMicroempresas ? `    <regimenMicroempresas>${sriText(SRI_CONFIG.regimenMicroempresas, 300)}</regimenMicroempresas>\n` : ''}${SRI_CONFIG.agenteRetencion ? `    <agenteRetencion>${SRI_CONFIG.agenteRetencion}</agenteRetencion>` : ''}
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${sriText(SRI_CONFIG.dirEstablecimiento, SRI_MAX.dirEstablecimiento)}</dirEstablecimiento>
    <obligadoContabilidad>${SRI_CONFIG.obligadoContabilidad}</obligadoContabilidad>
    <tipoIdentificacionComprador>${tipoIdComprador}</tipoIdentificacionComprador>
    <razonSocialComprador>${sriText(data.clienteNombre, SRI_MAX.razonSocialComprador)}</razonSocialComprador>
    <identificacionComprador>${idCompradorSri}</identificacionComprador>
    <direccionComprador>${sriText(data.clienteDireccion || 'N/A', SRI_MAX.direccionComprador)}</direccionComprador>
    <totalSinImpuestos>${totalSinImpuestos.toFixed(2)}</totalSinImpuestos>
    <totalDescuento>${totalDescuento.toFixed(2)}</totalDescuento>
    <totalConImpuestos>${totalConImpuestosXml}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${importeTotal.toFixed(2)}</importeTotal>
    <moneda>${SRI_CONFIG.moneda}</moneda>
    <pagos>${pagosXml}
    </pagos>
  </infoFactura>
  <detalles>${detallesXml}
  </detalles>${infoAdicionalXml}
</factura>`;

  return { xml, claveAcceso, numeroFactura };
}
