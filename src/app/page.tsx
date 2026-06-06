"use client";

import { useSession } from "@/app/providers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Auth is auto-enabled, redirect to dashboard
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 animate-pulse">
          CF
        </div>
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
