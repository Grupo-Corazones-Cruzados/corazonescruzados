import { randomBytes, randomUUID } from 'crypto';
import { hashPassword } from '@/lib/auth/password';

/**
 * BORRAR LA CUENTA DESDE LA APP (lo exigen Apple 5.1.1(v) y Google; Fernando, 2026-11-05).
 *
 * Se borra lo personal y se cierra el acceso, pero NO se borra la fila de `users`: facturas,
 * proyectos, tickets y mensajes cuelgan de su `id`, y un comprobante autorizado por el SRI debe
 * conservarse. Esos comprobantes guardan sus propios datos (`client_name_sri`…), por eso no se tocan.
 *
 * Solo para clientes y candidatos (`role = client`). Los miembros forman parte del negocio y su
 * salida la tramita un administrador, porque arrastra horas, pagos y asignaciones.
 */

/** Tablas que solo le sirven a esa persona: se borran enteras. */
const DEL_USUARIO = [
  'push_devices', 'push_suscripciones', 'google_conexiones', 'user_api_keys', 'verification_tokens',
  'notifications', 'notification_reads', 'aviso_preferencias', 'avisos_reunion', 'ch_presence', 'ch_reads',
  'cart_items', 'razones', 'ps_capturas', 'reminders', 'exp_personales', 'cp_alertas', 'cp_consentimientos',
  'cp_dispositivos', 'cp_miembros', 'cp_posiciones', 'cp_visitas',
];

/** La hoja de vida de un candidato: solo existe para que lo evalúen. */
const DEL_MIEMBRO = ['member_cv_profiles', 'member_portfolio_items', 'member_schedules', 'schedule_exceptions', 'member_calendar_subscribers'];

export class CuentaNoEliminable extends Error {}

/** Cuentas de prueba que usan varias personas a la vez: no se eliminan desde la app. */
const CUENTAS_COMPARTIDAS = new Set(['probador@gcc.test']);

type ClienteBd = { query: (sql: string, valores?: unknown[]) => Promise<{ rows: any[] }> };

/** Corre dentro de la transacción de quien llama (una transacción necesita su propio cliente). */
export async function eliminarCuentaEn(cli: ClienteBd, userId: string): Promise<void> {
  const { rows: [u] } = await cli.query(
    `SELECT email, role, member_id FROM gcc_world.users WHERE id = $1 FOR UPDATE`, [userId],
  );
  if (!u) throw new CuentaNoEliminable('La cuenta no existe');
  if (u.role !== 'client') throw new CuentaNoEliminable('Las cuentas del equipo las da de baja un administrador');
  const correo = String(u.email).trim().toLowerCase();
  // La cuenta de prueba que comparten los probadores de Google Play (12-Testers, del 2026-11-13 al 27) y el
  // revisor de Apple: si uno la elimina, todos quedan fuera y la prueba de 14 días vuelve a empezar.
  if (CUENTAS_COMPARTIDAS.has(correo)) {
    throw new CuentaNoEliminable('Esta es la cuenta de prueba compartida y no se puede eliminar. Para probar la eliminación, crea una cuenta propia.');
  }

  for (const t of DEL_USUARIO) await cli.query(`DELETE FROM gcc_world.${t} WHERE user_id = $1`, [userId]);
  await cli.query(`DELETE FROM gcc_world.cp_accesos WHERE quien = $1 OR a_quien = $1`, [userId]);

  // La ficha del mundo/candidato: la misma persona por enlace o por correo.
  const { rows: fichas } = await cli.query(
    `SELECT id FROM gcc_world.clients WHERE user_id = $1 OR lower(email) = $2 FOR UPDATE`, [userId, correo],
  );
  for (const { id } of fichas) {
    await cli.query(`DELETE FROM gcc_world.client_passkeys WHERE client_id = $1`, [id]);
    await cli.query(`DELETE FROM gcc_world.herramienta_accesos WHERE client_id = $1`, [id]);
    await cli.query(
      `UPDATE gcc_world.clients
          SET name = 'Cuenta eliminada', full_name = NULL, alias = NULL,
              email = $2, pending_email = NULL, workspace_email = NULL, phone = NULL, company = NULL, ruc = NULL,
              address = NULL, country = NULL,
              client_token = NULL, ip_hash = NULL, password_hash = NULL, pending_password_hash = NULL,
              verification_token = NULL, auth_token = NULL, auth_expires = NULL, webauthn_challenge = NULL,
              recovery_code = NULL, approved = false, profile_completed = false, updated_at = NOW()
        WHERE id = $1`,
      [id, `eliminada-c${id}-${randomUUID()}@eliminada.invalid`],
    );
  }

  await cli.query(`DELETE FROM gcc_world.candidate_proposals WHERE lower(email) = $1`, [correo]);
  await cli.query(`DELETE FROM gcc_world.email_contacts WHERE lower(email) = $1`, [correo]);

  // Sin esto seguirían los avisos de cobro a un correo que pidió irse.
  await cli.query(
    `UPDATE gcc_world.subscriptions SET status = 'cancelled', updated_at = NOW()
      WHERE status = 'active' AND lower(client_email_sri) = $1`,
    [correo],
  );

  if (u.member_id) {
    for (const t of DEL_MIEMBRO) await cli.query(`DELETE FROM gcc_world.${t} WHERE member_id = $1`, [u.member_id]);
    await cli.query(
      `UPDATE gcc_world.members
          SET name = 'Cuenta eliminada', email = NULL, phone = NULL, photo_url = NULL, is_active = false,
              calendar_public_token = NULL, cv_public_token = NULL, calendar_feed_token = NULL, updated_at = NOW()
        WHERE id = $1`,
      [u.member_id],
    );
  }

  // `password_hash` no admite NULL: una clave al azar que nadie conoce. El correo queda libre por si vuelve.
  await cli.query(
    `UPDATE gcc_world.users
        SET email = $2, password_hash = $3, first_name = 'Cuenta', last_name = 'eliminada', avatar_url = NULL,
            phone = NULL, is_verified = false, reset_token = NULL, reset_token_exp = NULL, login_code = NULL,
            login_code_exp = NULL, youtube_handle = NULL, tiktok_handle = NULL, instagram_handle = NULL,
            facebook_handle = NULL, country = NULL, address = NULL, ref_token = NULL, ip_hash = NULL,
            workspace_email = NULL, tokens_invalidated_at = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [userId, `eliminada-${userId}@eliminada.invalid`, await hashPassword(randomBytes(32).toString('hex'))],
  );
}
