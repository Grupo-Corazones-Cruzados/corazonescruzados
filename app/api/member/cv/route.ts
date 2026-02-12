import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// Helper to get member info for current user
async function getMemberInfo(userId: string) {
  const result = await query(
    `SELECT up.id_miembro, m.id, m.cv_profile
     FROM user_profiles up
     JOIN miembros m ON up.id_miembro = m.id
     WHERE up.id = $1 AND up.rol IN ('miembro', 'admin')`,
    [userId]
  );
  return result.rows[0] || null;
}

// GET /api/member/cv - Load CV for the authenticated member
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const memberInfo = await getMemberInfo(tokenData.userId);
    if (!memberInfo) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    // If the member has a cv_profile UUID, load it
    if (memberInfo.cv_profile) {
      const cvResult = await query(
        `SELECT * FROM cv_profile WHERE id = $1`,
        [memberInfo.cv_profile]
      );
      return NextResponse.json({ cv: cvResult.rows[0] || null });
    }

    return NextResponse.json({ cv: null });
  } catch (error) {
    console.error("Error fetching CV:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Error al cargar el CV", details: msg }, { status: 500 });
  }
}

// PUT /api/member/cv - Save/create CV (upsert)
export async function PUT(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const memberInfo = await getMemberInfo(tokenData.userId);
    if (!memberInfo) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    const body = await request.json();
    const {
      full_name, headline, summary, location, phone, email,
      website, linkedin, github,
      skills, languages, certifications, experience, education,
    } = body;

    const params = [
      full_name || null,
      headline || null,
      summary || null,
      location || null,
      phone || null,
      email || null,
      website || null,
      linkedin || null,
      github || null,
      JSON.stringify(skills || []),
      JSON.stringify(languages || []),
      JSON.stringify(certifications || []),
      JSON.stringify(experience || []),
      JSON.stringify(education || []),
    ];

    let cvRow;

    if (!memberInfo.cv_profile) {
      // INSERT new cv_profile and link it to the member (atomic)
      cvRow = await transaction(async (client) => {
        const insertResult = await client.query(
          `INSERT INTO cv_profile (
            full_name, headline, summary, location, phone, email,
            website, linkedin, github,
            skills, languages, certifications, experience, education
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          RETURNING *`,
          params
        );
        const newCv = insertResult.rows[0];

        await client.query(
          `UPDATE miembros SET cv_profile = $1 WHERE id = $2`,
          [newCv.id, memberInfo.id]
        );

        return newCv;
      });
    } else {
      // UPDATE existing cv_profile
      const updateResult = await query(
        `UPDATE cv_profile SET
          full_name = $1, headline = $2, summary = $3, location = $4,
          phone = $5, email = $6, website = $7, linkedin = $8, github = $9,
          skills = $10, languages = $11, certifications = $12,
          experience = $13, education = $14
        WHERE id = $15
        RETURNING *`,
        [...params, memberInfo.cv_profile]
      );
      cvRow = updateResult.rows[0];
    }

    return NextResponse.json({ cv: cvRow });
  } catch (error) {
    console.error("Error saving CV:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Error al guardar el CV", details: msg }, { status: 500 });
  }
}
