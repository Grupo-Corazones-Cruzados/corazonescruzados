import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  listOrders,
  createOrderFromCart,
  getOrderMemberContacts,
  getOrderWithItems,
} from "@/lib/services/marketplace-service";
import { sendMemberConfirmationRequestEmail } from "@/lib/integrations/resend";
import { formatCurrency } from "@/lib/utils";
import {
  createNotification,
  getUserIdByMemberId,
} from "@/lib/services/notification-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const data = await listOrders({
    user_id: auth.role === "admin" ? undefined : auth.userId,
    page: url.get("page") ? Number(url.get("page")) : undefined,
    per_page: url.get("per_page") ? Number(url.get("per_page")) : undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  try {
    const order = await createOrderFromCart(auth.userId);

    // If the order needs member confirmation, send emails
    if (order.status === "pending_confirmation") {
      const orderWithItems = await getOrderWithItems(order.id);
      const contacts = await getOrderMemberContacts(order.id);
      const clientName = orderWithItems?.user_name || auth.email;

      for (const member of contacts) {
        if (!member.email) continue;
        const memberItems = (orderWithItems?.items || [])
          .filter((i) => i.member_id === member.id)
          .map((i) => ({
            name: i.product_name || "Producto",
            quantity: i.quantity,
            price: formatCurrency(i.unit_price),
          }));

        sendMemberConfirmationRequestEmail(
          member.email,
          member.name,
          order.id,
          clientName,
          memberItems
        ).catch(console.error);

        // In-app notification for the member
        getUserIdByMemberId(member.id).then((memberUserId) => {
          if (memberUserId) {
            createNotification({
              user_id: memberUserId,
              type: "order_created",
              title: "Nueva solicitud de compra",
              message: `${clientName} ha solicitado productos tuyos. Revisa y confirma.`,
              link: "/dashboard/marketplace/confirmations",
            }).catch(console.error);
          }
        }).catch(console.error);
      }
    }

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create order" },
      { status: 400 }
    );
  }
}
