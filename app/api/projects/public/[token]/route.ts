import { NextRequest, NextResponse } from "next/server";
import {
  getProjectByToken,
  getProjectRequirements,
  getProjectBids,
} from "@/lib/services/project-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const project = await getProjectByToken(token);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [requirements, bids] = await Promise.all([
    getProjectRequirements(project.id),
    getProjectBids(project.id),
  ]);

  return NextResponse.json({
    data: {
      ...project,
      requirements,
      bids,
    },
  });
}
