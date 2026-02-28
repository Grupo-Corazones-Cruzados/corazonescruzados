import { query } from "@/lib/db";
import type { Package, PackagePurchase } from "@/lib/types";

// ----- Packages (catalog) -----

export async function listPackages(activeOnly = true): Promise<Package[]> {
  const where = activeOnly ? "WHERE is_active = true" : "";
  const result = await query(
    `SELECT * FROM packages ${where} ORDER BY sort_order, id`
  );
  return result.rows;
}

export async function getPackageById(id: number): Promise<Package | null> {
  const result = await query("SELECT * FROM packages WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function createPackage(data: {
  name: string;
  description?: string;
  price: number;
  hours: number;
  features?: string[];
  sort_order?: number;
}): Promise<Package> {
  const result = await query(
    `INSERT INTO packages (name, description, price, hours, features, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      data.name,
      data.description || null,
      data.price,
      data.hours,
      data.features || [],
      data.sort_order ?? 0,
    ]
  );
  return result.rows[0];
}

export async function updatePackage(
  id: number,
  data: Partial<{
    name: string;
    description: string;
    price: number;
    hours: number;
    features: string[];
    is_active: boolean;
    sort_order: number;
  }>
): Promise<Package | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }
  if (fields.length === 0) return getPackageById(id);

  vals.push(id);
  const result = await query(
    `UPDATE packages SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

// ----- Purchases -----

export async function listPurchases(params: {
  page?: number;
  per_page?: number;
  client_id?: number;
  status?: string;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.client_id) {
    conds.push(`pp.client_id = $${idx++}`);
    vals.push(params.client_id);
  }
  if (params.status) {
    conds.push(`pp.status = $${idx++}`);
    vals.push(params.status);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const countRes = await query(
    `SELECT COUNT(*) FROM package_purchases pp ${where}`,
    vals
  );
  const total = parseInt(countRes.rows[0].count, 10);

  const dataVals = [...vals, perPage, offset];
  const result = await query(
    `SELECT pp.*,
            p.name AS package_name,
            c.name AS client_name
     FROM package_purchases pp
     JOIN packages p ON p.id = pp.package_id
     JOIN clients c ON c.id = pp.client_id
     ${where}
     ORDER BY pp.created_at DESC
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

export async function createPurchase(data: {
  package_id: number;
  client_id: number;
  user_id: string;
  hours_total: number;
  payment_ref?: string;
  expires_at?: string;
}): Promise<PackagePurchase> {
  const result = await query(
    `INSERT INTO package_purchases (package_id, client_id, user_id, hours_total, payment_ref, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      data.package_id,
      data.client_id,
      data.user_id,
      data.hours_total,
      data.payment_ref || null,
      data.expires_at || null,
    ]
  );
  return result.rows[0];
}

// ----- Requests -----

export async function listRequests(purchaseId: number) {
  const result = await query(
    `SELECT pr.*, s.name AS service_name, c.name AS client_name
     FROM package_requests pr
     LEFT JOIN services s ON s.id = pr.service_id
     JOIN clients c ON c.id = pr.client_id
     WHERE pr.purchase_id = $1
     ORDER BY pr.created_at DESC`,
    [purchaseId]
  );
  return result.rows;
}

export async function createRequest(data: {
  purchase_id: number;
  client_id: number;
  title: string;
  description?: string;
  service_id?: number;
  hours_requested?: number;
}) {
  const result = await query(
    `INSERT INTO package_requests (purchase_id, client_id, title, description, service_id, hours_requested)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      data.purchase_id,
      data.client_id,
      data.title,
      data.description || null,
      data.service_id || null,
      data.hours_requested ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateRequestStatus(
  id: number,
  status: string
) {
  const resolvedAt = ["completed", "rejected"].includes(status) ? "NOW()" : "NULL";
  const result = await query(
    `UPDATE package_requests SET status = $1, resolved_at = ${resolvedAt} WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] || null;
}

// ----- Assignments -----

export async function listAssignments(requestId: number) {
  const result = await query(
    `SELECT pa.*, m.name AS member_name
     FROM package_assignments pa
     JOIN members m ON m.id = pa.member_id
     WHERE pa.request_id = $1
     ORDER BY pa.created_at DESC`,
    [requestId]
  );
  return result.rows;
}

export async function createAssignment(data: {
  request_id: number;
  member_id: number;
  hours_assigned: number;
}) {
  const result = await query(
    `INSERT INTO package_assignments (request_id, member_id, hours_assigned)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [data.request_id, data.member_id, data.hours_assigned]
  );
  return result.rows[0];
}

export async function updateAssignmentStatus(id: number, status: string) {
  const result = await query(
    "UPDATE package_assignments SET status = $1 WHERE id = $2 RETURNING *",
    [status, id]
  );
  return result.rows[0] || null;
}

// ----- Progress Updates -----

export async function listProgressUpdates(assignmentId: number) {
  const result = await query(
    `SELECT pu.*, u.email AS author_email
     FROM package_progress_updates pu
     JOIN users u ON u.id = pu.author_id
     WHERE pu.assignment_id = $1
     ORDER BY pu.created_at DESC`,
    [assignmentId]
  );
  return result.rows;
}

export async function createProgressUpdate(data: {
  assignment_id: number;
  author_id: string;
  content: string;
  hours_logged?: number;
}) {
  const result = await query(
    `INSERT INTO package_progress_updates (assignment_id, author_id, content, hours_logged)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [data.assignment_id, data.author_id, data.content, data.hours_logged ?? null]
  );

  // Update hours_used on the purchase if hours_logged
  if (data.hours_logged) {
    await query(
      `UPDATE package_purchases pp
       SET hours_used = pp.hours_used + $1
       FROM package_assignments pa
       JOIN package_requests pr ON pr.id = pa.request_id
       WHERE pa.id = $2 AND pp.id = pr.purchase_id`,
      [data.hours_logged, data.assignment_id]
    );
  }

  return result.rows[0];
}
