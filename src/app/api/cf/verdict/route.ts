import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchUserSubmissions } from "@/lib/cf-api";
import { getCodeforcesSubmissionHref } from "@/lib/problem-links";
import { getAppSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeProblemIndex(index: string) {
  return index.trim().toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAppSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in required to sync verdict." },
        { status: 401 },
      );
    }

    const contestId = Number(req.nextUrl.searchParams.get("contestId"));
    const rawIndex = req.nextUrl.searchParams.get("index") ?? "";
    const index = normalizeProblemIndex(rawIndex);

    if (!Number.isFinite(contestId) || !index) {
      return NextResponse.json(
        { error: "contestId and index are required." },
        { status: 400 },
      );
    }

    const profile = await prisma.cfProfile.findUnique({
      where: { userId: session.user.id },
      select: { handle: true },
    });

    if (!profile?.handle) {
      return NextResponse.json(
        { error: "Connect your Codeforces handle to sync verdict." },
        { status: 400 },
      );
    }

    const submissions = await fetchUserSubmissions(profile.handle, 1, 100);
    const match = submissions.find(
      (submission) =>
        submission.problem?.contestId === contestId &&
        normalizeProblemIndex(submission.problem?.index ?? "") === index,
    );

    if (!match) {
      return NextResponse.json({
        submission: null,
        message:
          "No recent submission found yet. Submit on Codeforces, then sync again.",
      });
    }

    return NextResponse.json({
      submission: {
        id: match.id,
        verdict: match.verdict ?? "UNKNOWN",
        programmingLanguage: match.programmingLanguage ?? "Unknown",
        creationTimeSeconds: match.creationTimeSeconds ?? null,
        passedTestCount: match.passedTestCount ?? null,
        url: getCodeforcesSubmissionHref(contestId, match.id),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to sync verdict." },
      { status: 500 },
    );
  }
}
