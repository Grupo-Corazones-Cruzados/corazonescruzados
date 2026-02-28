import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getScheduleExceptions,
  createScheduleException,
  deleteScheduleException,
} from "@/lib/services/member-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const url = req.nextUrl.searchParams;
  const exceptions = await getScheduleExceptions(
    Number(id),
    url.get("from") || undefined,
    url.get("to") || undefined
  );
  return NextResponse.json({ data: exceptions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.date || !body.type) {
    return NextResponse.json(
      { error: "date and type are required" },
      { status: 400 }
    );
  }

  const exception = await createScheduleException({
    member_id: Number(id),
    ...body,
  });

  return NextResponse.json({ data: exception }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const url = req.nextUrl.searchParams;
  const exceptionId = url.get("exception_id");

  if (!exceptionId) {
    return NextResponse.json(
      { error: "exception_id is required" },
      { status: 400 }
    );
  }

  const deleted = await deleteScheduleException(
    Number(exceptionId),
    Number(id)
  );

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
