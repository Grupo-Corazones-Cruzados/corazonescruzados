import { NextResponse } from "next/server";
import { removeAuthCookie } from "@/lib/auth/jwt";

export async function POST() {
  await removeAuthCookie();
  return NextResponse.json({ message: "Sesión cerrada" });
}
