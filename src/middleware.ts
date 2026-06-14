import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that require authentication
const PROTECTED_PATHS = [
  "/dashboard",
  "/daily-plan",
  "/journal",
  "/review",
  "/contest",
  "/weakness",
  "/roadmap",
  "/problems",
  "/settings",
  "/connect-handle",
  "/api/cf/sync",
  "/api/cf/analysis",
  "/api/daily-plan",
  "/api/journal",
  "/api/review",
  "/api/contest",
  "/api/roadmap",
];

// Paths that must never be blocked
const PUBLIC_PATH_PREFIXES = [
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/guest",
  // Guest mode needs public CF problem browse and Jiangly lookup
  "/api/cf/problems",
  "/api/cf/jiangly",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

function isPublic(pathname: string): boolean {
  // Root landing page is always public
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never block public or static paths
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Only protect configured paths — everything else passes through
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  // NEXTAUTH_SECRET is required for getToken to work.
  if (!process.env.NEXTAUTH_SECRET) {
    console.warn(
      "[CF Coach] NEXTAUTH_SECRET is missing. Auth middleware cannot verify sessions.",
    );
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Redirect unauthenticated users to the landing page with a callback
  if (!token) {
    const signInUrl = new URL("/", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // After sign-in, if user is on /connect-handle, let them through.
  // Other protected pages: the page component itself handles the
  // connect-handle CTA if no CF profile is linked.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - static files (/_next/static, /favicon.ico, etc.)
     * - public images
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
};
