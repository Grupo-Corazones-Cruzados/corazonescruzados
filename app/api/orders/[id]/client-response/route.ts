import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import {
  clientRespondToOrder,
  getOrderMemberContacts,
} from "@/lib/services/marketplace-service";
import { sendMemberOrderAcceptedEmail } from "@/lib/integrations/resend";
import {
  createNotification,
  getUserIdByMemberId,
} from "@/lib/services/notification-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const orderId = Number(id);

  const body = await req.json();
  const { accepted } = body;

  if (typeof accepted !== "boolean") {
    return NextResponse.json({ error: "accepted (boolean) is required" }, { status: 400 });
  }

  try {
    const order = await clientRespondToOrder(orderId, auth.userId, accepted);

    // Send email to members
    const contacts = await getOrderMemberContacts(orderId);
    const userRes = await query(
      "SELECT COALESCE(first_name || ' ' || last_name, email) AS name FROM users WHERE id = $1",
      [auth.userId]
    );
    const clientName = userRes.rows[0]?.name || "Cliente";

    for (const member of contacts) {
      if (!member.email) continue;
      sendMemberOrderAcceptedEmail(
        member.email,
        member.name,
        orderId,
        clientName,
        accepted
      ).catch(console.error);

      // In-app notification for the member
      getUserIdByMemberId(member.id).then((memberUserId) => {
        if (memberUserId) {
          createNotification({
            user_id: memberUserId,
            type: "client_accepted",
            title: accepted
              ? `${clientName} aceptó el pedido #${orderId}`
              : `${clientName} rechazó el pedido #${orderId}`,
            message: accepted
              ? "El cliente aceptó las condiciones. Procede con la entrega."
              : "El cliente no aceptó las condiciones del pedido.",
            link: "/dashboard/marketplace",
          }).catch(console.error);
        }
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
