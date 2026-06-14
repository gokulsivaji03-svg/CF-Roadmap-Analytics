import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function applyLocalAuthOrigin(req: NextRequest) {
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const isLocalHost =
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host.startsWith("[::1]:");

  if (!isLocalHost) {
    return;
  }

  process.env.NEXTAUTH_URL = `${proto}://${host}`;
}

export async function GET(req: NextRequest, ctx: unknown) {
  applyLocalAuthOrigin(req);
  const handler = NextAuth(authOptions);
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: unknown) {
  applyLocalAuthOrigin(req);
  const handler = NextAuth(authOptions);
  return handler(req, ctx);
}
