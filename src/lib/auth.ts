import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

const providers: NextAuthOptions["providers"] = [];
const useDatabaseSessions = Boolean(process.env.DATABASE_URL);

function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

async function hasVerifiedOAuthEmail(
  provider: string,
  email: string,
  profile: Record<string, unknown> | undefined,
  accessToken: string | null | undefined,
) {
  if (provider === "google") {
    return (
      profile?.email_verified === true &&
      normalizeEmail(profile.email) === email
    );
  }

  if (provider === "github" && accessToken) {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });

    if (!res.ok) return false;

    const emails = (await res.json()) as Array<{
      email?: string;
      verified?: boolean;
      primary?: boolean;
    }>;

    return emails.some(
      (entry) =>
        normalizeEmail(entry.email) === email &&
        entry.verified === true &&
        entry.primary === true,
    );
  }

  return false;
}

async function repairOAuthAccountLink(params: {
  provider: string;
  providerAccountId: string;
  type: string;
  email: string;
  profile?: Record<string, unknown>;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  tokenType?: string | null;
  scope?: string | null;
  idToken?: string | null;
  sessionState?: string | null;
}) {
  const {
    provider,
    providerAccountId,
    type,
    email,
    profile,
    accessToken,
    refreshToken,
    expiresAt,
    tokenType,
    scope,
    idToken,
    sessionState,
  } = params;

  if (!useDatabaseSessions || !email || type !== "oauth") {
    return;
  }

  const verified = await hasVerifiedOAuthEmail(
    provider,
    email,
    profile,
    accessToken,
  );

  if (!verified) {
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!existingUser) {
    return;
  }

  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
    select: { id: true },
  });

  if (existingAccount) {
    return;
  }

  await prisma.account.create({
    data: {
      userId: existingUser.id,
      type,
      provider,
      providerAccountId,
      refresh_token: refreshToken ?? null,
      access_token: accessToken ?? null,
      expires_at: expiresAt ?? null,
      token_type: tokenType ?? null,
      scope: scope ?? null,
      id_token: idToken ?? null,
      session_state: sessionState ?? null,
    },
  });
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: useDatabaseSessions ? PrismaAdapter(prisma) : undefined,
  providers,
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: useDatabaseSessions ? "database" : "jwt",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.providerAccountId && account.type === "oauth") {
        await repairOAuthAccountLink({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          type: account.type,
          email: normalizeEmail(profile?.email),
          profile: profile as Record<string, unknown> | undefined,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          tokenType: account.token_type,
          scope: account.scope,
          idToken: account.id_token,
          sessionState:
            typeof account.session_state === "string"
              ? account.session_state
              : null,
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }

      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = user?.id ?? token.sub ?? "";
        session.user.email = user?.email ?? token.email ?? null;
        session.user.name = user?.name ?? token.name ?? null;
        session.user.image =
          user?.image ??
          (typeof token.picture === "string" ? token.picture : null);
      }

      return session;
    },
  },
};
