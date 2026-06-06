"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";
import { createContext, useContext } from "react";
import { defaultSession } from "@/lib/session";

// Simple session context - no auth needed
interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface Session {
  user: SessionUser;
  expires: string;
}

const SessionContext = createContext<{ data: Session; status: string }>({
  data: defaultSession,
  status: "authenticated",
});

export function useSession() {
  return useContext(SessionContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SessionContext.Provider
      value={{ data: defaultSession, status: "authenticated" }}
    >
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
    </SessionContext.Provider>
  );
}
