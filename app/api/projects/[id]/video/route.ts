import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { fal } from '@fal-ai/client';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
// @ts-ignore
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

fal.config({ credentials: process.env.FAL_KEY });

const execFileAsync = promisify(execFile);
const FFMPEG = ffmpegInstaller.path as string;

export const maxDuration = 300; // 5 min max

async function ensureColumns() {
  await pool.query(`
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS video_script TEXT;
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS video_data BYTEA;
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS image_metadata JSONB;
    ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS images TEXT[];
  `);
}

async function cleanup(files: string[]) {
  for (const f of files) { try { await fs.unlink(f); } catch {} }
}

// GET: Download video
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureColumns();

    const { rows: [project] } = await pool.query(
      `SELECT video_data, title FROM gcc_world.projects WHERE id = $1`, [id]
    );
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!project.video_data) return NextResponse.json({ error: 'No hay video generado' }, { status: 404 });

    const buffer = project.video_data;
    const filename = `video-${project.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.mp4`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Generate video from script + images
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Read request body BEFORE creating the stream (body can only be consumed once)
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const script = body.script as string;
  const storyboard = body.storyboard as { id: string; text: string; imageIndex: number | null }[] | undefined;
  if (!script) {
    return NextResponse.json({ error: 'No hay guion' }, { status: 400 });
  }

  await ensureColumns();

  const tempFiles: string[] = [];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {

        // Get project images and storyboard from DB (if not passed in body)
        const { rows: [project] } = await pool.query(
          `SELECT COALESCE(images, '{}') as images, title, image_metadata FROM gcc_world.projects WHERE id = $1`, [id]
        );
        if (!project) { send({ error: 'Proyecto no encontrado' }); controller.close(); return; }

        // Use storyboard from request body, or fall back to DB
        const finalStoryboard = storyboard || project.image_metadata?.storyboard || null;

        const images: string[] = project.images || [];
        if (images.length === 0) { send({ error: 'El proyecto no tiene imagenes' }); controller.close(); return; }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const tmpDir = tmpdir();
        const sessionId = randomUUID();

        // Step 1: Generate TTS narration (skip custom-clip segments — they have their own audio)
        send({ step: 'Generando narracion con IA...' });

        // Build TTS text: exclude custom-clip segments
        let ttsScript: string;
        if (finalStoryboard && finalStoryboard.length > 0) {
          ttsScript = finalStoryboard
            .filter((seg: any) => (seg.mode || 'none') !== 'custom-clip')
            .map((seg: any) => seg.text)
            .join('\n\n');
        } else {
          ttsScript = script;
        }
        ttsScript = ttsScript
          .replace(/\[IMAGEN\s*\d+\]/gi, '')
          .replace(/---GUION_(INICIO|FIN)---/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        // Parse image timeline from script (fallback when no storyboard)
        const imageTimeline: { imageIndex: number; position: number }[] = [];
        const imgRegex = /\[IMAGEN\s*(\d+)\]/gi;
        let match;
        while ((match = imgRegex.exec(script)) !== null) {
          imageTimeline.push({ imageIndex: parseInt(match[1]) - 1, position: match.index / script.length });
        }

        // Split TTS text into chunks (max ~3500 chars per call)
        const scriptChunks: string[] = [];
        if (ttsScript.length > 0) {
          const lines = ttsScript.split('\n').filter((l: string) => l.trim());
          let currentChunk = '';
          for (const line of lines) {
            if ((currentChunk + '\n' + line).length > 3500 && currentChunk) {
              scriptChunks.push(currentChunk.trim());
              currentChunk = line;
            } else {
              currentChunk += (currentChunk ? '\n' : '') + line;
            }
          }
          if (currentChunk.trim()) scriptChunks.push(currentChunk.trim());
        }

        // Generate TTS for each chunk
        const audioFiles: string[] = [];
        for (let i = 0; i < scriptChunks.length; i++) {
          send({ step: `Generando audio ${i + 1}/${scriptChunks.length}...` });
          const ttsRes = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'onyx',
            input: scriptChunks[i],
            response_format: 'mp3',
          });
          const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
          const audioFile = join(tmpDir, `${sessionId}-audio-${i}.mp3`);
          await fs.writeFile(audioFile, audioBuffer);
          audioFiles.push(audioFile);
          tempFiles.push(audioFile);
        }

        // Concatenate audio files if multiple
        let finalAudioPath: string;
        if (audioFiles.length === 1) {
          finalAudioPath = audioFiles[0];
        } else {
          send({ step: 'Combinando audio...' });
          finalAudioPath = join(tmpDir, `${sessionId}-audio-full.mp3`);
          tempFiles.push(finalAudioPath);
          const listFile = join(tmpDir, `${sessionId}-audiolist.txt`);
          tempFiles.push(listFile);
          await fs.writeFile(listFile, audioFiles.map(f => `file '${f}'`).join('\n'));
          await execFileAsync(FFMPEG, ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-y', finalAudioPath]);
        }

        // Step 2: Get audio duration
        send({ step: 'Calculando duracion del audio...' });
        const probeResult = await execFileAsync(FFMPEG, [
          '-i', finalAudioPath, '-f', 'null', '-'
        ]).catch(e => e); // ffmpeg writes duration to stderr
        const durationMatch = (probeResult.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
        let totalDuration = 60; // fallback
        if (durationMatch) {
          totalDuration = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]) + parseInt(durationMatch[4]) / 100;
        }

        // Step 3: Save images as temporary files
        send({ step: 'Preparando imagenes...' });
        const imageFiles: string[] = [];
        for (let i = 0; i < images.length; i++) {
          const imgData = images[i];
          let buffer: Buffer;
          let ext = 'png';

          if (imgData.startsWith('data:')) {
            const match = imgData.match(/^data:image\/([\w+]+);base64,(.+)$/);
            if (match) {
              ext = match[1] === 'jpeg' ? 'jpg' : match[1];
              buffer = Buffer.from(match[2], 'base64');
            } else {
              continue;
            }
          } else {
            continue;
          }

          const imgFile = join(tmpDir, `${sessionId}-img-${i}.${ext}`);
          await fs.writeFile(imgFile, buffer);
          imageFiles.push(imgFile);
          tempFiles.push(imgFile);
        }

        if (imageFiles.length === 0) {
          send({ error: 'No se pudieron procesar las imagenes' });
          await cleanup(tempFiles);
          controller.close();
          return;
        }

        // Step 4: Build timeline from storyboard
        send({ step: 'Armando timeline del video...' });

        // Resolve storyboard into a flat list of clips
        interface TimelineClip {
          type: 'image' | 'ai-video' | 'custom-clip';
          file: string;
          duration: number;
          isVideo: boolean;
          hasOwnAudio: boolean; // custom clips have their own audio
        }
        const clips: TimelineClip[] = [];

        if (finalStoryboard && finalStoryboard.length > 0) {
          // Text length only for narrated segments (not custom clips)
          const narratedTextLen = finalStoryboard
            .filter((seg: any) => (seg.mode || 'none') !== 'custom-clip')
            .reduce((s: number, seg: any) => s + seg.text.length, 0);

          // First pass: resolve segments
          interface ResolvedSeg {
            type: 'image' | 'ai-video' | 'custom-clip';
            imageIndex: number; textLen: number; text: string;
            aiPrompt?: string; clipData?: string; clipDuration?: number;
          }
          const resolved: ResolvedSeg[] = [];
          let lastImg: number | null = null;

          for (const seg of finalStoryboard) {
            const mode = seg.mode || (seg.imageIndex !== null ? 'image' : 'none');

            if (mode === 'custom-clip' && seg.clipData) {
              resolved.push({
                type: 'custom-clip', imageIndex: -1, textLen: seg.text.length,
                text: seg.text, clipData: seg.clipData, clipDuration: seg.clipDuration || 5,
              });
              lastImg = null;
              continue;
            }

            if (mode === 'ai-video') {
              resolved.push({ type: 'ai-video', imageIndex: -1, textLen: seg.text.length, text: seg.text, aiPrompt: seg.aiPrompt });
              lastImg = null;
              continue;
            }

            if (mode === 'image' && seg.imageIndex !== null) lastImg = seg.imageIndex;
            const imgIdx = lastImg !== null && lastImg >= 0 && lastImg < imageFiles.length ? lastImg : 0;

            const prev = resolved[resolved.length - 1];
            if (prev && prev.type === 'image' && prev.imageIndex === imgIdx) {
              prev.textLen += seg.text.length;
              prev.text += '\n' + seg.text;
            } else {
              resolved.push({ type: 'image', imageIndex: imgIdx, textLen: seg.text.length, text: seg.text });
            }
          }

          // Second pass: build clips
          let aiClipIdx = 0;
          let customClipIdx = 0;
          for (const seg of resolved) {
            // Custom clips use their own duration, narrated segments use proportional TTS time
            if (seg.type === 'custom-clip' && seg.clipData) {
              customClipIdx++;
              send({ step: `Procesando clip propio ${customClipIdx}...` });
              const clipPath = join(tmpDir, `${sessionId}-custom-${customClipIdx}.mp4`);
              // Decode base64 clip
              const b64Match = seg.clipData.match(/^data:video\/[\w+]+;base64,(.+)$/);
              if (b64Match) {
                await fs.writeFile(clipPath, Buffer.from(b64Match[1], 'base64'));
              } else {
                await fs.writeFile(clipPath, Buffer.from(seg.clipData, 'base64'));
              }
              tempFiles.push(clipPath);

              // Scale to 1280x720 but KEEP its own audio and full duration
              const scaledPath = join(tmpDir, `${sessionId}-custom-${customClipIdx}-scaled.mp4`);
              tempFiles.push(scaledPath);
              await execFileAsync(FFMPEG, [
                '-i', clipPath,
                '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '128k',
                '-y', scaledPath,
              ], { maxBuffer: 100 * 1024 * 1024 });

              clips.push({ type: 'custom-clip', file: scaledPath, duration: seg.clipDuration || 5, isVideo: true, hasOwnAudio: true });
              continue;
            }

            // Narrated segments: duration proportional to text length vs TTS duration
            const dur = narratedTextLen > 0
              ? Math.max(2, (seg.textLen / narratedTextLen) * totalDuration)
              : Math.max(2, 5);

            if (seg.type === 'ai-video') {
              aiClipIdx++;
              send({ step: `Generando clip IA ${aiClipIdx}...` });

              try {
                const aiPrompt = seg.aiPrompt || seg.text.slice(0, 500);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await (fal as any).subscribe('fal-ai/minimax/hailuo-02/standard/text-to-video', {
                  input: { prompt: `Cinematic b-roll footage, no text overlay, no subtitles, professional video: ${aiPrompt}` },
                  logs: false,
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const videoUrl = (result.data as any)?.video?.url;

                if (videoUrl) {
                  const videoRes = await fetch(videoUrl);
                  const videoBuf = Buffer.from(await videoRes.arrayBuffer());
                  const clipPath = join(tmpDir, `${sessionId}-ai-clip-${aiClipIdx}.mp4`);
                  await fs.writeFile(clipPath, videoBuf);
                  tempFiles.push(clipPath);

                  const scaledClipPath = join(tmpDir, `${sessionId}-ai-clip-${aiClipIdx}-scaled.mp4`);
                  tempFiles.push(scaledClipPath);
                  await execFileAsync(FFMPEG, [
                    '-i', clipPath, '-t', String(dur),
                    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1',
                    '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
                    '-y', scaledClipPath,
                  ], { maxBuffer: 50 * 1024 * 1024 });

                  clips.push({ type: 'ai-video', file: scaledClipPath, duration: dur, isVideo: true, hasOwnAudio: false });
                  continue;
                }
              } catch (aiErr: any) {
                send({ step: `Clip IA ${aiClipIdx} fallo, usando placeholder...` });
                console.error('AI clip generation error:', aiErr.message);
              }
              clips.push({ type: 'image', file: imageFiles[0], duration: dur, isVideo: false, hasOwnAudio: false });
            } else {
              clips.push({ type: 'image', file: imageFiles[seg.imageIndex] || imageFiles[0], duration: dur, isVideo: false, hasOwnAudio: false });
            }
          }
        } else {
          const dur = Math.max(2, totalDuration / imageFiles.length);
          for (const file of imageFiles) {
            clips.push({ type: 'image', file, duration: dur, isVideo: false, hasOwnAudio: false });
          }
        }

        if (clips.length === 0) {
          send({ error: 'No se pudieron generar clips' });
          await cleanup(tempFiles);
          controller.close();
          return;
        }

        // Step 5: Create individual segment videos then concatenate
        send({ step: 'Generando video final...' });
        const outputPath = join(tmpDir, `${sessionId}-output.mp4`);
        tempFiles.push(outputPath);

        const hasCustomClips = clips.some(c => c.hasOwnAudio);

        if (!hasCustomClips) {
          // Simple path: no custom clips, use single ffmpeg command with TTS overlay
          const filterParts: string[] = [];
          const inputArgs: string[] = [];
          for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            if (clip.isVideo) {
              inputArgs.push('-t', String(clip.duration), '-i', clip.file);
              filterParts.push(`[${i}:v]setsar=1[v${i}]`);
            } else {
              inputArgs.push('-loop', '1', '-t', String(clip.duration), '-i', clip.file);
              filterParts.push(`[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=${Math.max(0, clip.duration - 0.5)}:d=0.5[v${i}]`);
            }
          }
          const concatInputs = clips.map((_, i) => `[v${i}]`).join('');
          const filterComplex = filterParts.join(';') + `;${concatInputs}concat=n=${clips.length}:v=1:a=0[outv]`;
          inputArgs.push('-i', finalAudioPath);

          await execFileAsync(FFMPEG, [
            ...inputArgs, '-filter_complex', filterComplex,
            '-map', '[outv]', '-map', `${clips.length}:a`,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k', '-shortest', '-y', outputPath,
          ], { maxBuffer: 100 * 1024 * 1024 });

        } else {
          // Complex path: mix custom clips (own audio) with TTS-narrated segments
          // Strategy: create individual segment mp4 files, then concat
          send({ step: 'Combinando segmentos con audio...' });
          const segmentFiles: string[] = [];
          let ttsOffset = 0; // current position in TTS audio

          for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const segFile = join(tmpDir, `${sessionId}-seg-${i}.mp4`);
            tempFiles.push(segFile);

            if (clip.hasOwnAudio) {
              // Custom clip: already has video+audio, just copy
              await fs.copyFile(clip.file, segFile);
            } else if (clip.isVideo) {
              // AI video clip: add TTS audio slice
              const audioSlice = join(tmpDir, `${sessionId}-tts-slice-${i}.mp3`);
              tempFiles.push(audioSlice);
              await execFileAsync(FFMPEG, [
                '-i', finalAudioPath, '-ss', String(ttsOffset), '-t', String(clip.duration),
                '-c', 'copy', '-y', audioSlice,
              ]);
              await execFileAsync(FFMPEG, [
                '-t', String(clip.duration), '-i', clip.file, '-i', audioSlice,
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '128k', '-shortest', '-y', segFile,
              ], { maxBuffer: 50 * 1024 * 1024 });
              ttsOffset += clip.duration;
            } else {
              // Image + TTS audio slice
              const audioSlice = join(tmpDir, `${sessionId}-tts-slice-${i}.mp3`);
              tempFiles.push(audioSlice);
              await execFileAsync(FFMPEG, [
                '-i', finalAudioPath, '-ss', String(ttsOffset), '-t', String(clip.duration),
                '-c', 'copy', '-y', audioSlice,
              ]);
              await execFileAsync(FFMPEG, [
                '-loop', '1', '-t', String(clip.duration), '-i', clip.file, '-i', audioSlice,
                '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '128k', '-shortest', '-y', segFile,
              ], { maxBuffer: 50 * 1024 * 1024 });
              ttsOffset += clip.duration;
            }
            segmentFiles.push(segFile);
          }

          // Concatenate all segment files
          const concatList = join(tmpDir, `${sessionId}-concat-list.txt`);
          tempFiles.push(concatList);
          await fs.writeFile(concatList, segmentFiles.map(f => `file '${f}'`).join('\n'));
          await execFileAsync(FFMPEG, [
            '-f', 'concat', '-safe', '0', '-i', concatList,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k', '-y', outputPath,
          ], { maxBuffer: 100 * 1024 * 1024 });
        }

        // Step 6: Read video and save to database
        send({ step: 'Guardando video...' });
        const videoBuffer = await fs.readFile(outputPath);

        await pool.query(
          `UPDATE gcc_world.projects SET video_data = $1, updated_at = NOW() WHERE id = $2`,
          [videoBuffer, id]
        );

        send({ step: 'Video generado exitosamente', video_url: `/api/projects/${id}/video` });
        send({ done: true });

      } catch (err: any) {
        console.error('Video generation error:', err.message, err.stderr || '');
        send({ error: err.message || 'Error generando video' });
      } finally {
        await cleanup(tempFiles);
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
