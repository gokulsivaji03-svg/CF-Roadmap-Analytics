import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NextAuth v4 App Router pattern: create the handler once, export both methods.
// NEXTAUTH_URL must match the actual origin (set in .env for production,
// or use --port/-p flag locally to control the dev server port).
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
