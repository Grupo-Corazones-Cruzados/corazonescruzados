import { NextResponse } from 'next/server';
import { prisma, pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world."Project" (
      id TEXT PRIMARY KEY,
      "agentId" TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gcc_world."Module" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      "order" INT NOT NULL DEFAULT 0,
      "projectId" TEXT NOT NULL REFERENCES gcc_world."Project"(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS gcc_world."Section" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      "order" INT NOT NULL DEFAULT 0,
      "moduleId" TEXT NOT NULL REFERENCES gcc_world."Module"(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS gcc_world."Subsection" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      "order" INT NOT NULL DEFAULT 0,
      "sectionId" TEXT NOT NULL REFERENCES gcc_world."Section"(id) ON DELETE CASCADE
    );
  `);
}

// GET — returns all projects with nested modules > sections > subsections
export async function GET() {
  await ensureTables();
  const projects = await prisma.project.findMany({
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: {
              subsections: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(projects);
}

// PUT — full replace: receives the complete array of project structures
export async function PUT(req: Request) {
  try {
    const structures = await req.json();

    if (!Array.isArray(structures)) {
      return NextResponse.json({ error: 'Expected array of structures' }, { status: 400 });
    }

    await ensureTables();

    // Check for duplicate agentIds
    const agentIds = structures.map((s: any) => s.agentId);
    const uniqueAgentIds = new Set(agentIds);
    if (uniqueAgentIds.size !== agentIds.length) {
      return NextResponse.json({ error: 'Duplicate agentId found' }, { status: 400 });
    }

    // Wrap in transaction: delete all, then recreate
    await prisma.$transaction(async (tx: any) => {
      await tx.subsection.deleteMany();
      await tx.section.deleteMany();
      await tx.module.deleteMany();
      await tx.project.deleteMany();

      for (const proj of structures) {
        if (!proj.id || !proj.agentId || !proj.name) continue;
        await tx.project.create({
          data: {
            id: proj.id,
            agentId: proj.agentId,
            name: proj.name,
            modules: {
              create: (proj.modules || []).map((mod: any, mi: number) => ({
                id: mod.id,
                name: mod.name || 'Modulo',
                description: mod.description || null,
                order: mi,
                sections: {
                  create: (mod.sections || []).map((sec: any, si: number) => ({
                    id: sec.id,
                    name: sec.name || 'Seccion',
                    description: sec.description || null,
                    order: si,
                    subsections: {
                      create: (sec.subsections || []).map((sub: any, ssi: number) => ({
                        id: sub.id,
                        name: sub.name || 'Subseccion',
                        description: sub.description || null,
                        order: ssi,
                      })),
                    },
                  })),
                },
              })),
            },
          },
        });
      }
    }, { timeout: 30000 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Project structures PUT error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
