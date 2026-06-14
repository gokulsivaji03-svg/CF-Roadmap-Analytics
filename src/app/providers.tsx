"use client";

import type { Session } from "next-auth";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";

export { signIn, signOut, useSession };

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        {mounted && (
          <Toaster
            position="top-right"
            toastOptions={{
              className: "dark:bg-surface-card-dark dark:text-gray-100",
              duration: 3000,
            }}
          />
        )}
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
