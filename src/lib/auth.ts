import { NextAuthOptions } from "next-auth";

// No-auth mode - always returns guest session
export const authOptions: NextAuthOptions = {
  providers: [],
  callbacks: {
    async session({ session }) {
      return {
        ...session,
        user: {
          id: "guest-user-id",
          name: "Guest",
          email: "guest@cfcoach.dev",
        },
        expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };
    },
  },
  session: {
    strategy: "jwt",
  },
};
