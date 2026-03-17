import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET — returns all projects with nested modules > sections > subsections
export async function GET() {
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

    // Wrap in transaction: delete all, then recreate
    await prisma.$transaction(async (tx: any) => {
      await tx.subsection.deleteMany();
      await tx.section.deleteMany();
      await tx.module.deleteMany();
      await tx.project.deleteMany();

      for (const proj of structures) {
        await tx.project.create({
          data: {
            id: proj.id,
            agentId: proj.agentId,
            name: proj.name,
            modules: {
              create: (proj.modules || []).map((mod: any, mi: number) => ({
                id: mod.id,
                name: mod.name,
                description: mod.description || null,
                order: mi,
                sections: {
                  create: (mod.sections || []).map((sec: any, si: number) => ({
                    id: sec.id,
                    name: sec.name,
                    description: sec.description || null,
                    order: si,
                    subsections: {
                      create: (sec.subsections || []).map((sub: any, ssi: number) => ({
                        id: sub.id,
                        name: sub.name,
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
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
