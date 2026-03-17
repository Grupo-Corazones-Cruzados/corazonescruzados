import { NextResponse } from 'next/server';
import { killAllServers } from '@/lib/dev-servers';

export async function POST() {
  killAllServers();
  return NextResponse.json({ status: 'all_stopped' });
}
