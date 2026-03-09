import { query } from "@/lib/db";
import type { MemberCvProfile, PortfolioItem, PortfolioItemWithMember } from "@/lib/types";

// ----- CV Profiles -----

export async function getCvProfile(memberId: number): Promise<MemberCvProfile | null> {
  const result = await query(
    "SELECT * FROM member_cv_profiles WHERE member_id = $1",
    [memberId]
  );
  return result.rows[0] || null;
}

export async function upsertCvProfile(
  memberId: number,
  data: Partial<{
    bio: string;
    skills: string[];
    education: Record<string, unknown>[];
    experience: Record<string, unknown>[];
    languages: string[];
    linkedin_url: string;
    website_url: string;
  }>
): Promise<MemberCvProfile> {
  const result = await query(
    `INSERT INTO member_cv_profiles (member_id, bio, skills, education, experience, languages, linkedin_url, website_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (member_id) DO UPDATE SET
       bio = COALESCE($2, member_cv_profiles.bio),
       skills = COALESCE($3, member_cv_profiles.skills),
       education = COALESCE($4, member_cv_profiles.education),
       experience = COALESCE($5, member_cv_profiles.experience),
       languages = COALESCE($6, member_cv_profiles.languages),
       linkedin_url = COALESCE($7, member_cv_profiles.linkedin_url),
       website_url = COALESCE($8, member_cv_profiles.website_url),
       updated_at = NOW()
     RETURNING *`,
    [
      memberId,
      data.bio ?? null,
      data.skills ?? null,
      data.education ? JSON.stringify(data.education) : null,
      data.experience ? JSON.stringify(data.experience) : null,
      data.languages ?? null,
      data.linkedin_url ?? null,
      data.website_url ?? null,
    ]
  );
  return result.rows[0];
}

// ----- Portfolio Items -----

export async function getPortfolioItems(memberId: number): Promise<PortfolioItem[]> {
  const result = await query(
    "SELECT * FROM member_portfolio_items WHERE member_id = $1 ORDER BY sort_order, id",
    [memberId]
  );
  return result.rows;
}

export async function createPortfolioItem(data: {
  member_id: number;
  title: string;
  description?: string;
  image_url?: string;
  project_url?: string;
  tags?: string[];
  cost?: number;
  item_type?: "project" | "product";
  sort_order?: number;
}): Promise<PortfolioItem> {
  const itemType = data.item_type ?? "project";
  const allowQuantities = itemType === "product";
  const result = await query(
    `INSERT INTO member_portfolio_items (member_id, title, description, image_url, project_url, tags, cost, allow_quantities, item_type, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      data.member_id,
      data.title,
      data.description || null,
      data.image_url || null,
      data.project_url || null,
      data.tags || [],
      data.cost ?? null,
      allowQuantities,
      itemType,
      data.sort_order ?? 0,
    ]
  );
  return result.rows[0];
}

export async function updatePortfolioItem(
  id: number,
  data: Partial<{
    title: string;
    description: string;
    image_url: string;
    project_url: string;
    tags: string[];
    cost: number;
    item_type: "project" | "product";
    sort_order: number;
  }>
): Promise<PortfolioItem | null> {
  // Derive allow_quantities from item_type if type is being changed
  const cleanData: Record<string, unknown> = { ...data };
  if (data.item_type) {
    cleanData.allow_quantities = data.item_type === "product";
  }

  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(cleanData)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }
  if (fields.length === 0) return null;

  vals.push(id);
  const result = await query(
    `UPDATE member_portfolio_items SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  const item = result.rows[0] || null;

  // Sync relevant fields to the linked product (if any)
  if (item) {
    await query(
      `UPDATE products SET
         name = $1, description = $2, price = COALESCE($3, 0),
         image_url = $4, allow_quantities = $5
       WHERE portfolio_item_id = $6`,
      [item.title, item.description, item.cost, item.image_url, item.allow_quantities, id]
    );
  }

  return item;
}

export async function deletePortfolioItem(id: number): Promise<boolean> {
  const result = await query("DELETE FROM member_portfolio_items WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function listAllPortfolioItems(params?: {
  search?: string;
  item_type?: "project" | "product";
}): Promise<PortfolioItemWithMember[]> {
  const conditions: string[] = ["m.is_active = true"];
  const values: unknown[] = [];
  let idx = 1;

  if (params?.item_type) {
    conditions.push(`p.item_type = $${idx++}`);
    values.push(params.item_type);
  }

  if (params?.search) {
    conditions.push(`(p.title ILIKE $${idx} OR p.tags::text ILIKE $${idx} OR m.name ILIKE $${idx})`);
    values.push(`%${params.search}%`);
    idx++;
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const result = await query(
    `SELECT p.*, m.name AS member_name, m.photo_url AS member_photo_url, pos.name AS member_position
     FROM member_portfolio_items p
     JOIN members m ON m.id = p.member_id
     LEFT JOIN positions pos ON pos.id = m.position_id
     ${where}
     ORDER BY p.created_at DESC`,
    values
  );
  return result.rows;
}

// ----- FAQ -----

export async function listFaq(publishedOnly = true) {
  const where = publishedOnly ? "WHERE is_published = true" : "";
  const result = await query(
    `SELECT * FROM faq ${where} ORDER BY sort_order, id`
  );
  return result.rows;
}

export async function createFaqItem(data: {
  question: string;
  answer: string;
  category?: string;
  sort_order?: number;
}) {
  const result = await query(
    `INSERT INTO faq (question, answer, category, sort_order)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [data.question, data.answer, data.category || null, data.sort_order ?? 0]
  );
  return result.rows[0];
}

export async function updateFaqItem(
  id: number,
  data: Partial<{ question: string; answer: string; category: string; sort_order: number; is_published: boolean }>
) {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }
  if (fields.length === 0) return null;

  vals.push(id);
  const result = await query(
    `UPDATE faq SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

export async function deleteFaqItem(id: number): Promise<boolean> {
  const result = await query("DELETE FROM faq WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
