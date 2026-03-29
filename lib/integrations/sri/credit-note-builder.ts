import { SRI_CONFIG, getTipoIdentificacion } from './config';
import { generateAccessKey, formatInvoiceNumber } from './access-key';

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

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Build Nota de Crédito XML for SRI
 * tipoComprobante = 04 (Nota de Crédito)
 */
export function buildCreditNoteXml(data: CreditNoteData): { xml: string; claveAcceso: string; numero: string } {
  // Override tipo comprobante for access key
  const originalTipoComp = SRI_CONFIG.tipoComprobante;
  (SRI_CONFIG as any).tipoComprobante = '04';
  const claveAcceso = generateAccessKey(data.fecha, data.secuencial);
  (SRI_CONFIG as any).tipoComprobante = originalTipoComp;

  const numero = `${SRI_CONFIG.establecimiento}-${SRI_CONFIG.puntoEmision}-${String(data.secuencial).padStart(9, '0')}`;

  const dd = String(data.fecha.getDate()).padStart(2, '0');
  const mm = String(data.fecha.getMonth() + 1).padStart(2, '0');
  const aaaa = String(data.fecha.getFullYear());
  const fechaEmision = `${dd}/${mm}/${aaaa}`;

  const tipoIdComprador = data.clienteIdTipo || getTipoIdentificacion(data.clienteRuc);
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
        <descripcion>${escapeXml(item.description)}</descripcion>
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
    <ambiente>${SRI_CONFIG.ambiente}</ambiente>
    <tipoEmision>${SRI_CONFIG.tipoEmision}</tipoEmision>
    <razonSocial>${escapeXml(SRI_CONFIG.razonSocial)}</razonSocial>
    <nombreComercial>${escapeXml(SRI_CONFIG.nombreComercial)}</nombreComercial>
    <ruc>${SRI_CONFIG.ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>04</codDoc>
    <estab>${SRI_CONFIG.establecimiento}</estab>
    <ptoEmi>${SRI_CONFIG.puntoEmision}</ptoEmi>
    <secuencial>${String(data.secuencial).padStart(9, '0')}</secuencial>
    <dirMatriz>${escapeXml(SRI_CONFIG.dirMatriz)}</dirMatriz>
  </infoTributaria>
  <infoNotaCredito>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${escapeXml(SRI_CONFIG.dirEstablecimiento)}</dirEstablecimiento>
    <tipoIdentificacionComprador>${tipoIdComprador}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(data.clienteNombre)}</razonSocialComprador>
    <identificacionComprador>${data.clienteRuc}</identificacionComprador>
    <obligadoContabilidad>${SRI_CONFIG.obligadoContabilidad}</obligadoContabilidad>
    <codDocModificado>${codDocModificado}</codDocModificado>
    <numDocModificado>${data.facturaNumero}</numDocModificado>
    <fechaEmisionDocSustento>${data.facturaFecha}</fechaEmisionDocSustento>
    <totalSinImpuestos>${totalSinImpuestos.toFixed(2)}</totalSinImpuestos>
    <valorModificacion>${importeTotal.toFixed(2)}</valorModificacion>
    <moneda>${SRI_CONFIG.moneda}</moneda>
    <totalConImpuestos>${totalConImpuestosXml}
    </totalConImpuestos>
    <motivo>${escapeXml(data.motivo)}</motivo>
  </infoNotaCredito>
  <detalles>${detallesXml}
  </detalles>
  <infoAdicional>
    <campoAdicional nombre="email">${escapeXml(data.clienteEmail || '')}</campoAdicional>
  </infoAdicional>
</notaCredito>`;

  return { xml, claveAcceso, numero };
}
