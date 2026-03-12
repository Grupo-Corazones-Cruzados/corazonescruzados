import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getProjectById,
  getProjectPayments,
  createProjectPayment,
  confirmProjectPayment,
  updateProject,
} from "@/lib/services/project-service";
import { query } from "@/lib/db";

// GET - list payments
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const payments = await getProjectPayments(Number(id));
  return NextResponse.json({ data: payments });
}

// POST - upload payment proof (project owner)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify owner
  if (auth.role === "client") {
    const clientRes = await query(
      "SELECT id FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [auth.email]
    );
    if (!clientRes.rows[0] || clientRes.rows[0].id !== project.client_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!body.proof_url) {
    return NextResponse.json({ error: "proof_url is required" }, { status: 400 });
  }

  const amount = project.final_cost || 0;

  // Check for existing rejected payment — replace it instead of creating a new one
  const existingRejected = await query(
    `SELECT id FROM project_payments
     WHERE project_id = $1 AND status = 'rejected'
     ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  );

  let payment;
  if (existingRejected.rows[0]) {
    const updated = await query(
      `UPDATE project_payments
       SET proof_url = $1, amount = $2, status = 'pending',
           confirmed_by = NULL, confirmed_at = NULL, notes = NULL
       WHERE id = $3 RETURNING *`,
      [body.proof_url, amount, existingRejected.rows[0].id]
    );
    payment = updated.rows[0];
  } else {
    payment = await createProjectPayment({
      project_id: projectId,
      amount,
      proof_url: body.proof_url,
    });
  }

  // Change project status to completed
  await updateProject(projectId, { status: "completed" });

  // Notify admin about pending payment confirmation
  try {
    const adminRes = await query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 5"
    );
    for (const admin of adminRes.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, 'payment_submitted', $2, $3, $4)`,
        [
          admin.id,
          `Pago pendiente: ${project.title}`,
          `El cliente ha enviado comprobante de pago para el proyecto "${project.title}".`,
          `/dashboard/projects/${projectId}`,
        ]
      );
    }
  } catch {
    // Don't fail
  }

  return NextResponse.json({ data: payment }, { status: 201 });
}

// PATCH - admin confirm/reject payment
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.payment_id || !body.status) {
    return NextResponse.json(
      { error: "payment_id and status are required" },
      { status: 400 }
    );
  }

  const payment = await confirmProjectPayment(
    body.payment_id,
    auth.userId,
    body.status,
    body.notes
  );

  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const project = await getProjectById(payment.project_id);

  if (body.status === "confirmed") {
    // Confirmed → project closed
    await updateProject(payment.project_id, { status: "closed" });

    try {
      if (project) {
        const ownerRes = await query(
          `SELECT u.id FROM users u
           JOIN clients c ON LOWER(c.email) = LOWER(u.email)
           WHERE c.id = $1 LIMIT 1`,
          [project.client_id]
        );
        if (ownerRes.rows[0]) {
          await query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, 'payment_confirmed', $2, $3, $4)`,
            [
              ownerRes.rows[0].id,
              "Pago confirmado",
              `El pago del proyecto "${project.title}" ha sido confirmado. El proyecto está cerrado.`,
              `/dashboard/projects/${payment.project_id}`,
            ]
          );
        }
      }
    } catch {
      // Don't fail
    }
  } else if (body.status === "rejected") {
    // Rejected → project back to in_progress so owner can re-upload
    await updateProject(payment.project_id, { status: "in_progress" });

    try {
      if (project) {
        const ownerRes = await query(
          `SELECT u.id FROM users u
           JOIN clients c ON LOWER(c.email) = LOWER(u.email)
           WHERE c.id = $1 LIMIT 1`,
          [project.client_id]
        );
        if (ownerRes.rows[0]) {
          await query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, 'payment_submitted', $2, $3, $4)`,
            [
              ownerRes.rows[0].id,
              "Comprobante rechazado",
              `El comprobante de pago del proyecto "${project.title}" fue rechazado${body.notes ? `: ${body.notes}` : ""}. Por favor envía un nuevo comprobante.`,
              `/dashboard/projects/${payment.project_id}`,
            ]
          );
        }
      }
    } catch {
      // Don't fail
    }
  }

  return NextResponse.json({ data: payment });
}
