import { QUOTE_NOTES } from '@/lib/cotizaciones/notes';

/** Colores del tema corporativo GCC World (.corp), iguales a los del dashboard/correos. */
const C = {
  bg: '#faf9f8', card: '#ffffff', border: '#e1dfdd', text: '#242424',
  muted: '#605e5c', soft: '#8a8886', accent: '#4B2D8E', accentLight: '#4B2D8E14', success: '#107c10',
};
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function money(n: number): string {
  return `$${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: any): string {
  try { return new Date(d).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return ''; }
}

/**
 * HTML imprimible (A4) de la cotización ACEPTADA con TODO el contenido de la página pública:
 * encabezado, resumen, requerimientos (con descripción y subtareas), costos adicionales,
 * subtotales, total y notas adicionales. Estilo GCC World.
 */
export function buildQuoteHtml(q: any): string {
  const reqs: any[] = Array.isArray(q.requirements) ? q.requirements : [];
  const adds: any[] = Array.isArray(q.additionalCosts) ? q.additionalCosts : [];

  const metaRows = [
    q.responsibleName ? ['Responsable', esc(q.responsibleName)] : null,
    q.service?.name ? ['Servicio', esc(q.service.name)] : null,
    q.deadline ? ['Entrega estimada', esc(fmtDate(q.deadline))] : null,
    ['Fecha de aceptación', esc(fmtDate(q.quoteDecidedAt || new Date()))],
  ].filter(Boolean) as [string, string][];

  const reqRows = reqs.map((r, i) => {
    const subtasks: string[] = Array.isArray(r.subtasks) ? r.subtasks.filter(Boolean) : [];
    const subsHtml = subtasks.length
      ? `<ul style="margin:6px 0 0;padding:0 0 0 16px;color:${C.muted};font-size:11px;line-height:1.5;">${subtasks.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
      : '';
    const desc = r.description ? `<div style="color:${C.muted};font-size:11.5px;margin-top:3px;line-height:1.5;">${esc(r.description)}</div>` : '';
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.border};vertical-align:top;color:${C.soft};font-size:12px;width:26px;">${i + 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.border};vertical-align:top;">
        <div style="color:${C.text};font-size:13px;font-weight:600;">${esc(r.title)}</div>${desc}${subsHtml}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.border};vertical-align:top;text-align:right;white-space:nowrap;color:${C.accent};font-size:13px;font-weight:600;">${r.cost ? money(r.cost) : '—'}</td>
    </tr>`;
  }).join('');

  const addRows = adds.map((c) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid ${C.border};vertical-align:top;" colspan="2">
        <div style="color:${C.text};font-size:12.5px;font-weight:600;">${esc(c.label)}</div>${c.description ? `<div style="color:${C.muted};font-size:11px;margin-top:2px;">${esc(c.description)}</div>` : ''}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid ${C.border};text-align:right;white-space:nowrap;color:${C.accent};font-size:13px;font-weight:600;">${money(c.amount)}</td>
    </tr>`).join('');

  const totalsRows = [
    reqs.length ? `<tr><td colspan="2" style="padding:6px 12px;text-align:right;color:${C.muted};font-size:12px;">Subtotal requerimientos</td><td style="padding:6px 12px;text-align:right;color:${C.text};font-size:12px;white-space:nowrap;">${money(q.requirementsSubtotal || 0)}</td></tr>` : '',
    adds.length ? `<tr><td colspan="2" style="padding:6px 12px;text-align:right;color:${C.muted};font-size:12px;">Costos adicionales</td><td style="padding:6px 12px;text-align:right;color:${C.text};font-size:12px;white-space:nowrap;">${money(q.additionalTotal || 0)}</td></tr>` : '',
  ].join('');

  const notesHtml = QUOTE_NOTES.map((n) => `<li style="display:flex;gap:8px;align-items:flex-start;margin:0 0 8px;">
      <span style="color:${C.accent};font-weight:700;line-height:1.4;">✓</span>
      <span style="color:${C.text};font-size:12.5px;line-height:1.55;">${esc(n)}</span>
    </li>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: ${FONT}; margin: 0; background: ${C.bg}; color: ${C.text}; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 32px 36px 40px; }
  .card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden; }
  h1 { font-size: 22px; font-weight: 700; margin: 0; color: ${C.text}; }
</style></head>
<body>
  <div style="height:6px;background:${C.accent};"></div>
  <div class="wrap">
    <!-- Encabezado -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
      <div>
        <div style="font-size:20px;font-weight:800;color:${C.accent};letter-spacing:-0.01em;">GCC World</div>
        <div style="font-size:11px;font-weight:700;color:${C.accent};text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;">Cotización${q.responsibleName ? ' · ' + esc(q.responsibleName) : ''}</div>
      </div>
      <span style="display:inline-block;padding:5px 12px;background:${C.success}14;color:${C.success};font-size:11px;font-weight:700;letter-spacing:0.04em;border:1px solid ${C.success}55;border-radius:6px;">ACEPTADA</span>
    </div>

    <h1>${esc(q.title || 'Cotización')}</h1>
    ${q.summary ? `<p style="color:${C.muted};font-size:13px;line-height:1.6;margin:8px 0 0;">${esc(q.summary)}</p>` : ''}

    <!-- Datos -->
    <table style="width:100%;border-collapse:collapse;margin:18px 0 0;border:1px solid ${C.border};border-radius:8px;overflow:hidden;">
      ${metaRows.map(([k, v], i) => `<tr>
        <td style="padding:8px 14px;background:${C.bg};color:${C.soft};font-size:11.5px;font-weight:600;width:38%;${i < metaRows.length - 1 ? `border-bottom:1px solid ${C.border};` : ''}">${k}</td>
        <td style="padding:8px 14px;color:${C.text};font-size:12.5px;${i < metaRows.length - 1 ? `border-bottom:1px solid ${C.border};` : ''}">${v}</td>
      </tr>`).join('')}
    </table>

    <!-- Requerimientos -->
    ${reqs.length ? `<div style="margin-top:22px;">
      <div style="font-size:13px;font-weight:700;color:${C.text};margin-bottom:8px;">Requerimientos</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid ${C.border};border-radius:8px;overflow:hidden;">
        <thead><tr style="background:${C.bg};">
          <th style="padding:8px 12px;text-align:left;color:${C.soft};font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">#</th>
          <th style="padding:8px 12px;text-align:left;color:${C.soft};font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Detalle</th>
          <th style="padding:8px 12px;text-align:right;color:${C.soft};font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Costo</th>
        </tr></thead>
        <tbody>${reqRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Costos adicionales -->
    ${adds.length ? `<div style="margin-top:18px;">
      <div style="font-size:13px;font-weight:700;color:${C.text};margin-bottom:8px;">Costos adicionales</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid ${C.border};border-radius:8px;overflow:hidden;"><tbody>${addRows}</tbody></table>
    </div>` : ''}

    <!-- Totales -->
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${totalsRows}
      <tr><td colspan="2" style="padding:12px;text-align:right;font-size:15px;font-weight:700;color:${C.text};border-top:2px solid ${C.border};">Total</td>
      <td style="padding:12px;text-align:right;font-size:20px;font-weight:800;color:${C.accent};white-space:nowrap;border-top:2px solid ${C.border};">${money(q.total || 0)}</td></tr>
    </table>

    <!-- Notas adicionales -->
    <div class="card" style="margin-top:22px;padding:18px 20px;">
      <div style="font-size:13px;font-weight:700;color:${C.text};margin-bottom:12px;">Notas adicionales</div>
      <ul style="list-style:none;margin:0;padding:0;">${notesHtml}</ul>
    </div>

    <p style="text-align:center;color:${C.soft};font-size:11px;margin:26px 0 0;">GCC World · Documento generado automáticamente al aceptar la cotización.</p>
  </div>
</body></html>`;
}

/** Convierte el HTML de la cotización a un PDF (Buffer) usando puppeteer. */
export async function renderQuotePdf(q: any): Promise<Buffer> {
  const html = buildQuoteHtml(q);
  // @ts-ignore - puppeteer se resuelve en runtime (no disponible en el build de Docker)
  const puppeteer = (await import(/* webpackIgnore: true */ 'puppeteer')).default;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
