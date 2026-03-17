import { NextResponse } from 'next/server';
import { readWorldConfig } from '@/lib/world';
import { validateWorldConfig } from '@/lib/validation';

export async function POST() {
  try {
    const config = await readWorldConfig();
    const result = await validateWorldConfig(config);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
