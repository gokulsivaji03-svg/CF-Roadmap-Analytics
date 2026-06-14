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
      {!googleEnabled || !githubEnabled ? (
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
