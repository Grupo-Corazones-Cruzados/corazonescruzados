import { NextRequest, NextResponse } from "next/server";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import {
  memberRespondToOrder,
  getOrderWithItems,
} from "@/lib/services/marketplace-service";
import { sendClientMemberResponseEmail } from "@/lib/integrations/resend";
import { createNotification } from "@/lib/services/notification-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const orderId = Number(id);

  // Resolve the member_id for this user
  const userRes = await query("SELECT member_id FROM users WHERE id = $1", [auth.userId]);
  const memberId = userRes.rows[0]?.member_id;
  if (!memberId) {
    return NextResponse.json({ error: "No member profile linked" }, { status: 400 });
  }

  const body = await req.json();
  const { confirmed, delivery_date, message } = body;

  if (typeof confirmed !== "boolean") {
    return NextResponse.json({ error: "confirmed (boolean) is required" }, { status: 400 });
  }

  if (confirmed && !delivery_date) {
    return NextResponse.json({ error: "delivery_date is required when confirming" }, { status: 400 });
  }

  try {
    const order = await memberRespondToOrder(orderId, memberId, {
      confirmed,
      delivery_date,
      message,
    });

    // Send email to client
    if (order) {
      const memberRes = await query("SELECT name FROM members WHERE id = $1", [memberId]);
      const memberName = memberRes.rows[0]?.name || "Miembro";

      sendClientMemberResponseEmail(
        order.user_email || "",
        order.user_name || "Cliente",
        orderId,
        memberName,
        confirmed,
        delivery_date,
        message
      ).catch(console.error);

      // In-app notification for the order owner
      createNotification({
        user_id: order.user_id,
        type: "member_confirmed",
        title: confirmed
          ? `${memberName} confirmó tu pedido`
          : `${memberName} rechazó tu pedido`,
        message: confirmed
          ? `Fecha de entrega: ${delivery_date}${message ? `. ${message}` : ""}`
          : message || "El miembro no puede completar este pedido.",
        link: `/dashboard/marketplace/orders/${orderId}`,
      }).catch(console.error);
    }

    return NextResponse.json({ data: order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to respond" },
      { status: 400 }
    );
  }
}
