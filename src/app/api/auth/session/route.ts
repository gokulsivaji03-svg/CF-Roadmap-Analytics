import { NextResponse } from "next/server";

// Always returns a guest session — no auth needed
export async function GET() {
  return NextResponse.json({
    user: {
      id: "guest-user-id",
      name: "Guest",
      email: "guest@cfcoach.dev",
    },
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });
}
