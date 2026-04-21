import { pool } from '@/lib/db';
import { sendCalendarEventNotification, type CalendarEmailAction } from '@/lib/integrations/resend';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

export async function notifyCalendarSubscribers(params: {
  memberId: string;
  action: CalendarEmailAction;
  eventTitle: string;
  eventStart: Date;
  eventEnd: Date;
}) {
  const { memberId, action, eventTitle, eventStart, eventEnd } = params;
  try {
    const memberRes = await pool.query(
      `SELECT name, calendar_public_token FROM gcc_world.members WHERE id = $1`,
      [memberId],
    );
    const member = memberRes.rows[0];
    if (!member) return;

    const subsRes = await pool.query(
      `SELECT email FROM gcc_world.member_calendar_subscribers
       WHERE member_id = $1 AND verified = TRUE`,
      [memberId],
    );
    if (subsRes.rowCount === 0) return;

    const publicUrl = member.calendar_public_token
      ? `${APP_URL}/calendario/${memberId}?token=${member.calendar_public_token}`
      : `${APP_URL}/calendario/${memberId}`;

    await Promise.allSettled(
      subsRes.rows.map((r: any) =>
        sendCalendarEventNotification({
          email: r.email,
          memberName: member.name,
          action,
          eventTitle,
          eventStart,
          eventEnd,
          publicUrl,
        }),
      ),
    );
  } catch (err: any) {
    console.error('notifyCalendarSubscribers error:', err.message);
  }
}
