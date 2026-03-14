import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listTickets, createTicket } from "@/lib/services/ticket-service";
import { ensureClientMemberAssociation, findOrCreateClientByEmail } from "@/lib/services/client-member-service";
import { sendClientInvitationEmail } from "@/lib/integrations/resend";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const data = await listTickets({
    page: Number(url.get("page")) || 1,
    per_page: Number(url.get("per_page")) || 20,
    status: url.get("status") || undefined,
    user_id: url.get("user_id") || undefined,
    member_id: url.get("member_id") ? Number(url.get("member_id")) : undefined,
    search: url.get("search") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();

  if (!body.title) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    );
  }

  // Handle client_email: find/create client + associate + invite
  if (body.client_email && !body.client_id && body.member_id) {
    const { client } = await findOrCreateClientByEmail(body.client_email);
    body.client_id = client.id;

    await ensureClientMemberAssociation({
      client_id: client.id,
      member_id: body.member_id,
      source: "ticket_created",
    });

    // Send invitation if no user account
    const userCheck = await query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [body.client_email]
    );
    if (userCheck.rows.length === 0) {
      const memberData = await query("SELECT name FROM members WHERE id = $1", [body.member_id]);
      const memberName = memberData.rows[0]?.name || "Un miembro";
      try {
        await sendClientInvitationEmail(body.client_email, memberName);
      } catch { /* email failure should not block ticket creation */ }
    }
  }

  try {
    const ticket = await createTicket({
      user_id: auth.userId,
      title: body.title,
      description: body.description,
      service_id: body.service_id,
      member_id: body.member_id,
      client_id: body.client_id,
      deadline: body.deadline,
      estimated_hours: body.estimated_hours,
      estimated_cost: body.estimated_cost,
    });

    // Ensure association for existing client_id + member_id
    if (ticket.client_id && ticket.member_id) {
      await ensureClientMemberAssociation({
        client_id: ticket.client_id,
        member_id: ticket.member_id,
        source: "ticket_created",
      });
    }

    return NextResponse.json({ data: ticket }, { status: 201 });
  } catch (error) {
    console.error("Create ticket error:", error);
    return NextResponse.json(
      { error: "Error al crear ticket" },
      { status: 500 }
    );
  }
}
