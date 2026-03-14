import { query, transaction } from "@/lib/db";
import type { Project, ProjectBid, ProjectRequirement, RequirementItem, ProjectPayment, RequirementAssignment } from "@/lib/types";
import { randomHex } from "@/lib/utils";

// ----- List / Get -----

export async function listProjects(params: {
  page?: number;
  per_page?: number;
  status?: string;
  client_id?: number;
  member_id?: number;
  assigned_member_id?: number;
  invited_member_id?: number;
  visible_to_member_id?: number;
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
    conds.push(`EXISTS (SELECT 1 FROM project_bids pb2 WHERE pb2.project_id = p.id AND pb2.member_id = $${idx++} AND pb2.status = 'accepted')`);
    vals.push(params.member_id);
  }
  if (params.assigned_member_id) {
    conds.push(`p.assigned_member_id = $${idx++}`);
    vals.push(params.assigned_member_id);
  }
  if (params.invited_member_id) {
    conds.push(`EXISTS (SELECT 1 FROM project_bids pb3 WHERE pb3.project_id = p.id AND pb3.member_id = $${idx++} AND pb3.status != 'rejected')`);
    vals.push(params.invited_member_id);
  }
  if (params.visible_to_member_id) {
    conds.push(`(p.is_private = false OR EXISTS (SELECT 1 FROM project_bids pb4 WHERE pb4.project_id = p.id AND pb4.member_id = $${idx++} AND pb4.status != 'rejected'))`);
    vals.push(params.visible_to_member_id);
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
            (SELECT COALESCE(json_agg(json_build_object('name', m.name, 'photo_url', m.photo_url)), '[]'::json)
             FROM project_bids pb_m
             JOIN members m ON m.id = pb_m.member_id
             WHERE pb_m.project_id = p.id AND pb_m.status = 'accepted'
            ) AS accepted_members
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
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
            c.name  AS client_name,  c.email AS client_email
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getProjectByToken(token: string) {
  const result = await query(
    `SELECT p.*,
            c.name AS client_name
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
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
  final_cost?: number;
  deadline?: string;
  is_private?: boolean;
  status?: string;
  assigned_member_id?: number;
}): Promise<Project> {
  const shareToken = data.is_private ? null : randomHex(32);
  const result = await query(
    `INSERT INTO projects
       (client_id, title, description, budget_min, budget_max, final_cost, deadline, is_private, share_token, assigned_member_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      data.client_id,
      data.title,
      data.description || null,
      data.budget_min ?? null,
      data.budget_max ?? null,
      data.final_cost ?? null,
      data.deadline || null,
      data.is_private ?? false,
      shareToken,
      data.assigned_member_id ?? null,
      data.status ?? "draft",
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
    cancellation_reason: string;
    final_cost: number;
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

  // If making project public and it has no share_token, generate one
  if (data.is_private === false) {
    const existing = await getProjectById(id);
    if (existing && !existing.share_token) {
      fields.push(`share_token = $${idx++}`);
      vals.push(randomHex(32));
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

export async function getProjectBids(projectId: number): Promise<(ProjectBid & { member_name: string; member_photo_url: string | null })[]> {
  const result = await query(
    `SELECT pb.*, m.name AS member_name, m.photo_url AS member_photo_url
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
}): Promise<ProjectRequirement> {
  const result = await query(
    `INSERT INTO project_requirements (project_id, title, description)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [data.project_id, data.title, data.description || null]
  );
  return result.rows[0];
}

export async function updateRequirement(
  id: number,
  data: Partial<{ title: string; description: string; cost: number; completed: boolean }>
): Promise<ProjectRequirement | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== "completed") {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }

  if (data.completed === true) {
    fields.push(`completed_at = NOW()`);
  } else if (data.completed === false) {
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

// ----- Invitations & Members -----

export async function inviteMembers(
  projectId: number,
  memberIds: number[]
): Promise<ProjectBid[]> {
  const results: ProjectBid[] = [];
  for (const memberId of memberIds) {
    const result = await query(
      `INSERT INTO project_bids (project_id, member_id, status)
       VALUES ($1, $2, 'invited')
       ON CONFLICT (project_id, member_id) DO NOTHING
       RETURNING *`,
      [projectId, memberId]
    );
    if (result.rows[0]) results.push(result.rows[0]);
  }
  return results;
}

export async function submitBidProposal(
  bidId: number,
  data: {
    proposal: string;
    bid_amount: number;
    requirement_ids?: number[];
    work_dates?: string[];
  }
): Promise<ProjectBid | null> {
  const result = await query(
    `UPDATE project_bids
     SET proposal = $1, bid_amount = $2, requirement_ids = $3, work_dates = $4::date[],
         estimated_days = $5, status = 'pending'
     WHERE id = $6 AND status = 'invited'
     RETURNING *`,
    [
      data.proposal,
      data.bid_amount,
      data.requirement_ids || [],
      data.work_dates || [],
      data.work_dates?.length ?? null,
      bidId,
    ]
  );
  return result.rows[0] || null;
}

export async function getAcceptedMembers(projectId: number) {
  const result = await query(
    `SELECT pb.id AS bid_id, pb.bid_amount, pb.estimated_days,
            pb.proposal, pb.requirement_ids, pb.work_dates,
            m.id, m.name, m.email, m.photo_url, m.position_id,
            pos.name AS position_name
     FROM project_bids pb
     JOIN members m ON m.id = pb.member_id
     LEFT JOIN positions pos ON pos.id = m.position_id
     WHERE pb.project_id = $1 AND pb.status = 'accepted'
     ORDER BY pb.created_at`,
    [projectId]
  );
  return result.rows;
}

export async function confirmProject(projectId: number) {
  return transaction(async (client) => {
    // Sum accepted bids
    const sumRes = await client.query(
      `SELECT COALESCE(SUM(bid_amount), 0) AS total
       FROM project_bids
       WHERE project_id = $1 AND status = 'accepted'`,
      [projectId]
    );
    const finalCost = parseFloat(sumRes.rows[0].total);

    // Set final_cost, confirmed_at, and auto-privatize
    await client.query(
      `UPDATE projects SET final_cost = $1, confirmed_at = NOW(), is_private = true WHERE id = $2`,
      [finalCost, projectId]
    );

    // Distribute cost among requirements
    const reqRes = await client.query(
      `SELECT id FROM project_requirements WHERE project_id = $1 ORDER BY id`,
      [projectId]
    );
    const reqCount = reqRes.rows.length;
    if (reqCount > 0) {
      const perReq = Math.floor((finalCost / reqCount) * 100) / 100;
      const remainder = Math.round((finalCost - perReq * reqCount) * 100) / 100;
      for (let i = 0; i < reqCount; i++) {
        const cost = i === reqCount - 1 ? perReq + remainder : perReq;
        await client.query(
          `UPDATE project_requirements SET cost = $1 WHERE id = $2`,
          [cost, reqRes.rows[i].id]
        );
      }
    }

    // Reject remaining invited/pending bids
    await client.query(
      `UPDATE project_bids SET status = 'rejected'
       WHERE project_id = $1 AND status IN ('invited', 'pending')`,
      [projectId]
    );

    // Return updated project
    const projRes = await client.query(
      `SELECT p.*, c.name AS client_name, c.email AS client_email
       FROM projects p
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [projectId]
    );
    return projRes.rows[0];
  });
}

// ----- Requirement Visibility -----

export async function getTakenRequirementIds(projectId: number): Promise<number[]> {
  const result = await query(
    `SELECT DISTINCT UNNEST(requirement_ids) AS req_id
     FROM project_bids
     WHERE project_id = $1 AND status = 'accepted'`,
    [projectId]
  );
  return result.rows.map((r: { req_id: number }) => r.req_id);
}

export async function getUntakenRequirements(projectId: number): Promise<ProjectRequirement[]> {
  const result = await query(
    `SELECT pr.* FROM project_requirements pr
     WHERE pr.project_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM project_bids pb
         WHERE pb.project_id = $1
           AND pb.status = 'accepted'
           AND pr.id = ANY(pb.requirement_ids)
       )
     ORDER BY pr.id`,
    [projectId]
  );
  return result.rows;
}

export async function areAllRequirementsTaken(projectId: number): Promise<boolean> {
  const result = await query(
    "SELECT COUNT(*) AS total FROM project_requirements WHERE project_id = $1",
    [projectId]
  );
  const total = parseInt(result.rows[0].total, 10);
  if (total === 0) return false;
  const untaken = await getUntakenRequirements(projectId);
  return untaken.length === 0;
}

export async function revokeNonAcceptedAccess(projectId: number): Promise<number> {
  const result = await query(
    `UPDATE project_bids SET status = 'rejected'
     WHERE project_id = $1 AND status IN ('invited', 'pending')
     RETURNING member_id`,
    [projectId]
  );
  return result.rowCount ?? 0;
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

  // Attach votes for each request
  for (const req of result.rows) {
    const votesRes = await query(
      `SELECT v.*, m.name AS member_name, m.photo_url AS member_photo_url
       FROM project_cancellation_votes v
       JOIN members m ON m.id = v.member_id
       WHERE v.request_id = $1
       ORDER BY v.created_at`,
      [req.id]
    );
    req.votes = votesRes.rows;
  }

  return result.rows;
}

export async function getCancellationRequestCount(projectId: number): Promise<number> {
  const result = await query(
    "SELECT COUNT(*) FROM project_cancellation_requests WHERE project_id = $1",
    [projectId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function hasPendingCancellation(projectId: number): Promise<boolean> {
  const result = await query(
    `SELECT COUNT(*) FROM project_cancellation_requests
     WHERE project_id = $1 AND status = 'pending'`,
    [projectId]
  );
  return parseInt(result.rows[0].count, 10) > 0;
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

export async function createCancellationVote(data: {
  request_id: number;
  member_id: number;
  user_id: string;
  vote: "approve" | "reject";
  comment?: string;
}) {
  const result = await query(
    `INSERT INTO project_cancellation_votes (request_id, member_id, user_id, vote, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (request_id, member_id) DO UPDATE SET vote = $4, comment = $5
     RETURNING *`,
    [data.request_id, data.member_id, data.user_id, data.vote, data.comment ?? null]
  );
  return result.rows[0];
}

export async function evaluateCancellationVotes(requestId: number, projectId: number) {
  // Get total accepted members
  const membersRes = await query(
    "SELECT COUNT(*) FROM project_bids WHERE project_id = $1 AND status = 'accepted'",
    [projectId]
  );
  const totalMembers = parseInt(membersRes.rows[0].count, 10);

  // Get votes
  const votesRes = await query(
    `SELECT vote, COUNT(*) AS cnt FROM project_cancellation_votes
     WHERE request_id = $1 GROUP BY vote`,
    [requestId]
  );
  const voteCounts: Record<string, number> = {};
  for (const row of votesRes.rows) {
    voteCounts[row.vote] = parseInt(row.cnt, 10);
  }
  const approves = voteCounts["approve"] || 0;
  const rejects = voteCounts["reject"] || 0;

  // If ANY member rejects -> cancellation stopped
  if (rejects > 0) {
    return { resolved: true, status: "rejected" as const, approves, rejects, totalMembers };
  }
  // If all members approved -> cancellation approved
  if (approves === totalMembers) {
    return { resolved: true, status: "approved" as const, approves, rejects, totalMembers };
  }
  // Still pending
  return { resolved: false, status: "pending" as const, approves, rejects, totalMembers };
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
  // If approved, cancel the project and record the reason
  if (status === "approved" && result.rows[0]) {
    await query(
      "UPDATE projects SET status = 'cancelled', cancellation_reason = $1 WHERE id = $2",
      [result.rows[0].reason, result.rows[0].project_id]
    );
  }
  return result.rows[0] || null;
}

// ----- Requirement Items (sub-tasks) -----

export async function getAllRequirementItems(requirementIds: number[]): Promise<RequirementItem[]> {
  if (requirementIds.length === 0) return [];
  const result = await query(
    "SELECT * FROM requirement_items WHERE requirement_id = ANY($1) ORDER BY sort_order, id",
    [requirementIds]
  );
  return result.rows;
}

export async function createRequirementItem(data: {
  requirement_id: number;
  title: string;
}): Promise<RequirementItem> {
  const maxRes = await query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM requirement_items WHERE requirement_id = $1",
    [data.requirement_id]
  );
  const sortOrder = maxRes.rows[0].next;
  const result = await query(
    `INSERT INTO requirement_items (requirement_id, title, sort_order)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.requirement_id, data.title, sortOrder]
  );
  return result.rows[0];
}

export async function updateRequirementItem(
  id: number,
  data: Partial<{ title: string; is_completed: boolean }>
): Promise<RequirementItem | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (data.title !== undefined) { fields.push(`title = $${idx++}`); vals.push(data.title); }
  if (data.is_completed !== undefined) {
    fields.push(`is_completed = $${idx++}`);
    vals.push(data.is_completed);
    fields.push(data.is_completed ? `completed_at = NOW()` : `completed_at = NULL`);
  }
  if (fields.length === 0) return null;
  vals.push(id);
  const result = await query(
    `UPDATE requirement_items SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

export async function deleteRequirementItem(id: number): Promise<boolean> {
  const result = await query("DELETE FROM requirement_items WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function reorderRequirementItems(
  requirementId: number,
  orderedIds: number[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await query(
      "UPDATE requirement_items SET sort_order = $1 WHERE id = $2 AND requirement_id = $3",
      [i, orderedIds[i], requirementId]
    );
  }
}

// ----- Completion Check -----

export async function checkAllRequirementsCompleted(projectId: number): Promise<boolean> {
  // Get all requirements
  const reqRes = await query(
    "SELECT id, completed_at FROM project_requirements WHERE project_id = $1",
    [projectId]
  );
  if (reqRes.rows.length === 0) return false;
  return reqRes.rows.every((r: { completed_at: string | null }) => r.completed_at !== null);
}

export async function markCompletionNotified(projectId: number): Promise<void> {
  await query(
    "UPDATE projects SET completion_notified_at = NOW() WHERE id = $1",
    [projectId]
  );
}

export async function clearCompletionNotified(projectId: number): Promise<void> {
  await query(
    "UPDATE projects SET completion_notified_at = NULL WHERE id = $1",
    [projectId]
  );
}

// ----- Payments -----

export async function getProjectPayments(projectId: number): Promise<ProjectPayment[]> {
  const result = await query(
    `SELECT pp.*, u.email AS confirmer_email
     FROM project_payments pp
     LEFT JOIN users u ON u.id = pp.confirmed_by
     WHERE pp.project_id = $1
     ORDER BY pp.created_at DESC`,
    [projectId]
  );
  return result.rows;
}

export async function createProjectPayment(data: {
  project_id: number;
  amount: number;
  proof_url: string;
}): Promise<ProjectPayment> {
  const result = await query(
    `INSERT INTO project_payments (project_id, amount, proof_url)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.project_id, data.amount, data.proof_url]
  );
  return result.rows[0];
}

export async function confirmProjectPayment(
  paymentId: number,
  adminId: string,
  status: "confirmed" | "rejected",
  notes?: string
): Promise<ProjectPayment | null> {
  const result = await query(
    `UPDATE project_payments
     SET status = $1, confirmed_by = $2, confirmed_at = NOW(), notes = $3
     WHERE id = $4 RETURNING *`,
    [status, adminId, notes || null, paymentId]
  );
  return result.rows[0] || null;
}

// ----- Penalty & Blocking -----

export async function applyPenalty(projectId: number): Promise<void> {
  await query(
    `UPDATE project_bids SET bid_amount = bid_amount * 0.9
     WHERE project_id = $1 AND status = 'accepted'`,
    [projectId]
  );
  await query(
    "UPDATE projects SET penalty_applied = true WHERE id = $1",
    [projectId]
  );
}

export async function blockProjectMembers(projectId: number): Promise<number[]> {
  // Get all accepted member ids
  const res = await query(
    "SELECT member_id FROM project_bids WHERE project_id = $1 AND status = 'accepted'",
    [projectId]
  );
  const memberIds = res.rows.map((r: { member_id: number }) => r.member_id);
  if (memberIds.length > 0) {
    await query(
      "UPDATE members SET is_blocked_from_projects = true WHERE id = ANY($1)",
      [memberIds]
    );
    // Reject their bids
    await query(
      "UPDATE project_bids SET status = 'rejected' WHERE project_id = $1 AND status = 'accepted'",
      [projectId]
    );
  }
  return memberIds;
}

// ----- Requirement Assignments -----

export async function getRequirementAssignments(projectId: number): Promise<RequirementAssignment[]> {
  const result = await query(
    `SELECT ra.*, m.name AS member_name, m.photo_url AS member_photo_url,
            pr.title AS requirement_title
     FROM requirement_assignments ra
     JOIN members m ON m.id = ra.member_id
     JOIN project_requirements pr ON pr.id = ra.requirement_id
     WHERE ra.project_id = $1
     ORDER BY ra.created_at DESC`,
    [projectId]
  );
  return result.rows;
}

export async function createRequirementAssignment(data: {
  requirement_id: number;
  project_id: number;
  member_id: number;
  proposed_cost: number;
}): Promise<RequirementAssignment> {
  const result = await query(
    `INSERT INTO requirement_assignments (requirement_id, project_id, member_id, proposed_cost)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.requirement_id, data.project_id, data.member_id, data.proposed_cost]
  );
  return result.rows[0];
}

export async function submitAssignmentCost(
  id: number,
  memberCost: number
): Promise<RequirementAssignment | null> {
  const result = await query(
    `UPDATE requirement_assignments SET member_cost = $1, status = 'counter'
     WHERE id = $2 AND status IN ('proposed', 'rejected')
     RETURNING *`,
    [memberCost, id]
  );
  return result.rows[0] || null;
}

export async function resolveAssignment(
  id: number,
  status: "accepted" | "rejected"
): Promise<RequirementAssignment | null> {
  const result = await query(
    `UPDATE requirement_assignments SET status = $1
     WHERE id = $2 AND status = 'counter'
     RETURNING *`,
    [status, id]
  );
  const assignment = result.rows[0];
  if (!assignment) return null;

  if (status === "accepted") {
    const cost = parseFloat(assignment.member_cost);
    // Add requirement to member's bid requirement_ids
    await query(
      `UPDATE project_bids
       SET requirement_ids = array_append(requirement_ids, $1),
           bid_amount = COALESCE(bid_amount, 0) + $2
       WHERE project_id = $3 AND member_id = $4 AND status = 'accepted'`,
      [assignment.requirement_id, cost, assignment.project_id, assignment.member_id]
    );
    // Update project final_cost
    await query(
      `UPDATE projects SET final_cost = COALESCE(final_cost, 0) + $1
       WHERE id = $2`,
      [cost, assignment.project_id]
    );
    // Set requirement cost
    await query(
      `UPDATE project_requirements SET cost = $1
       WHERE id = $2`,
      [cost, assignment.requirement_id]
    );
  }

  return assignment;
}
