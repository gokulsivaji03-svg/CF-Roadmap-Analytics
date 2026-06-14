import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Vercel serverless: use a pooled DATABASE_URL (e.g., Neon pooled endpoint
// or add ?pgbouncer=true&connection_limit=1 to your connection string).
// PrismaClient will create one connection per invocation, which is fine
// with Node.js runtime + connection pooling at the database level.
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
