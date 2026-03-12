import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listProjects, createProject } from "@/lib/services/project-service";
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
    invited_member_id: url.get("invited_member_id") ? Number(url.get("invited_member_id")) : undefined,
    visible_to_member_id: url.get("visible_to_member_id") ? Number(url.get("visible_to_member_id")) : undefined,
    search: url.get("search") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role === "member") {
    return NextResponse.json({ error: "Los miembros no pueden crear proyectos" }, { status: 403 });
  }

  const body = await req.json();

  // For client role, auto-resolve client_id from user email (or create client record)
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
    deadline: body.deadline,
    is_private: body.is_private,
  });
  return NextResponse.json({ data: project }, { status: 201 });
}
