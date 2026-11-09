import { getTipoIdentificacion } from './config';
import type { Emisor } from './emisor';
import { generateAccessKey, formatInvoiceNumber, ecuadorDateParts } from './access-key';
import { sriText, SRI_MAX } from './text';

interface CreditNoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  ivaRate: number;
}

interface CreditNoteData {
  secuencial: number;
  fecha: Date;
  // Factura original
  facturaNumero: string; // 001-001-000000022
  facturaFecha: string;  // dd/mm/aaaa
  // Cliente
  clienteIdTipo?: string;
  clienteRuc: string;
  clienteNombre: string;
  clienteDireccion?: string;
  clienteEmail?: string;
  // Motivo
  motivo: string;
  items: CreditNoteItem[];
}

/**
 * Build Nota de Crédito XML for SRI, a nombre de `emisor` (el de la factura que anula).
 * tipoComprobante = 04 (Nota de Crédito)
 */
export function buildCreditNoteXml(data: CreditNoteData, emisor: Emisor): { xml: string; claveAcceso: string; numero: string } {
  const claveAcceso = generateAccessKey(data.fecha, data.secuencial, emisor, '04');

  const numero = formatInvoiceNumber(data.secuencial, emisor);

  // ⚠️ La fecha de emisión en hora de ECUADOR, la misma que lleva la clave de acceso (`generateAccessKey`). Con
  // `getDate()` el servidor (UTC en Railway) ponía el día siguiente entre las 19:00 y la medianoche de Ecuador: la
  // fecha del XML no coincidía con la de la clave y el SRI la rechaza como extemporánea.
  const { dd, mm, aaaa } = ecuadorDateParts(data.fecha);
  const fechaEmision = `${dd}/${mm}/${aaaa}`;

  const tipoIdComprador = data.clienteIdTipo || getTipoIdentificacion(data.clienteRuc);

  // SRI requires 9999999999999 for exterior (08) identification
  const idCompradorSri = tipoIdComprador === '08' ? '9999999999999' : data.clienteRuc;
  // Keep real ID for additional fields
  const realIdExterior = tipoIdComprador === '08' && data.clienteRuc !== '9999999999999' ? data.clienteRuc : null;

  const ivaCodeMap: Record<number, string> = { 0: '0', 5: '5', 15: '4' };

  // Parse factura number parts
  const facParts = data.facturaNumero.split('-');
  const codDocModificado = '01'; // Factura

  // Calculate totals
  const ivaTotals: Record<number, { base: number; iva: number }> = {};
  let totalSinImpuestos = 0;

  const detallesXml = data.items.map((item, idx) => {
    const discount = item.discount || 0;
    const subtotal = Math.round((item.quantity * item.unitPrice - discount) * 100) / 100;
    totalSinImpuestos += subtotal;
    const ivaMonto = Math.round(subtotal * (item.ivaRate / 100) * 100) / 100;
    if (!ivaTotals[item.ivaRate]) ivaTotals[item.ivaRate] = { base: 0, iva: 0 };
    ivaTotals[item.ivaRate].base += subtotal;
    ivaTotals[item.ivaRate].iva += ivaMonto;
    const codigoPorcentaje = ivaCodeMap[item.ivaRate] || '0';

    return `
      <detalle>
        <codigoInterno>SRV${String(idx + 1).padStart(3, '0')}</codigoInterno>
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

  const totalIvaMonto = Object.values(ivaTotals).reduce((s, t) => s + t.iva, 0);
  const importeTotal = Math.round((totalSinImpuestos + totalIvaMonto) * 100) / 100;

  const totalConImpuestosXml = Object.entries(ivaTotals)
    .map(([rate, { base, iva }]) => `
        <totalImpuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${ivaCodeMap[Number(rate)] || '0'}</codigoPorcentaje>
          <baseImponible>${base.toFixed(2)}</baseImponible>
          <valor>${iva.toFixed(2)}</valor>
        </totalImpuesto>`)
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<notaCredito id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${emisor.ambiente}</ambiente>
    <tipoEmision>${emisor.tipoEmision}</tipoEmision>
    <razonSocial>${sriText(emisor.razonSocial, SRI_MAX.razonSocial)}</razonSocial>
${emisor.nombreComercial ? `    <nombreComercial>${sriText(emisor.nombreComercial, SRI_MAX.nombreComercial)}</nombreComercial>\n` : ''}    <ruc>${emisor.ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>04</codDoc>
    <estab>${emisor.establecimiento}</estab>
    <ptoEmi>${emisor.puntoEmision}</ptoEmi>
    <secuencial>${String(data.secuencial).padStart(9, '0')}</secuencial>
    <dirMatriz>${sriText(emisor.dirMatriz, SRI_MAX.dirMatriz)}</dirMatriz>
${emisor.agenteRetencion ? `    <agenteRetencion>${emisor.agenteRetencion}</agenteRetencion>\n` : ''}  </infoTributaria>
  <infoNotaCredito>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${sriText(emisor.dirEstablecimiento, SRI_MAX.dirEstablecimiento)}</dirEstablecimiento>
    <tipoIdentificacionComprador>${tipoIdComprador}</tipoIdentificacionComprador>
    <razonSocialComprador>${sriText(data.clienteNombre, SRI_MAX.razonSocialComprador)}</razonSocialComprador>
    <identificacionComprador>${idCompradorSri}</identificacionComprador>
${emisor.contribuyenteEspecial ? `    <contribuyenteEspecial>${emisor.contribuyenteEspecial}</contribuyenteEspecial>\n` : ''}    <obligadoContabilidad>${emisor.obligadoContabilidad}</obligadoContabilidad>
    <codDocModificado>${codDocModificado}</codDocModificado>
    <numDocModificado>${data.facturaNumero}</numDocModificado>
    <fechaEmisionDocSustento>${data.facturaFecha}</fechaEmisionDocSustento>
    <totalSinImpuestos>${totalSinImpuestos.toFixed(2)}</totalSinImpuestos>
    <valorModificacion>${importeTotal.toFixed(2)}</valorModificacion>
    <moneda>${emisor.moneda}</moneda>
    <totalConImpuestos>${totalConImpuestosXml}
    </totalConImpuestos>
    <motivo>${sriText(data.motivo, SRI_MAX.motivo)}</motivo>
  </infoNotaCredito>
  <detalles>${detallesXml}
  </detalles>
  <infoAdicional>${emisor.contribuyenteRimpe ? `
    <campoAdicional nombre="regimen">${sriText(emisor.contribuyenteRimpe, SRI_MAX.campoAdicionalValor)}</campoAdicional>` : ''}
    <campoAdicional nombre="email">${sriText(data.clienteEmail || '', SRI_MAX.campoAdicionalValor)}</campoAdicional>${realIdExterior ? `
    <campoAdicional nombre="identificacionExterior">${sriText(realIdExterior, SRI_MAX.campoAdicionalValor)}</campoAdicional>` : ''}
  </infoAdicional>
</notaCredito>`;

  return { xml, claveAcceso, numero };
}
