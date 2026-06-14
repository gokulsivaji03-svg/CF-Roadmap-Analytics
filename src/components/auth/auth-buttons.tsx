"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";

type AuthButtonsProps = {
  callbackUrl?: string;
  googleEnabled: boolean;
  githubEnabled: boolean;
};

export function AuthButtons({
  callbackUrl = "/connect-handle",
  googleEnabled,
  githubEnabled,
}: AuthButtonsProps) {
  return (
    <div className="mt-8 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        disabled={!googleEnabled}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        Sign in with Google
      </button>
      <button
        type="button"
        onClick={() => signIn("github", { callbackUrl })}
        disabled={!githubEnabled}
        className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        Sign in with GitHub
      </button>
      {!googleEnabled && !githubEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Sign-in is not configured. Add{" "}
          <code className="text-xs">GOOGLE_CLIENT_ID</code> /{" "}
          <code className="text-xs">GOOGLE_CLIENT_SECRET</code> and/or{" "}
          <code className="text-xs">GITHUB_ID</code> /{" "}
          <code className="text-xs">GITHUB_SECRET</code> to your environment
          variables.
        </div>
      ) : !googleEnabled || !githubEnabled ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure the missing OAuth env vars to enable every provider locally.
        </p>
      ) : null}
      <Link href="/guest" className="text-sm text-blue-600 hover:underline">
        Continue as guest
      </Link>
    </div>
  );
}
