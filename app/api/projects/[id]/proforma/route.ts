import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Resend } from 'resend';
import puppeteer from 'puppeteer';

const LINKS_FILE = path.join(process.cwd(), 'data', 'agent-links.json');

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

async function readJson(file: string): Promise<Record<string, any>> {
  try { return JSON.parse(await fs.readFile(file, 'utf-8')); } catch { return {}; }
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
      const { rows } = await pool.query(
        `SELECT proforma_pdf FROM gcc_world.projects WHERE id = $1`, [id]
      );
      if (rows.length === 0 || !rows[0].proforma_pdf) {
        return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });
      }
      const pdfData = rows[0].proforma_pdf;
      const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Proforma.pdf"`,
        },
      });
    }

    const { rows } = await pool.query(
      `SELECT proforma FROM gcc_world.projects WHERE id = $1`, [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ proforma: rows[0].proforma || null });
  } catch (err: any) {
    console.error('Proforma GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

// POST: generate proforma via Claude CLI and save it
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Localhost check
    const host = req.headers.get('host') || '';
    if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      return NextResponse.json({ error: 'Solo disponible en localhost' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { senderName, targetAmount, clientName, clientEmail, clientPhone } = body;

    if (!senderName || !targetAmount || !clientName) {
      return NextResponse.json({ error: 'Se requiere nombre del remitente, nombre del cliente y monto objetivo' }, { status: 400 });
    }

    await ensureProformaColumn();

    // 1. Fetch project + client data
    const { rows: projectRows } = await pool.query(
      `SELECT p.*, c.name as client_name, c.email as client_email, c.phone as client_phone
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [id]
    );
    if (projectRows.length === 0) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const project = projectRows[0];

    if (!project.digimundo_project_id) {
      return NextResponse.json({ error: 'El proyecto debe estar vinculado a un proyecto DigiMundo' }, { status: 400 });
    }

    // 2. Get DigiMundo project to find agentId
    const { rows: digiRows } = await pool.query(
      `SELECT id, name, "agentId" FROM gcc_world."Project" WHERE id = $1`, [project.digimundo_project_id]
    );
    if (digiRows.length === 0) return NextResponse.json({ error: 'Proyecto DigiMundo no encontrado' }, { status: 404 });

    const digiProject = digiRows[0];

    // 3. Get the project path from agent-links
    const links = await readJson(LINKS_FILE);
    const projectPath = links[digiProject.agentId];
    if (!projectPath) {
      return NextResponse.json({ error: 'El agente no tiene un directorio de proyecto vinculado. Configura el path del proyecto en el chat del agente.' }, { status: 400 });
    }

    // Verify path exists
    try { await fs.access(projectPath); } catch {
      return NextResponse.json({ error: `El directorio del proyecto no existe: ${projectPath}` }, { status: 400 });
    }

    // 4. Generate proforma number
    const now = new Date();
    const proformaNumber = `PRO-${now.getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
    const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

    // 5. Build the prompt for Claude CLI
    const prompt = buildClaudePrompt({
      project,
      digiProjectName: digiProject.name,
      senderName,
      targetAmount,
      proformaNumber,
      dateStr,
      clientName,
      clientEmail: clientEmail || '',
      clientPhone: clientPhone || '',
    });

    // 6. Run Claude CLI in the project directory
    const proformaHtml = await runClaudeCli(prompt, projectPath);

    // 7. Convert HTML to PDF with puppeteer
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await htmlToPdf(proformaHtml);
    } catch (pdfErr: any) {
      console.error('PDF generation error:', pdfErr.message);
      // Save HTML even if PDF fails
      await pool.query(
        `UPDATE gcc_world.projects SET proforma = $1, updated_at = NOW() WHERE id = $2`,
        [proformaHtml, id]
      );
      return NextResponse.json({ proforma: proformaHtml, emailsSent: 0, pdfError: pdfErr.message });
    }

    // 8. Save HTML + PDF to database
    await pool.query(
      `UPDATE gcc_world.projects SET proforma = $1, proforma_pdf = $2, updated_at = NOW() WHERE id = $3`,
      [proformaHtml, pdfBuffer, id]
    );

    return NextResponse.json({ proforma: proformaHtml });
  } catch (err: any) {
    console.error('Proforma POST error:', err.message);
    return NextResponse.json({ error: err.message || 'Error generando proforma' }, { status: 500 });
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

    // Get PDF
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

async function ensureProformaColumn() {
  try {
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS proforma TEXT`);
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS proforma_pdf BYTEA`);
  } catch {}
}

function buildClaudePrompt(data: {
  project: any;
  digiProjectName: string;
  senderName: string;
  targetAmount: number;
  proformaNumber: string;
  dateStr: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
}): string {
  const { project, digiProjectName, senderName, targetAmount, proformaNumber, dateStr, clientName, clientEmail, clientPhone } = data;

  const projectTitle = project.title || digiProjectName;
  const deadline = project.deadline ? new Date(project.deadline).toLocaleDateString('es-ES') : '';

  return `IMPORTANTE: NO uses herramientas de escritura (Write, Edit). NO crees archivos. Tu respuesta debe ser UNICAMENTE el HTML puro como texto plano en tu mensaje.

Analiza este proyecto leyendo su codigo fuente, estructura, README, y cualquier archivo relevante para comprender de que se trata, que tecnologias usa, que funcionalidades tiene y su proposito.

Luego, responde DIRECTAMENTE con el HTML completo de una proforma profesional para este proyecto.

DATOS FIJOS (usa estos exactamente, NO inventes otros):
- Numero de proforma: ${proformaNumber}
- Remitente: ${senderName}
- Nombre de la empresa: Grupo Corazones Cruzados
- Subtitulo de la empresa: GCC
- Email de la empresa: lfgonzalezm0@grupocc.org
- Cliente: ${clientName}
- Email cliente: ${clientEmail}
- Telefono cliente: ${clientPhone}
- Nombre del proyecto: ${projectTitle}
- Fecha de emision: ${dateStr}
- Validez: 30 dias
- Moneda: USD (Dolares americanos)
- Monto total objetivo: $${targetAmount} USD
${deadline ? `- Deadline del proyecto: ${deadline}` : ''}

INSTRUCCIONES PARA EL CONTENIDO:
1. Los items de la proforma deben ser un desglose profesional del trabajo que implica este proyecto, basado en tu analisis real del codigo y estructura. NO copies los requerimientos del sistema de gestion - genera tu propio desglose inteligente.
2. Cada item debe tener un titulo claro, una descripcion detallada de 1-2 lineas, y un monto.
3. Los montos deben sumar EXACTAMENTE $${targetAmount}.00 USD. Distribuye de forma razonable segun complejidad.
4. La seccion de "Alcance del entregable" debe listar las funcionalidades reales que tiene o tendra el proyecto (basate en el codigo).
5. Los terminos y condiciones deben ser especificos para este tipo de proyecto, no genericos.
6. No uses acentos ni caracteres especiales (usa "Analisis" no "Análisis", "diseno" no "diseño").

DEBES usar EXACTAMENTE este template HTML/CSS. Solo reemplaza el contenido entre los tags, no cambies los estilos ni la estructura:

<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proforma ${proformaNumber} | Grupo Corazones Cruzados</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1d1d1f; background: #ffffff; font-size: 14px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    .page { max-width: 800px; margin: 0 auto; padding: 60px 64px; min-height: 100vh; }
    @media print { .page { padding: 40px 48px; min-height: auto; } .no-print { display: none !important; } }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 56px; padding-bottom: 32px; border-bottom: 1px solid #e5e5e7; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-icon { width: 44px; height: 44px; border-radius: 10px; overflow: hidden; }
    .brand-icon img { width: 100%; height: 100%; object-fit: cover; }
    .brand-text h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; color: #1d1d1f; }
    .brand-text p { font-size: 11px; color: #86868b; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; }
    .doc-type { text-align: right; }
    .doc-type h2 { font-size: 28px; font-weight: 300; color: #1d1d1f; letter-spacing: -0.5px; }
    .doc-type .doc-number { font-size: 13px; color: #86868b; font-weight: 500; margin-top: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 48px; }
    .info-block h3 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: #86868b; margin-bottom: 12px; }
    .info-block p { font-size: 14px; color: #1d1d1f; line-height: 1.7; }
    .info-block .name { font-weight: 600; font-size: 15px; }
    .dates-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 48px; padding: 20px 24px; background: #f5f5f7; border-radius: 12px; }
    .date-item label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #86868b; margin-bottom: 4px; }
    .date-item span { font-size: 14px; font-weight: 500; color: #1d1d1f; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    .items-table thead th { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #86868b; padding: 0 0 12px 0; text-align: left; border-bottom: 1px solid #e5e5e7; }
    .items-table thead th:last-child { text-align: right; }
    .items-table tbody td { padding: 20px 0; vertical-align: top; border-bottom: 1px solid #f0f0f2; }
    .items-table tbody tr:last-child td { border-bottom: 1px solid #e5e5e7; }
    .item-number { font-size: 12px; color: #86868b; font-weight: 500; width: 32px; }
    .item-title { font-weight: 600; font-size: 14px; color: #1d1d1f; margin-bottom: 4px; }
    .item-desc { font-size: 12px; color: #6e6e73; line-height: 1.5; max-width: 420px; }
    .item-amount { text-align: right; font-weight: 500; font-size: 14px; white-space: nowrap; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 48px; }
    .totals-box { width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #6e6e73; }
    .totals-row.total { padding: 16px 0 0 0; margin-top: 8px; border-top: 2px solid #1d1d1f; font-size: 20px; font-weight: 600; color: #1d1d1f; letter-spacing: -0.3px; }
    .scope { margin-bottom: 48px; padding: 28px 32px; background: #f5f5f7; border-radius: 12px; }
    .scope h3 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: #86868b; margin-bottom: 16px; }
    .scope-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
    .scope-item { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #1d1d1f; line-height: 1.5; }
    .scope-item .check { color: #34c759; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
    .scope-item .pending { color: #ff9500; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
    .scope-item .tag { display: inline-block; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 1px 6px; border-radius: 4px; margin-left: 4px; }
    .scope-item .tag-future { background: #fff3e0; color: #e65100; }
    .terms { margin-bottom: 48px; }
    .terms h3 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: #86868b; margin-bottom: 16px; }
    .terms ol { padding-left: 20px; }
    .terms li { font-size: 12px; color: #6e6e73; line-height: 1.7; margin-bottom: 6px; }
    .footer { padding-top: 32px; border-top: 1px solid #e5e5e7; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-left p { font-size: 11px; color: #86868b; line-height: 1.7; }
    .footer-right { text-align: right; }
    .footer-right .signature-line { width: 200px; border-bottom: 1px solid #d2d2d7; margin-bottom: 8px; margin-left: auto; padding-top: 48px; }
    .footer-right .signature-label { font-size: 10px; color: #86868b; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; }
    .print-btn { position: fixed; bottom: 32px; right: 32px; background: #1d1d1f; color: white; border: none; padding: 12px 24px; border-radius: 980px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.15); transition: all 0.2s ease; }
    .print-btn:hover { background: #424245; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
  </style>
</head>
<body>
<div class="page">
  <!-- Header: Logo (img src="/LogoApp.png") + "Grupo Corazones Cruzados" + subtitulo "GCC" left, "Proforma" + number right -->
  <!-- Info Grid: "De" (Grupo Corazones Cruzados + remitente + lfgonzalezm0@grupocc.org) left, "Para" (cliente + proyecto) right -->
  <!-- Dates Row: fecha emision, validez 30 dias, moneda USD -->
  <!-- Items Table: # | Descripcion (titulo + desc) | Monto -->
  <!-- Totals: subtotal, impuestos $0.00, total -->
  <!-- Scope: grid 2 cols con checks verdes para incluidos, puntos naranjas para fase 2 -->
  <!-- Terms: ol con terminos especificos -->
  <!-- Footer: "Grupo Corazones Cruzados" + proforma number left, firma de aceptacion right -->
</div>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
</body>
</html>

REGLAS DE RESPUESTA CRITICAS:
- NO uses la herramienta Write ni Edit. NO crees ningun archivo.
- NO uses bloques de codigo markdown (no uses triple backticks).
- NO agregues explicaciones, comentarios ni tablas antes o despues del HTML.
- Tu respuesta completa debe ser SOLAMENTE el documento HTML, empezando con <!DOCTYPE html> y terminando con </html>.
- Escribe el HTML directamente como texto plano en tu mensaje de respuesta.`;
}

function buildProformaEmail(data: {
  clientName: string;
  projectTitle: string;
  proformaNumber: string;
  targetAmount: number;
  senderName: string;
  projectUrl: string;
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
    <p style="color:#888;font-size:12px;margin:16px 0 0;text-align:center;">La proforma detallada ha sido generada y esta disponible para tu revision. Si tienes consultas, no dudes en contactarnos.</p>
  </div>
  <div style="height:3px;background:#4B2D8E;"></div>
</div>
</div>`;
}

async function htmlToPdf(html: string): Promise<Buffer> {
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

function runClaudeCli(prompt: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use stream-json like the working chat system
    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--max-turns', '10',
    ];

    const proc = spawn('claude', args, {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
    });

    // Collect all text blocks from assistant messages (same approach as chat)
    const textBlocks: string[] = [];
    let stdoutBuffer = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'assistant') {
            const contents = event.message?.content || [];
            for (const block of contents) {
              if (block.type === 'text') {
                textBlocks.push(block.text);
              }
            }
          }
        } catch { /* ignore parse errors for non-JSON lines */ }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Claude CLI timeout (5 min)'));
    }, 300_000);

    proc.on('close', (code) => {
      clearTimeout(timeout);

      // Process any remaining buffer
      if (stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(stdoutBuffer);
          if (event.type === 'assistant') {
            const contents = event.message?.content || [];
            for (const block of contents) {
              if (block.type === 'text') textBlocks.push(block.text);
            }
          }
        } catch {}
      }

      if (textBlocks.length === 0) {
        reject(new Error(`Claude CLI no produjo respuesta de texto. Exit code: ${code}. Stderr: ${stderr.slice(0, 500)}`));
        return;
      }

      // Join all text blocks - the last one should contain the HTML
      // Claude may output explanatory text first, then the HTML
      const fullText = textBlocks.join('');

      // Extract HTML from the response
      let html = fullText;

      // Remove markdown code fences if present
      const fenceMatch = html.match(/```html?\s*\n?([\s\S]*?)\n?```/i);
      if (fenceMatch) {
        html = fenceMatch[1];
      }

      html = html.trim();

      // Try to extract just the HTML if there's extra text around it
      const htmlStart = html.indexOf('<!DOCTYPE');
      if (htmlStart === -1) {
        const htmlStart2 = html.indexOf('<html');
        if (htmlStart2 !== -1) {
          html = html.substring(htmlStart2);
        }
      } else {
        html = html.substring(htmlStart);
      }

      // Trim anything after closing </html>
      const htmlEnd = html.lastIndexOf('</html>');
      if (htmlEnd !== -1) {
        html = html.substring(0, htmlEnd + 7);
      }

      if (!html.includes('<html')) {
        // Fallback: Claude may have written a file instead of outputting HTML
        // Look for a filename pattern like proforma_PRO-2026-XXXX.html or similar
        const fileMatch = fullText.match(/([a-zA-Z0-9_\-]+\.html)/);
        if (fileMatch) {
          try {
            const filePath = require('path').join(cwd, fileMatch[1]);
            const fileContent = require('fs').readFileSync(filePath, 'utf-8');
            if (fileContent.includes('<html')) {
              // Clean up the file Claude created
              try { require('fs').unlinkSync(filePath); } catch {}
              resolve(fileContent);
              return;
            }
          } catch {}
        }

        reject(new Error(`Claude no genero HTML valido. Respuesta (primeros 500 chars): ${fullText.slice(0, 500)}`));
        return;
      }

      resolve(html);
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Claude CLI error: ${err.message}`));
    });
  });
}
