import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// GET: return existing proforma HTML
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;

    // Ensure column exists
    await ensureProformaColumn();

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

// POST: generate proforma via AI and save it
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { senderName, targetAmount } = body;

    if (!senderName || !targetAmount) {
      return NextResponse.json({ error: 'Se requiere nombre del remitente y monto objetivo' }, { status: 400 });
    }

    // Ensure column exists
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

    // 2. Fetch DigiMundo project with full structure (modules > sections > subsections)
    const { rows: digiRows } = await pool.query(
      `SELECT id, name, "agentId" FROM gcc_world."Project" WHERE id = $1`, [project.digimundo_project_id]
    );
    if (digiRows.length === 0) return NextResponse.json({ error: 'Proyecto DigiMundo no encontrado' }, { status: 404 });

    const digiProject = digiRows[0];

    // Fetch modules
    const { rows: modules } = await pool.query(
      `SELECT id, name, description, "order" FROM gcc_world."Module" WHERE "projectId" = $1 ORDER BY "order"`,
      [project.digimundo_project_id]
    );

    // Fetch sections for all modules
    const moduleIds = modules.map((m: any) => m.id);
    let sections: any[] = [];
    let subsections: any[] = [];

    if (moduleIds.length > 0) {
      const { rows: sectionRows } = await pool.query(
        `SELECT id, name, description, "order", "moduleId" FROM gcc_world."Section" WHERE "moduleId" = ANY($1) ORDER BY "order"`,
        [moduleIds]
      );
      sections = sectionRows;

      const sectionIds = sections.map(s => s.id);
      if (sectionIds.length > 0) {
        const { rows: subRows } = await pool.query(
          `SELECT id, name, description, "order", "sectionId" FROM gcc_world."Subsection" WHERE "sectionId" = ANY($1) ORDER BY "order"`,
          [sectionIds]
        );
        subsections = subRows;
      }
    }

    // 3. Fetch project requirements
    const { rows: requirements } = await pool.query(
      `SELECT id, title, description, cost FROM gcc_world.project_requirements WHERE project_id = $1 ORDER BY id`,
      [id]
    );

    // 4. Fetch incidents for context
    const { rows: incidents } = await pool.query(
      `SELECT id, title, description, severity, status FROM gcc_world."Incident" WHERE "projectId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
      [project.digimundo_project_id]
    );

    // 5. Build project context for AI
    const projectContext = buildProjectContext({
      project,
      digiProject,
      modules,
      sections,
      subsections,
      requirements,
      incidents,
      senderName,
      targetAmount,
    });

    // 6. Call OpenAI to generate proforma
    const proformaHtml = await generateProformaWithAI(projectContext);

    // 7. Save to database
    await pool.query(
      `UPDATE gcc_world.projects SET proforma = $1, updated_at = NOW() WHERE id = $2`,
      [proformaHtml, id]
    );

    return NextResponse.json({ proforma: proformaHtml });
  } catch (err: any) {
    console.error('Proforma POST error:', err.message);
    return NextResponse.json({ error: err.message || 'Error generando proforma' }, { status: 500 });
  }
}

async function ensureProformaColumn() {
  try {
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS proforma TEXT`);
  } catch {
    // Column may already exist
  }
}

function buildProjectContext(data: {
  project: any;
  digiProject: any;
  modules: any[];
  sections: any[];
  subsections: any[];
  requirements: any[];
  incidents: any[];
  senderName: string;
  targetAmount: number;
}) {
  const { project, digiProject, modules, sections, subsections, requirements, incidents, senderName, targetAmount } = data;

  // Build hierarchical module structure
  const moduleTree = modules.map(mod => {
    const modSections = sections.filter(s => s.moduleId === mod.id).map(sec => {
      const secSubs = subsections.filter(sub => sub.sectionId === sec.id);
      return {
        name: sec.name,
        description: sec.description,
        subsections: secSubs.map(sub => ({ name: sub.name, description: sub.description })),
      };
    });
    return {
      name: mod.name,
      description: mod.description,
      sections: modSections,
    };
  });

  return `
CONTEXTO DEL PROYECTO:
- Nombre del proyecto: ${project.title}
- Descripcion: ${project.description || 'Sin descripcion'}
- Cliente: ${project.client_name || 'No especificado'}
- Email del cliente: ${project.client_email || 'No especificado'}
- Telefono del cliente: ${project.client_phone || 'No especificado'}
- Presupuesto estimado: ${project.budget_min ? `$${project.budget_min}` : 'No definido'} - ${project.budget_max ? `$${project.budget_max}` : 'No definido'}
- Deadline: ${project.deadline ? new Date(project.deadline).toLocaleDateString('es-ES') : 'No definido'}

ESTRUCTURA DEL PROYECTO (DigiMundo - ${digiProject.name}):
${moduleTree.map(mod => `
MODULO: ${mod.name}
${mod.description ? `  Descripcion: ${mod.description}` : ''}
${mod.sections.map(sec => `  SECCION: ${sec.name}
${sec.description ? `    Descripcion: ${sec.description}` : ''}
${sec.subsections.map(sub => `    - ${sub.name}${sub.description ? `: ${sub.description}` : ''}`).join('\n')}`).join('\n')}`).join('\n')}

REQUERIMIENTOS DEL PROYECTO:
${requirements.length > 0 ? requirements.map(r => `- ${r.title}${r.description ? `: ${r.description}` : ''}${r.cost ? ` (Costo: $${r.cost})` : ''}`).join('\n') : 'Sin requerimientos definidos'}

INCIDENCIAS/TICKETS RECIENTES:
${incidents.length > 0 ? incidents.map(i => `- [${i.severity}] ${i.title}: ${i.description}`).join('\n') : 'Sin incidencias'}

PARAMETROS DE LA PROFORMA:
- Remitente: ${senderName}
- Empresa remitente: GCC WORLD S.A.
- Subtitulo empresa: Technology Solutions
- Email empresa: contacto@gccworld.com
- Monto objetivo total: $${targetAmount} USD
- Moneda: USD (Dolares americanos)
- Fecha de emision: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
`;
}

async function generateProformaWithAI(projectContext: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');

  // Generate a proforma number based on current date and random
  const now = new Date();
  const proformaNumber = `PRO-${now.getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;

  const systemPrompt = `Eres un generador experto de proformas profesionales para GCC WORLD S.A., una empresa de soluciones tecnologicas. Tu trabajo es generar proformas en formato HTML que sean elegantes, profesionales y listas para imprimir o guardar como PDF.

REGLAS CRITICAS:
1. Debes generar un documento HTML COMPLETO (con <!DOCTYPE html>, <html>, <head>, <style>, <body>) que sea auto-contenido.
2. El diseno debe ser minimalista, estilo Apple - limpio, con tipografia Inter, colores neutros, espaciado generoso.
3. Los items de la proforma deben desglosar el trabajo del proyecto de forma logica y profesional, basandote en la estructura de modulos/secciones del proyecto.
4. Los montos de cada item deben sumar EXACTAMENTE el monto objetivo indicado. Distribuye el monto de forma razonable segun la complejidad de cada item.
5. Genera terminos y condiciones relevantes al tipo de proyecto (desarrollo de software, IA, web, etc). No copies terminos genericos - adaptalos al proyecto especifico.
6. El alcance del entregable debe reflejar las funcionalidades reales del proyecto.
7. Incluye un boton de imprimir/guardar PDF (con clase no-print para que no aparezca al imprimir).
8. El numero de proforma es: ${proformaNumber}
9. Todo el contenido debe estar en ESPANOL.
10. No uses acentos ni caracteres especiales en el HTML (usa "Analisis" no "Análisis", "Diseno" no "Diseño", etc).
11. El campo "Para" debe incluir el nombre del cliente y la referencia al proyecto.
12. La validez debe ser de 30 dias.
13. Si el proyecto tiene datos de cliente, usalos. Si no, pon campos genericos que se puedan rellenar.

USA EXACTAMENTE ESTE TEMPLATE DE CSS Y ESTRUCTURA HTML (adapta solo el contenido):

Los estilos deben usar la fuente Inter de Google Fonts, con el mismo sistema de clases del ejemplo: .page, .header, .brand, .doc-type, .info-grid, .dates-row, .items-table, .totals, .scope, .terms, .footer, .print-btn.

Colores principales: #1d1d1f (texto), #86868b (subtitulos), #f5f5f7 (fondos claros), #e5e5e7 (bordes), #34c759 (check verde), #ff9500 (pendiente naranja).

IMPORTANTE: Responde UNICAMENTE con el codigo HTML completo. Sin explicaciones, sin markdown, sin bloques de codigo. Solo HTML puro.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Genera la proforma profesional para el siguiente proyecto:\n\n${projectContext}` },
      ],
      temperature: 0.4,
      max_tokens: 8000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  let html = data.choices?.[0]?.message?.content;
  if (!html) throw new Error('No se recibio contenido de la IA');

  // Clean up: remove markdown code fences if AI added them
  html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  return html;
}
