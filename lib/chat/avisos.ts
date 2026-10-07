import { pool } from '@/lib/db';
import { participantsOf, type ScopeKind } from '@/lib/chat/participants';
import { avisarUsuarios } from '@/lib/push/avisos';

/**
 * UN MENSAJE NUEVO → AVISO AL TELÉFONO de los demás participantes (Fernando, 2026-10-07: «cuando
 * llega un nuevo mensaje en los chats del usuario llegue una notificación, e incluso si se
 * puede enviar un mensaje directamente»).
 *
 *  · A quién: el chat general es de todo miembro, admin y candidato; el de un ticket, proyecto
 *    o evento, de sus participantes (`participantsOf`, la misma regla que da acceso). Nunca a
 *    quien escribió.
 *  · Qué: título = la conversación; texto = «Autor: mensaje». Viaja `chat` («grupo» o
 *    «ticket:41»): con él el teléfono agrupa los avisos por conversación, abre la conversación
 *    al tocar (`/dashboard?chat=…`) y responde desde el propio aviso.
 *
 * Se llama con `after()` desde las rutas que guardan el mensaje: no retrasa el envío. Nunca lanza.
 */
export async function avisarMensajeDeChat(o: {
  chat: 'grupo' | { kind: ScopeKind; ref: string };
  remitenteId: string;
  remitenteNombre: string;
  cuerpo: string;
}): Promise<void> {
  try {
    let destinatarios: string[];
    let titulo: string;
    let clave: string;
    if (o.chat === 'grupo') {
      const { rows } = await pool.query(
        `SELECT u.id::text AS id FROM gcc_world.users u
          WHERE u.role IN ('member', 'admin')
             OR EXISTS (SELECT 1 FROM gcc_world.clients c WHERE c.user_id = u.id AND c.account_type = 'candidate')`,
      );
      destinatarios = rows.map((r: any) => r.id);
      titulo = 'Chat general';
      clave = 'grupo';
    } else {
      destinatarios = Object.keys(await participantsOf(o.chat.kind, o.chat.ref));
      titulo = await tituloDe(o.chat.kind, o.chat.ref);
      clave = `${o.chat.kind}:${o.chat.ref}`;
    }
    destinatarios = destinatarios.filter((id) => id && id !== o.remitenteId);
    if (!destinatarios.length) return;

    const texto = o.cuerpo.length > 180 ? `${o.cuerpo.slice(0, 177)}…` : o.cuerpo;
    await avisarUsuarios(destinatarios, {
      tipo: 'chat',
      titulo,
      cuerpo: `${o.remitenteNombre}: ${texto}`,
      ruta: `/dashboard?chat=${encodeURIComponent(clave)}`,
      datos: { chat: clave, remitente: o.remitenteNombre, mensaje: texto },
      categoria: 'CHAT',
      hilo: clave,
    });
  } catch (e: any) {
    console.error('Aviso de chat:', e?.message);
  }
}

async function tituloDe(kind: ScopeKind, ref: string): Promise<string> {
  const q = kind === 'ticket' ? `SELECT title AS t FROM gcc_world.tickets WHERE id::text = $1`
    : kind === 'project' ? `SELECT title AS t FROM gcc_world.projects WHERE id::text = $1`
    : `SELECT name AS t FROM gcc_world.gs_events WHERE id::text = $1`;
  const { rows } = await pool.query(q, [ref]).catch(() => ({ rows: [] as any[] }));
  const etiqueta = kind === 'ticket' ? 'Ticket' : kind === 'project' ? 'Proyecto' : 'Evento';
  return rows[0]?.t || `${etiqueta} #${ref}`;
}
