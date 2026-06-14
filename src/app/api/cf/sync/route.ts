import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import {
  fetchUserInfo,
  fetchUserSubmissions,
  fetchUserRatingChanges,
  analyzeWeaknesses,
} from "@/lib/cf-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getAppSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in required before syncing Codeforces data." },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const submittedHandle =
      typeof body.handle === "string" ? body.handle.trim() : "";
    const existingProfile = await prisma.cfProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, handle: true },
    });
    const handle = submittedHandle || existingProfile?.handle || "";

    if (!handle) {
      return NextResponse.json(
        {
          error:
            "No Codeforces handle connected. Add your handle in Settings and sync again.",
        },
        { status: 400 },
      );
    }

    // Fetch CF user info
    const cfUser = await fetchUserInfo(handle);
    const conflictingProfile = await prisma.cfProfile.findFirst({
      where: {
        handle: cfUser.handle,
        NOT: { userId: session.user.id },
      },
      select: { id: true },
    });

    if (conflictingProfile) {
      return NextResponse.json(
        {
          error:
            "That Codeforces handle is already connected to another account.",
        },
        { status: 409 },
      );
    }

    // Upsert CF profile
    const profile = await prisma.cfProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        handle: cfUser.handle,
        rating: cfUser.rating ?? 0,
        maxRating: cfUser.maxRating ?? 0,
        rank: cfUser.rank ?? "newbie",
        maxRank: cfUser.maxRank ?? "newbie",
        avatar: cfUser.avatar ?? null,
        contribution: cfUser.contribution ?? 0,
        friendOfCount: cfUser.friendOfCount ?? 0,
        lastSync: new Date(),
      },
      update: {
        handle: cfUser.handle,
        rating: cfUser.rating ?? 0,
        maxRating: cfUser.maxRating ?? 0,
        rank: cfUser.rank ?? "newbie",
        maxRank: cfUser.maxRank ?? "newbie",
        avatar: cfUser.avatar ?? null,
        contribution: cfUser.contribution ?? 0,
        friendOfCount: cfUser.friendOfCount ?? 0,
        lastSync: new Date(),
      },
    });

    // Fetch submissions (last 2000)
    const submissions: any[] = [];
    for (let from = 1; from <= 2000; from += 100) {
      const batch = await fetchUserSubmissions(handle, from, 100);
      submissions.push(...batch);
      if (batch.length < 100) break;
    }

    // Store submissions
    if (submissions.length > 0) {
      await prisma.cfSubmission.deleteMany({
        where: { cfProfileId: profile.id },
      });
      await prisma.cfSubmission.createMany({
        data: submissions
          .filter((s: any) => s.problem && s.problem.index)
          .map((s: any) => ({
            cfProfileId: profile.id,
            cfSubmissionId: s.id,
            contestId: s.contestId ?? s.problem?.contestId ?? null,
            problemIndex: s.problem?.index ?? null,
            problemName: s.problem?.name ?? null,
            problemRating: s.problem?.rating ?? null,
            problemTags: JSON.stringify(s.problem?.tags ?? []),
            verdict: s.verdict ?? "UNKNOWN",
            programmingLang: s.programmingLanguage ?? "unknown",
            timeConsumed: s.timeConsumedMillis ?? 0,
            memoryConsumed: s.memoryConsumedBytes ?? 0,
            creationTime: new Date((s.creationTimeSeconds ?? 0) * 1000),
            testCount: s.passedTestCount ?? null,
          })),
      });
    }

    // Fetch rating changes
    const ratingChanges = await fetchUserRatingChanges(handle);
    if (ratingChanges.length > 0) {
      await prisma.cfContest.deleteMany({ where: { cfProfileId: profile.id } });
      await prisma.cfContest.createMany({
        data: ratingChanges.map((rc: any) => ({
          cfProfileId: profile.id,
          contestId: rc.contestId,
          contestName: rc.contestName ?? null,
          rank: rc.rank ?? null,
          oldRating: rc.oldRating ?? 0,
          newRating: rc.newRating ?? 0,
          ratingChange: rc.newRating - rc.oldRating,
          contestType: null,
          solvedCount: null,
          creationTime: new Date(),
        })),
      });
    }

    // Analyze weaknesses
    const analysis = analyzeWeaknesses(submissions as any);

    // Store tag stats
    if (analysis.tags.length > 0) {
      await prisma.cfTagStat.deleteMany({ where: { cfProfileId: profile.id } });
      await prisma.cfTagStat.createMany({
        data: analysis.tags.map((t: any) => ({
          cfProfileId: profile.id,
          tag: t.tag,
          solvedCount: Math.round(t.accuracy * t.attempted),
          attemptedCount: t.attempted,
          avgRating: t.avgRating,
          accuracy: t.accuracy,
          totalTimeMs: BigInt(0),
        })),
      });
    }

    return NextResponse.json({
      profile,
      submissionsCount: submissions.length,
      contestsCount: ratingChanges.length,
      analysis: {
        tags: analysis.tags.slice(0, 10),
        patterns: analysis.patterns,
        ratingBreakdown: analysis.ratingBreakdown,
      },
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync Codeforces data" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await getAppSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in required before deleting Codeforces data." },
        { status: 401 },
      );
    }

    const profile = await prisma.cfProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.reviewAttempt.deleteMany({
        where: { userId: session.user.id },
      });
      await tx.reviewSchedule.deleteMany({
        where: { userId: session.user.id },
      });
      await tx.dailyPlan.deleteMany({
        where: { userId: session.user.id },
      });
      await tx.journalEntry.deleteMany({
        where: { userId: session.user.id },
      });
      await tx.mistakePattern.deleteMany({
        where: { userId: session.user.id },
      });

      if (profile) {
        await tx.cfSubmission.deleteMany({
          where: { cfProfileId: profile.id },
        });
        await tx.cfContest.deleteMany({
          where: { cfProfileId: profile.id },
        });
        await tx.cfTagStat.deleteMany({
          where: { cfProfileId: profile.id },
        });
        await tx.cfProfile.delete({
          where: { id: profile.id },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete data" },
      { status: 500 },
    );
  }
}
