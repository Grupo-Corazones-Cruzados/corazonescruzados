import { NextRequest, NextResponse } from 'next/server';
import { readDigimonData, setDigimonEntry } from '@/lib/digimon-data';
import type { DigimonData } from '@/types/digimon';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await readDigimonData();
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as { agentId: string; entry: DigimonData };
  if (!body.agentId || !body.entry) {
    return NextResponse.json({ error: 'agentId and entry required' }, { status: 400 });
  }
  await setDigimonEntry(body.agentId, body.entry);
  return NextResponse.json({ ok: true });
}
