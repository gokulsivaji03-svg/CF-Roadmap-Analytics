"use client";

import { signIn, useSession } from "@/app/providers";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Code, Loader2, Search } from "lucide-react";

export default function ConnectHandlePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [validating, setValidating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Redirect unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/?callbackUrl=/connect-handle");
    }
  }, [router, status]);

  // Check if already connected
  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    async function checkExisting() {
      try {
        const res = await fetch("/api/cf/analysis");
        if (res.ok && !cancelled) {
          // Already connected — go to dashboard
          router.replace("/dashboard");
        }
      } catch {
        // Not connected yet — stay here
      }
    }
    void checkExisting();
    return () => {
      cancelled = true;
    };
  }, [router, status]);

  async function handleValidate() {
    const trimmed = handle.trim();
    if (!trimmed) {
      toast.error("Enter a Codeforces handle");
      return;
    }

    setValidating(true);
    try {
      const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      if (json.status !== "OK") {
        toast.error("Handle not found on Codeforces. Check the spelling.");
        return;
      }
      toast.success(`Handle "${trimmed}" found on Codeforces.`);
      await handleSync(trimmed);
    } catch {
      toast.error("Could not validate handle. Check your connection.");
    } finally {
      setValidating(false);
    }
  }

  async function handleSync(cfHandle: string) {
    setSyncing(true);
    try {
      const res = await fetch("/api/cf/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cfHandle }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sync failed");
        return;
      }
      toast.success("Codeforces profile synced!");
      router.replace("/dashboard");
    } catch {
      toast.error("Sync failed. Try again from Settings.");
    } finally {
      setSyncing(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <button
          type="button"
          onClick={() => signIn(undefined, { callbackUrl: "/connect-handle" })}
          className="btn-primary"
        >
          Sign in to continue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-12 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
          <Code className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Connect your Codeforces handle
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter your Codeforces handle so CF Coach can analyze your strengths,
          track progress, and generate personalized practice plans.
        </p>
      </div>

      <div className="card p-6">
        <label
          htmlFor="cf-handle"
          className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
        >
          Codeforces handle
        </label>
        <div className="flex gap-2">
          <input
            id="cf-handle"
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleValidate();
            }}
            placeholder="e.g. tourist"
            className="input flex-1"
            autoFocus
            disabled={validating || syncing}
          />
          <button
            type="button"
            onClick={handleValidate}
            disabled={!handle.trim() || validating || syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking
              </>
            ) : syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Connect
              </>
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Your handle will be verified against the public Codeforces API before
          syncing.
        </p>
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        You can change your handle later in{" "}
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="text-blue-600 hover:underline"
        >
          Settings
        </button>
        .
      </p>
    </div>
  );
}
