import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST(req: Request) {
  try {
    const { projectPath } = await req.json();
    if (!projectPath) {
      return NextResponse.json({ error: 'Missing projectPath' }, { status: 400 });
    }
    exec(`open -a "Visual Studio Code" "${projectPath}"`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
