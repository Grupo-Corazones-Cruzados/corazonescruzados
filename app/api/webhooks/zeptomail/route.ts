import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * ZeptoMail Webhook Handler
 *
 * Receives delivery events from ZeptoMail:
 *   - hardbounce / softbounce
 *   - delivered
 *   - email_open
 *   - email_link_click
 *
 * ZeptoMail payload structure:
 * {
 *   event_name: ["hardbounce"],
 *   event_message: [{
 *     request_id: "...",
 *     email_info: { to: [{ email_address: { address: "..." } }], ... },
 *     event_data: [{ details: [{ reason, bounced_recipient, time, diagnostic_message }], object: "hardbounce" }]
 *   }],
 *   mailagent_key: "...",
 *   webhook_request_id: "..."
 * }
 */

interface WebhookPayload {
  event_name: string[];
  event_message: EventMessage[];
  mailagent_key?: string;
  webhook_request_id?: string;
}

interface EventMessage {
  request_id?: string;
  email_info?: {
    to?: { email_address: { address: string; name?: string } }[];
    subject?: string;
    processed_time?: string;
  };
  event_data?: EventData[];
}

interface EventData {
  object?: string;
  details?: EventDetail[];
}

interface EventDetail {
  reason?: string;
  bounced_recipient?: string;
  time?: string;
  diagnostic_message?: string;
  modified_time?: string;
  clicked_link?: string;
}

export async function POST(req: NextRequest) {
  let payload: WebhookPayload;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = payload.event_name?.[0]?.toLowerCase();

  if (!eventName || !payload.event_message?.length) {
    // Log unknown format for debugging
    console.warn("[ZeptoMail Webhook] Unknown payload format:", JSON.stringify(payload).slice(0, 500));
    return NextResponse.json({ received: true });
  }

  for (const msg of payload.event_message) {
    const requestId = msg.request_id;
    const detail = msg.event_data?.[0]?.details?.[0];
    const eventTime = detail?.time || detail?.modified_time || new Date().toISOString();

    if (!requestId) {
      console.warn("[ZeptoMail Webhook] No request_id in event_message, skipping");
      continue;
    }

    try {
      switch (eventName) {
        case "hardbounce":
        case "softbounce": {
          const bounceType = eventName === "hardbounce" ? "hard" : "soft";
          const reason = [detail?.reason, detail?.diagnostic_message]
            .filter(Boolean)
            .join(" — ") || "Unknown bounce";

          await query(
            `UPDATE email_sends
             SET status = 'bounced',
                 bounced_at = $1,
                 bounce_type = $2,
                 bounce_reason = $3,
                 error_message = $4
             WHERE provider_id = $5`,
            [eventTime, bounceType, reason, reason, requestId]
          );
          break;
        }

        case "delivered": {
          await query(
            `UPDATE email_sends
             SET status = 'delivered',
                 delivered_at = $1
             WHERE provider_id = $2
               AND status NOT IN ('bounced')`,
            [eventTime, requestId]
          );
          break;
        }

        case "email_open": {
          await query(
            `UPDATE email_sends
             SET opened_at = COALESCE(opened_at, $1)
             WHERE provider_id = $2`,
            [eventTime, requestId]
          );
          break;
        }

        case "email_link_click": {
          await query(
            `UPDATE email_sends
             SET clicked_at = COALESCE(clicked_at, $1)
             WHERE provider_id = $2`,
            [eventTime, requestId]
          );
          break;
        }

        default:
          console.log(`[ZeptoMail Webhook] Unhandled event: ${eventName}`);
      }
    } catch (err) {
      console.error(`[ZeptoMail Webhook] DB error for ${eventName}:`, err);
    }
  }

  return NextResponse.json({ received: true });
}
