import type { ReminderTask } from '@/lib/reminders/schema';
import { chatJSON, iaConfigurada } from '@/lib/ia/openai';

export type MeetingAnalysis = { title: string; notes: string; remind_at: string; tasks: ReminderTask[] };

/**
 * Analiza la transcripción de una reunión y genera el contenido de un recordatorio:
 * título, resumen, fecha/hora de seguimiento (la IA SIEMPRE propone una) y lista de tareas.
 */
export async function analyzeMeetingTranscript(
  transcript: string,
  ctx: { meetingTitle: string; meetingEndISO: string },
): Promise<MeetingAnalysis> {
  if (!iaConfigurada()) throw new Error('La IA no está configurada (falta OPENAI_API_KEY)');
  const clip = transcript.slice(0, 24000);

  const system = `Eres un asistente que analiza la transcripción de una reunión de trabajo y genera un RECORDATORIO de seguimiento. Responde ÚNICAMENTE un objeto JSON con esta forma exacta (en español):
{
  "title": "título breve del recordatorio, máx 80 caracteres",
  "notes": "resumen del contexto y acuerdos, 2 a 4 frases",
  "remind_at": "fecha/hora ISO 8601 con zona -05:00 (Ecuador) para el seguimiento. Si en la reunión se menciona una fecha límite o de seguimiento, úsala; si NO se menciona ninguna, PROPÓN una razonable: normalmente 2-3 días hábiles después del fin de la reunión, a las 09:00. NUNCA la dejes vacía ni en el pasado.",
  "tasks": ["tarea o acción concreta acordada", "..."]
}`;
  const user = `Fin de la reunión (ISO): ${ctx.meetingEndISO}\nTítulo de la reunión: ${ctx.meetingTitle}\n\nTranscripción:\n"""\n${clip}\n"""`;

  // Sin `esfuerzo`: aquí SÍ interesa que el modelo se lo piense, porque tiene que deducir
  // una fecha de seguimiento que muchas veces no está dicha en la transcripción.
  // El techo sube de 900 a 4000: en este modelo el razonamiento consume del mismo techo.
  const j = await chatJSON<any>({ system, user, maxTokens: 4000, etiqueta: 'reunion' });

  const title = String(j.title || ctx.meetingTitle || 'Seguimiento de reunión').slice(0, 120);
  const notes = String(j.notes || '');

  let remind_at = j.remind_at;
  const parsed = remind_at ? new Date(remind_at) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    // Fallback: 3 días después del fin, ~09:00 Ecuador (14:00 UTC).
    const d = new Date(ctx.meetingEndISO);
    d.setUTCDate(d.getUTCDate() + 3);
    d.setUTCHours(14, 0, 0, 0);
    remind_at = d.toISOString();
  } else {
    remind_at = parsed.toISOString();
  }

  const tasks: ReminderTask[] = (Array.isArray(j.tasks) ? j.tasks : [])
    .map((t: any, i: number) => ({ id: `t${i}`, text: String(typeof t === 'string' ? t : t?.text || '').trim(), done: false }))
    .filter((t: ReminderTask) => t.text);

  return { title, notes, remind_at, tasks };
}
