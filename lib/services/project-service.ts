import { query } from "@/lib/db";
import type { Project, ProjectBid, ProjectRequirement } from "@/lib/types";
import { randomHex } from "@/lib/utils";

// ----- List / Get -----

export async function listProjects(params: {
  page?: number;
  per_page?: number;
  status?: string;
  client_id?: number;
  member_id?: number;
  search?: string;
  is_private?: boolean;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.status) {
    conds.push(`p.status = $${idx++}`);
    vals.push(params.status);
  }
  if (params.client_id) {
    conds.push(`p.client_id = $${idx++}`);
    vals.push(params.client_id);
  }
  if (params.member_id) {
    conds.push(`p.assigned_member_id = $${idx++}`);
    vals.push(params.member_id);
  }
  if (params.is_private !== undefined) {
    conds.push(`p.is_private = $${idx++}`);
    vals.push(params.is_private);
  }
  if (params.search) {
    conds.push(`(p.title ILIKE $${idx} OR p.description ILIKE $${idx})`);
    vals.push(`%${params.search}%`);
    idx++;
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const countRes = await query(`SELECT COUNT(*) FROM projects p ${where}`, vals);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataVals = [...vals, perPage, offset];
  const result = await query(
    `SELECT p.*,
            c.name  AS client_name,
            m.name  AS member_name
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     LEFT JOIN members m ON m.id = p.assigned_member_id
     ${where}
     ORDER BY p.updated_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    dataVals
  );

  return {
    data: result.rows,
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
}

export async function getProjectById(id: number) {
  const result = await query(
    `SELECT p.*,
            c.name  AS client_name,  c.email AS client_email,
            m.name  AS member_name,  m.email AS member_email
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     LEFT JOIN members m ON m.id = p.assigned_member_id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getProjectByToken(token: string) {
  const result = await query(
    `SELECT p.*,
            c.name AS client_name,
            m.name AS member_name
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     LEFT JOIN members m ON m.id = p.assigned_member_id
     WHERE p.share_token = $1`,
    [token]
  );
  return result.rows[0] || null;
}

// ----- Create -----

export async function createProject(data: {
  client_id: number;
  title: string;
  description?: string;
  budget_min?: number;
  budget_max?: number;
  deadline?: string;
  is_private?: boolean;
  assigned_member_id?: number;
}): Promise<Project> {
  const shareToken = data.is_private ? null : randomHex(32);
  const result = await query(
    `INSERT INTO projects
       (client_id, title, description, budget_min, budget_max, deadline, is_private, share_token, assigned_member_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      data.client_id,
      data.title,
      data.description || null,
      data.budget_min ?? null,
      data.budget_max ?? null,
      data.deadline || null,
      data.is_private ?? false,
      shareToken,
      data.assigned_member_id ?? null,
    ]
  );
  return result.rows[0];
}

// ----- Update -----

export async function updateProject(
  id: number,
  data: Partial<{
    title: string;
    description: string;
    status: string;
    budget_min: number;
    budget_max: number;
    deadline: string;
    is_private: boolean;
    assigned_member_id: number;
  }>
): Promise<Project | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }
  if (fields.length === 0) return getProjectById(id);

  vals.push(id);
  const result = await query(
    `UPDATE projects SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

// ----- Delete -----

export async function deleteProject(id: number): Promise<boolean> {
  const result = await query("DELETE FROM projects WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

// ----- Bids -----

export async function getProjectBids(projectId: number): Promise<(ProjectBid & { member_name: string })[]> {
  const result = await query(
    `SELECT pb.*, m.name AS member_name
     FROM project_bids pb
     JOIN members m ON m.id = pb.member_id
     WHERE pb.project_id = $1
     ORDER BY pb.created_at DESC`,
    [projectId]
  );
  return result.rows;
}

export async function createBid(data: {
  project_id: number;
  member_id: number;
  proposal: string;
  bid_amount: number;
  estimated_days?: number;
}): Promise<ProjectBid> {
  const result = await query(
    `INSERT INTO project_bids (project_id, member_id, proposal, bid_amount, estimated_days)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [data.project_id, data.member_id, data.proposal, data.bid_amount, data.estimated_days ?? null]
  );
  return result.rows[0];
}

export async function updateBidStatus(
  bidId: number,
  status: "accepted" | "rejected"
): Promise<ProjectBid | null> {
  const result = await query(
    "UPDATE project_bids SET status = $1 WHERE id = $2 RETURNING *",
    [status, bidId]
  );
  // If accepted, assign member to project
  if (status === "accepted" && result.rows[0]) {
    const bid = result.rows[0];
    await query(
      "UPDATE projects SET assigned_member_id = $1 WHERE id = $2",
      [bid.member_id, bid.project_id]
    );
    // Reject other bids
    await query(
      "UPDATE project_bids SET status = 'rejected' WHERE project_id = $1 AND id != $2 AND status = 'pending'",
      [bid.project_id, bidId]
    );
  }
  return result.rows[0] || null;
}

// ----- Requirements -----

export async function getProjectRequirements(projectId: number): Promise<ProjectRequirement[]> {
  const result = await query(
    "SELECT * FROM project_requirements WHERE project_id = $1 ORDER BY id",
    [projectId]
  );
  return result.rows;
}

export async function createRequirement(data: {
  project_id: number;
  title: string;
  description?: string;
  cost?: number;
}): Promise<ProjectRequirement> {
  const result = await query(
    `INSERT INTO project_requirements (project_id, title, description, cost)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [data.project_id, data.title, data.description || null, data.cost ?? null]
  );
  return result.rows[0];
}

export async function updateRequirement(
  id: number,
  data: Partial<{ title: string; description: string; cost: number; is_completed: boolean }>
): Promise<ProjectRequirement | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }

  if (data.is_completed === true) {
    fields.push(`completed_at = NOW()`);
  } else if (data.is_completed === false) {
    fields.push(`completed_at = NULL`);
  }

  if (fields.length === 0) return null;

  vals.push(id);
  const result = await query(
    `UPDATE project_requirements SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

export async function deleteRequirement(id: number): Promise<boolean> {
  const result = await query("DELETE FROM project_requirements WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

// ----- Cancellation Requests -----

export async function getCancellationRequests(projectId: number) {
  const result = await query(
    `SELECT cr.*, u.email AS requester_email,
            u2.email AS resolver_email
     FROM project_cancellation_requests cr
     JOIN users u ON u.id = cr.requested_by
     LEFT JOIN users u2 ON u2.id = cr.resolved_by
     WHERE cr.project_id = $1
     ORDER BY cr.created_at DESC`,
    [projectId]
  );
  return result.rows;
}

export async function createCancellationRequest(data: {
  project_id: number;
  requested_by: string;
  reason: string;
}) {
  const result = await query(
    `INSERT INTO project_cancellation_requests (project_id, requested_by, reason)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [data.project_id, data.requested_by, data.reason]
  );
  return result.rows[0];
}

export async function resolveCancellationRequest(
  id: number,
  status: "approved" | "rejected",
  resolvedBy: string
) {
  const result = await query(
    `UPDATE project_cancellation_requests
     SET status = $1, resolved_at = NOW(), resolved_by = $2
     WHERE id = $3
     RETURNING *`,
    [status, resolvedBy, id]
  );
  // If approved, cancel the project
  if (status === "approved" && result.rows[0]) {
    await query(
      "UPDATE projects SET status = 'cancelled' WHERE id = $1",
      [result.rows[0].project_id]
    );
  }
  return result.rows[0] || null;
}
