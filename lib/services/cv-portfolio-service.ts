import { query } from "@/lib/db";
import type { MemberCvProfile, PortfolioItem } from "@/lib/types";

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
  sort_order?: number;
}): Promise<PortfolioItem> {
  const result = await query(
    `INSERT INTO member_portfolio_items (member_id, title, description, image_url, project_url, tags, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      data.member_id,
      data.title,
      data.description || null,
      data.image_url || null,
      data.project_url || null,
      data.tags || [],
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
    sort_order: number;
  }>
): Promise<PortfolioItem | null> {
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
    `UPDATE member_portfolio_items SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

export async function deletePortfolioItem(id: number): Promise<boolean> {
  const result = await query("DELETE FROM member_portfolio_items WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
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
