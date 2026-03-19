import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

export const dynamic = 'force-dynamic';

const ORG = 'Grupo-Corazones-Cruzados';

export async function POST(req: NextRequest) {
  const { repoName, description, isPrivate } = await req.json();

  if (!repoName) {
    return NextResponse.json({ error: 'repoName is required' }, { status: 400 });
  }

  // Sanitize repo name
  const safeName = repoName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');

  try {
    // Check if repo already exists
    try {
      await exec('gh', ['repo', 'view', `${ORG}/${safeName}`, '--json', 'name']);
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        repoUrl: `https://github.com/${ORG}/${safeName}`,
        message: `El repositorio ${ORG}/${safeName} ya existe`,
      });
    } catch {
      // Repo doesn't exist, proceed to create
    }

    // Create the repo in the organization
    const args = [
      'repo', 'create',
      `${ORG}/${safeName}`,
      isPrivate ? '--private' : '--public',
      '--description', description || `Digimon citizen: ${repoName}`,
      '--clone=false',
    ];

    const { stdout } = await exec('gh', args);
    const repoUrl = stdout.trim();

    return NextResponse.json({
      ok: true,
      alreadyExists: false,
      repoUrl: repoUrl || `https://github.com/${ORG}/${safeName}`,
      repoName: safeName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: check if a repo exists
export async function GET(req: NextRequest) {
  const repoName = req.nextUrl.searchParams.get('repo');
  if (!repoName) {
    return NextResponse.json({ error: 'repo param required' }, { status: 400 });
  }

  const safeName = repoName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');

  try {
    const { stdout } = await exec('gh', ['repo', 'view', `${ORG}/${safeName}`, '--json', 'name,url']);
    const data = JSON.parse(stdout);
    return NextResponse.json({ exists: true, ...data });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
