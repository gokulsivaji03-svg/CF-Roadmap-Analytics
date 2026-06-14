import Link from "next/link";
import { AuthButtons } from "@/components/auth/auth-buttons";
import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LandingPageProps = {
  searchParams?: {
    callbackUrl?: string | string[];
    error?: string | string[];
  };
};

const errorMessages: Record<string, string> = {
  AccessDenied: "Access was denied by the identity provider.",
  Callback: "The OAuth callback did not complete successfully.",
  OAuthAccountNotLinked:
    "That email is already linked to a different sign-in provider.",
  OAuthCallback: "The OAuth callback did not complete successfully.",
  OAuthCreateAccount:
    "The account could not be created from the OAuth profile.",
  OAuthSignin: "The OAuth sign-in request could not be started.",
  default: "Sign-in failed. Check your OAuth app callback URLs and try again.",
};

function getErrorMessage(error?: string | string[]) {
  if (!error) return null;

  const code = Array.isArray(error) ? error[0] : error;
  return errorMessages[code] ?? errorMessages.default;
}

function getCallbackUrl(callbackUrl?: string | string[]) {
  const value = Array.isArray(callbackUrl) ? callbackUrl[0] : callbackUrl;

  if (!value) return "/connect-handle";
  if (value.startsWith("/")) return value;

  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}${url.hash}` || "/connect-handle";
  } catch {
    return "/connect-handle";
  }
}

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const session = await getAppSession();
  const errorMessage = getErrorMessage(searchParams?.error);
  const callbackUrl = getCallbackUrl(searchParams?.callbackUrl);
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
  const githubEnabled = Boolean(
    process.env.GITHUB_ID && process.env.GITHUB_SECRET,
  );
  const canReadCfProfile = Boolean(process.env.DATABASE_URL);

  const cfProfile =
    session?.user?.id != null && canReadCfProfile
      ? await prisma.cfProfile.findUnique({
          where: { userId: session.user.id },
          select: { handle: true },
        })
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
          CF
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          CF Coach
        </h1>
        <p className="mt-3 text-gray-500 dark:text-gray-400">
          Personalized Codeforces training with weakness analysis, daily
          practice, spaced review, and handle-based progress tracking.
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {session?.user ? (
          <div className="mt-8 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm dark:border-surface-border-dark dark:bg-surface-card-dark">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Signed in as
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {session.user.name ?? session.user.email ?? "Account"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Codeforces status
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {cfProfile?.handle
                  ? `Connected: ${cfProfile.handle}`
                  : "No handle connected yet"}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="btn-primary w-full text-center"
              >
                Go to dashboard
              </Link>
              {!cfProfile?.handle ? (
                <Link
                  href="/connect-handle"
                  className="btn-secondary w-full text-center"
                >
                  Connect Codeforces handle
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <AuthButtons
            callbackUrl={callbackUrl}
            googleEnabled={googleEnabled}
            githubEnabled={githubEnabled}
          />
        )}
      </div>
    </div>
  );
}
