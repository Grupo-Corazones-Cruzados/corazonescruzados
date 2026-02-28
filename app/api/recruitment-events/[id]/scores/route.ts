import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { getEventScores, createScore } from "@/lib/services/recruitment-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const data = await getEventScores(Number(id));
  return NextResponse.json({ data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.applicant_id || body.score == null) {
    return NextResponse.json(
      { error: "applicant_id and score required" },
      { status: 400 }
    );
  }

  const score = await createScore({
    event_id: Number(id),
    applicant_id: body.applicant_id,
    evaluator_id: auth.userId,
    score: body.score,
    comments: body.comments,
  });

  return NextResponse.json({ data: score }, { status: 201 });
}
