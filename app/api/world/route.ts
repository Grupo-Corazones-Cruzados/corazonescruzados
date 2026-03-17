import { NextResponse } from 'next/server';
import { readWorldConfig, writeWorldConfig } from '@/lib/world';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await readWorldConfig();
    return NextResponse.json(config);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    await writeWorldConfig(body);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
