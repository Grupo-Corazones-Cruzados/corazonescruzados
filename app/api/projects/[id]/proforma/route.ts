import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Resend } from 'resend';
// puppeteer loaded dynamically at runtime to avoid webpack bundling

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

async function ensureProformaColumn() {
  try {
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS proforma TEXT`);
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS proforma_pdf BYTEA`);
  } catch {}
}

// GET: return existing proforma HTML or PDF
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureProformaColumn();

    const format = req.nextUrl.searchParams.get('format');

    if (format === 'pdf') {
      const { rows } = await pool.query(`SELECT proforma_pdf FROM gcc_world.projects WHERE id = $1`, [id]);
      if (rows.length === 0 || !rows[0].proforma_pdf) {
        return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });
      }
      const pdfBuffer = Buffer.isBuffer(rows[0].proforma_pdf) ? rows[0].proforma_pdf : Buffer.from(rows[0].proforma_pdf);
      return new NextResponse(pdfBuffer, {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="Proforma.pdf"' },
      });
    }

    const { rows } = await pool.query(`SELECT proforma FROM gcc_world.projects WHERE id = $1`, [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ proforma: rows[0].proforma || null });
  } catch (err: any) {
    console.error('Proforma GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

// POST: save proforma HTML (convert to PDF and store)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { html } = await req.json();

    if (!html || !html.includes('<html')) {
      return NextResponse.json({ error: 'HTML de proforma invalido' }, { status: 400 });
    }

    await ensureProformaColumn();

    // Convert HTML to PDF
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await htmlToPdf(html);
    } catch (pdfErr: any) {
      console.error('PDF generation error:', pdfErr.message);
    }

    // Save HTML + PDF to database
    if (pdfBuffer) {
      await pool.query(
        `UPDATE gcc_world.projects SET proforma = $1, proforma_pdf = $2, updated_at = NOW() WHERE id = $3`,
        [html, pdfBuffer, id]
      );
    } else {
      await pool.query(
        `UPDATE gcc_world.projects SET proforma = $1, updated_at = NOW() WHERE id = $2`,
        [html, id]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Proforma POST error:', err.message);
    return NextResponse.json({ error: err.message || 'Error guardando proforma' }, { status: 500 });
  }
}

// PUT: send existing proforma by email
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { emails, clientName, projectTitle, proformaNumber, targetAmount, senderName } = await req.json();

    if (!emails) return NextResponse.json({ error: 'Se requiere al menos un correo' }, { status: 400 });

    const emailList: string[] = (typeof emails === 'string' ? emails.split(',') : emails)
      .map((e: string) => e.trim()).filter(Boolean);

    if (emailList.length === 0) return NextResponse.json({ error: 'Se requiere al menos un correo' }, { status: 400 });

    await ensureProformaColumn();

    const { rows } = await pool.query(`SELECT proforma_pdf FROM gcc_world.projects WHERE id = $1`, [id]);
    if (!rows[0]?.proforma_pdf) return NextResponse.json({ error: 'No hay PDF de proforma generado' }, { status: 404 });

    const pdfBuffer = Buffer.isBuffer(rows[0].proforma_pdf) ? rows[0].proforma_pdf : Buffer.from(rows[0].proforma_pdf);

    // Generate project access URL with token if private
    let projectUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org'}/proyecto/${id}`;
    const { rows: [projInfo] } = await pool.query(`SELECT is_private FROM gcc_world.projects WHERE id = $1`, [id]);

    if (projInfo?.is_private) {
      await pool.query(`
        ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token VARCHAR(64);
        ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;
      `);
      const newToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await pool.query(`UPDATE gcc_world.projects SET public_token = $1, public_token_expires_at = $2 WHERE id = $3`, [newToken, expiresAt, id]);
      projectUrl += `?token=${newToken}`;
    }

    const emailHtml = buildProformaEmail({
      clientName: clientName || 'Cliente',
      projectTitle: projectTitle || 'Proyecto',
      proformaNumber: proformaNumber || 'PRO-0000',
      targetAmount: targetAmount || 0,
      senderName: senderName || 'Grupo Corazones Cruzados',
      projectUrl,
    });

    try {
      await getResend().emails.send({
        from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
        to: emailList,
        bcc: 'lfgonzalezm0@grupocc.org',
        subject: `Proforma ${proformaNumber || ''} — ${projectTitle || 'Proyecto'} | Grupo Corazones Cruzados`,
        html: emailHtml,
        attachments: [{
          filename: `Proforma-${proformaNumber || 'GCC'}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }],
      });
    } catch (emailErr: any) {
      console.error('Error sending proforma email:', emailErr.message);
      return NextResponse.json({ error: emailErr.message }, { status: 500 });
    }

    return NextResponse.json({ emailsSent: emailList.length });
  } catch (err: any) {
    console.error('Proforma PUT error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// --- Helpers ---

function buildProformaEmail(data: {
  clientName: string; projectTitle: string; proformaNumber: string;
  targetAmount: number; senderName: string; projectUrl: string;
}): string {
  const { clientName, projectTitle, proformaNumber, targetAmount, senderName, projectUrl } = data;
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;padding:0;margin:0;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="height:6px;background:#4B2D8E;"></div>
  <div style="padding:30px 40px;">
    <h1 style="color:#1a1a2e;font-size:22px;margin:0 0 6px;">Hola ${clientName}!</h1>
    <p style="color:#888;font-size:14px;margin:0 0 24px;">Te hacemos llegar la proforma de tu proyecto. Revisa los detalles a continuacion.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;width:40%"><strong>Documento:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">Proforma</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>No. Proforma:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${proformaNumber}</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Proyecto:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${projectTitle}</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Remitente:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${senderName} - Grupo Corazones Cruzados</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Validez:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">30 dias desde la emision</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;"><strong>Valor Total:</strong></td><td style="padding:10px 16px;font-size:18px;font-weight:bold;color:#1a1a2e;">$${Number(targetAmount).toFixed(2)} USD</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0 0;">
      <a href="${projectUrl}" style="display:inline-block;padding:12px 24px;background:#4B2D8E;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;border-radius:4px;">Ver Detalle del Proyecto</a>
    </div>
    <p style="color:#888;font-size:12px;margin:16px 0 0;text-align:center;">La proforma detallada ha sido generada y esta disponible para tu revision.</p>
  </div>
  <div style="height:3px;background:#4B2D8E;"></div>
</div>
</div>`;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  // @ts-ignore - puppeteer resolved at runtime, not available during Docker build
  const puppeteer = (await import(/* webpackIgnore: true */ 'puppeteer')).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}
