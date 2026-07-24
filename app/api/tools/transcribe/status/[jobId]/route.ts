import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getTranscriptionJob, assembleTranscript } from '@/lib/tools/transcription';

/** Estado + progreso de un trabajo de transcripción, con el texto ensamblado (parcial o final). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { jobId } = await params;
    const job = await getTranscriptionJob(jobId);
    if (!job) return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 });
    if (job.user_id && String(job.user_id) !== String(user.userId) && user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const text = assembleTranscript(job.segments, job.total_segments);
    return NextResponse.json({
      status: job.status,
      doneSegments: job.done_segments ?? 0,
      totalSegments: job.total_segments ?? null,
      filename: job.filename || null,
      error: job.error || null,
      text,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}
