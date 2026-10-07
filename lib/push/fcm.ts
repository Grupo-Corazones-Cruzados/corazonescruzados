import { google } from 'googleapis';
import { pool } from '@/lib/db';
import { claveCuentaServicio } from '@/lib/integrations/google-workspace';

/**
 * PUSH A ANDROID por Firebase Cloud Messaging (Fernando, 2026-10-06).
 *
 * Firebase vive en el proyecto `grupo-corazones-cruzados` y se envía con la MISMA cuenta de
 * servicio que ya usa la plataforma (`GOOGLE_SA_KEY`): una credencial, no dos. El id del
 * proyecto sale del correo de la cuenta (`…@<proyecto>.iam.gserviceaccount.com`).
 *
 * Se mandan mensajes de DATOS, no de aviso: el teléfono decide qué enseñar (p. ej. vuelve a
 * preguntar por los relojes y ajusta su notificación). Prioridad alta para que despierte a la
 * app aunque esté cerrada.
 *
 * Nunca lanza: una push que no sale no puede tumbar la acción que la provocó.
 */

type Cliente = InstanceType<typeof google.auth.JWT>;
let cliente: Cliente | null = null;

function proyecto(correo: string): string | null {
  return correo.match(/@([^.]+)\.iam\.gserviceaccount\.com$/)?.[1] ?? null;
}

export async function enviarDatosFcm(tokens: string[], datos: Record<string, string>): Promise<void> {
  if (!tokens.length) return;
  const clave = claveCuentaServicio();
  const id = clave && proyecto(clave.client_email);
  if (!clave || !id) { console.error('FCM: falta la cuenta de servicio (GOOGLE_SA_KEY)'); return; }
  try {
    cliente ??= new google.auth.JWT({
      email: clave.client_email, key: clave.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const { token } = await cliente.getAccessToken();
    if (!token) throw new Error('sin token de acceso');

    const muertos: string[] = [];
    await Promise.all(tokens.map(async (t) => {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: t, data: datos, android: { priority: 'HIGH' } } }),
      });
      if (r.ok) return;
      const cuerpo = await r.json().catch(() => ({}));
      const codigo = cuerpo?.error?.details?.find((d: any) => d.errorCode)?.errorCode;
      // Desinstalada o token caducado: no se le vuelve a intentar.
      if (codigo === 'UNREGISTERED' || codigo === 'INVALID_ARGUMENT') muertos.push(t);
      else console.error('FCM envío', r.status, cuerpo?.error?.message);
    }));
    if (muertos.length) {
      await pool.query(`DELETE FROM gcc_world.push_devices WHERE kind = 'fcm' AND token = ANY($1)`, [muertos]);
    }
  } catch (e: any) {
    console.error('FCM error:', e?.message);
  }
}
