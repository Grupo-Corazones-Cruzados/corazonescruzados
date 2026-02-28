import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listFaq, createFaqItem, updateFaqItem, deleteFaqItem } from "@/lib/services/cv-portfolio-service";

export async function GET(req: NextRequest) {
  const publishedOnly = req.nextUrl.searchParams.get("all") !== "true";
  const data = await listFaq(publishedOnly);
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.question || !body.answer) {
    return NextResponse.json({ error: "question and answer required" }, { status: 400 });
  }

  const item = await createFaqItem(body);
  return NextResponse.json({ data: item }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { id, ...data } = body;
  const item = await updateFaqItem(id, data);
  return NextResponse.json({ data: item });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await deleteFaqItem(body.id);
  return NextResponse.json({ message: "Deleted" });
}
