import { NextResponse } from "next/server";

// This route is kept for backwards compatibility
// With the new JWT-based auth, we don't need Supabase email verification callback
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  // Redirect to dashboard - verification is now handled differently
  return NextResponse.redirect(`${origin}/dashboard`);
}
