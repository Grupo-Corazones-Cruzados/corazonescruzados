import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { sendSupportEmail } from "@/lib/integrations/resend";
import { createSupportTicket, listSupportTickets } from "@/lib/services/support-service";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;

  const data = await listSupportTickets({
    // Admins see all, others see only their own
    user_id: auth.role === "admin" ? (url.get("user_id") || undefined) : auth.userId,
    status: url.get("status") || undefined,
    page: url.get("page") ? Number(url.get("page")) : undefined,
    per_page: url.get("per_page") ? Number(url.get("per_page")) : undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { type, subject, message, attachment_url } = await req.json();

  if (!type || !subject || !message) {
    return NextResponse.json(
      { error: "Todos los campos son requeridos" },
      { status: 400 }
    );
  }

  // Save to DB
  const ticket = await createSupportTicket({
    user_id: auth.userId,
    type,
    subject,
    message,
    attachment_url,
  });

  // Send email notification
  const userRes = await query(
    "SELECT first_name, last_name, email FROM users WHERE id = $1",
    [auth.userId]
  );
  const u = userRes.rows[0];
  const userName = [u?.first_name, u?.last_name].filter(Boolean).join(" ") || auth.email;

  try {
    await sendSupportEmail({
      userName,
      userEmail: auth.email,
      userRole: auth.role,
      type,
      subject,
      message,
    });
  } catch { /* email failure should not block ticket creation */ }

  return NextResponse.json({ data: ticket }, { status: 201 });
}
