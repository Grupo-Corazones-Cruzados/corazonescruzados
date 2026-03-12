import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { updateRequirement } from "@/lib/services/project-service";
import { generateRequirementDetails } from "@/lib/integrations/openai";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  await params; // consume params

  const body = await req.json();
  const { requirement_id, raw_text } = body;

  if (!requirement_id || !raw_text) {
    return NextResponse.json(
      { error: "requirement_id and raw_text are required" },
      { status: 400 }
    );
  }

  try {
    const { title, description } = await generateRequirementDetails(raw_text);

    const updated = await updateRequirement(requirement_id, { title, description });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { error: "Error al generar con IA" },
      { status: 500 }
    );
  }
}
