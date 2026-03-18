import { NextResponse } from 'next/server';
import { checkAvailable } from '@/lib/fal-ai';

export const dynamic = 'force-dynamic';

export async function GET() {
  const available = await checkAvailable();
  return NextResponse.json({ available });
}
