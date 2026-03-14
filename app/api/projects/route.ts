import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listProjects, createProject } from "@/lib/services/project-service";
import { ensureClientMemberAssociation, findOrCreateClientByEmail } from "@/lib/services/client-member-service";
import { sendClientInvitationEmail } from "@/lib/integrations/resend";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;

  // Resolve client_id for "my_projects" filter
  let clientId = url.get("client_id") ? Number(url.get("client_id")) : undefined;
  if (url.get("my_projects") === "true" && auth.role === "client") {
    const clientRes = await query(
      "SELECT id FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [auth.email]
    );
    if (clientRes.rows[0]) clientId = clientRes.rows[0].id;
  }

  const data = await listProjects({
    page: url.get("page") ? Number(url.get("page")) : undefined,
    per_page: url.get("per_page") ? Number(url.get("per_page")) : undefined,
    status: url.get("status") || undefined,
    client_id: clientId,
    member_id: url.get("member_id") ? Number(url.get("member_id")) : undefined,
    assigned_member_id: url.get("assigned_member_id") ? Number(url.get("assigned_member_id")) : undefined,
    invited_member_id: url.get("invited_member_id") ? Number(url.get("invited_member_id")) : undefined,
    visible_to_member_id: url.get("visible_to_member_id") ? Number(url.get("visible_to_member_id")) : undefined,
    search: url.get("search") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();

  // ----- Member role: resolve client + auto-assign -----
  if (auth.role === "member") {
    const userRes = await query(
      "SELECT member_id FROM users WHERE id = $1",
      [auth.userId]
    );
    const memberId = userRes.rows[0]?.member_id;
    if (!memberId) {
      return NextResponse.json(
        { error: "No member profile linked" },
        { status: 400 }
      );
    }

    // Handle client_email (new client) or client_id (existing)
    if (body.client_email && !body.client_id) {
      const { client } = await findOrCreateClientByEmail(body.client_email);
      body.client_id = client.id;

      // Send invitation if no user account exists for this email
      const userCheck = await query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [body.client_email]
      );
      if (userCheck.rows.length === 0) {
        const memberData = await query("SELECT name FROM members WHERE id = $1", [memberId]);
        const memberName = memberData.rows[0]?.name || "Un miembro";
        try {
          await sendClientInvitationEmail(body.client_email, memberName, body.title);
        } catch { /* email failure should not block project creation */ }
      }

      await ensureClientMemberAssociation({
        client_id: client.id,
        member_id: memberId,
        source: "project_created",
      });
    } else if (body.client_id) {
      await ensureClientMemberAssociation({
        client_id: body.client_id,
        member_id: memberId,
        source: "project_created",
      });
    }

    // Keep final_cost as-is (goes to final_cost column, not budget)

    // Auto-assign this member, private, and in_progress
    body.assigned_member_id = memberId;
    body.is_private = true;
    body.status = "in_progress";
  }

  // ----- Client role: auto-resolve client_id -----
  if (auth.role === "client" && !body.client_id) {
    const clientRes = await query(
      "SELECT id FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [auth.email]
    );
    if (clientRes.rows[0]) {
      body.client_id = clientRes.rows[0].id;
    } else {
      const userRes = await query(
        "SELECT first_name, last_name, email, phone FROM users WHERE id = $1",
        [auth.userId]
      );
      if (userRes.rows[0]) {
        const u = userRes.rows[0];
        const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
        const insertRes = await query(
          "INSERT INTO clients (name, email, phone) VALUES ($1, $2, $3) RETURNING id",
          [name, u.email, u.phone]
        );
        body.client_id = insertRes.rows[0].id;
      }
    }
  }

  if (!body.client_id || !body.title) {
    return NextResponse.json(
      { error: "client_id and title are required" },
      { status: 400 }
    );
  }

  const project = await createProject({
    client_id: body.client_id,
    title: body.title,
    description: body.description,
    budget_min: body.budget_min,
    budget_max: body.budget_max,
    final_cost: body.final_cost,
    deadline: body.deadline,
    is_private: body.is_private,
    status: body.status,
    assigned_member_id: body.assigned_member_id,
  });

  // Auto-add member as accepted participant when they create the project
  if (auth.role === "member" && body.assigned_member_id) {
    await query(
      `INSERT INTO project_bids (project_id, member_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT (project_id, member_id) DO NOTHING`,
      [project.id, body.assigned_member_id]
    );
  }

  return NextResponse.json({ data: project }, { status: 201 });
}
