import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  normalizeJournalEntry,
  parseStringArray,
  stringifyStringArray,
} from "@/lib/serialization";
import { getAppSession } from "@/lib/session";
import { computeImportanceScore } from "@/lib/review-engine";
import { recordMistakePatterns } from "@/lib/mistake-patterns";

export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.journalEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ entries: entries.map(normalizeJournalEntry) });
}

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const mistakeCategories = Array.from(
    new Set([
      ...parseStringArray(data.mistakeCategories),
      ...(data.mistakeCategory ? [String(data.mistakeCategory)] : []),
    ]),
  );
  const profile = await prisma.cfProfile.findUnique({
    where: { userId: session.user.id },
    include: { tagStats: true },
  });
  const tagExposure = Object.fromEntries(
    (profile?.tagStats ?? []).map((tag) => [tag.tag, tag.attemptedCount]),
  );
  const entry = await prisma.journalEntry.create({
    data: {
      userId: session.user.id,
      problemId: data.problemId || null,
      cfContestId: data.cfContestId || null,
      cfProblemIndex: data.cfProblemIndex || null,
      problemName: data.problemName || null,
      problemRating: data.problemRating ? Number(data.problemRating) : null,
      problemTags: stringifyStringArray(data.problemTags),
      problemUrl: data.problemUrl || null,
      initialIdea: data.initialIdea || null,
      whatTried: data.whatTried || null,
      whereGotStuck: data.whereGotStuck || null,
      hintsUsed: data.hintsUsed || null,
      finalInsight: data.finalInsight || null,
      mistakeCategory: mistakeCategories[0] || data.mistakeCategory || null,
      mistakeCategories: stringifyStringArray(mistakeCategories),
      takeaway: data.takeaway || null,
      solvedIndependently: data.solvedIndependently || false,
      timeSpent: data.timeSpent ? Number(data.timeSpent) : null,
      confidenceLevel: data.confidenceLevel
        ? Number(data.confidenceLevel)
        : null,
      attemptCount: data.attemptCount ? Number(data.attemptCount) : 1,
    },
  });

  await recordMistakePatterns({
    userId: session.user.id,
    categories: mistakeCategories,
    example: data.problemName || null,
  });

  // If a problem was failed, create or refresh a review schedule entry
  if (!data.solvedIndependently && data.problemName) {
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 1);

    const existingReview = await prisma.reviewSchedule.findFirst({
      where: {
        userId: session.user.id,
        isCompleted: false,
        isDismissed: false,
        OR: [
          ...(data.cfContestId && data.cfProblemIndex
            ? [
                {
                  problemContestId: data.cfContestId,
                  problemIndex: data.cfProblemIndex,
                },
              ]
            : []),
          { problemName: data.problemName },
        ],
      },
    });

    const problemTags = parseStringArray(data.problemTags);
    const importanceScore = computeImportanceScore({
      problemRating: data.problemRating ? Number(data.problemRating) : null,
      problemTags,
      failureCount: existingReview?.failureCount ?? 0,
      reviewCount: existingReview?.reviewCount ?? 0,
      tagExposure,
    });

    if (existingReview) {
      await prisma.reviewSchedule.update({
        where: { id: existingReview.id },
        data: {
          journalEntryId: entry.id,
          problemId: data.problemId || null,
          problemContestId: data.cfContestId || null,
          problemIndex: data.cfProblemIndex || null,
          problemName: data.problemName,
          problemRating: data.problemRating ? Number(data.problemRating) : null,
          latestProblemRating: data.problemRating ? Number(data.problemRating) : null,
          problemTags: stringifyStringArray(problemTags),
          problemUrl: data.problemUrl || null,
          mistakeCategory: mistakeCategories[0] || null,
          mistakeCategories: stringifyStringArray(mistakeCategories),
          originalUserRating:
            existingReview.originalUserRating ?? profile?.rating ?? null,
          currentUserRatingSnapshot: profile?.rating ?? null,
          nextReviewAt: nextReview,
          nextIntervalDays: 1,
          importanceScore,
          priorityScore: importanceScore,
          reviewMode: null,
          similarProblemRecommendations: JSON.stringify([]),
        },
      });
    } else {
      await prisma.reviewSchedule.create({
        data: {
          userId: session.user.id,
          journalEntryId: entry.id,
          problemId: data.problemId || null,
          problemContestId: data.cfContestId || null,
          problemIndex: data.cfProblemIndex || null,
          problemName: data.problemName,
          problemRating: data.problemRating ? Number(data.problemRating) : null,
          latestProblemRating: data.problemRating ? Number(data.problemRating) : null,
          problemTags: stringifyStringArray(problemTags),
          problemUrl: data.problemUrl || null,
          stage: 0,
          nextReviewAt: nextReview,
          nextIntervalDays: 1,
          mistakeCategory: mistakeCategories[0] || null,
          mistakeCategories: stringifyStringArray(mistakeCategories),
          originalUserRating: profile?.rating ?? null,
          currentUserRatingSnapshot: profile?.rating ?? null,
          retentionScore: 20,
          importanceScore,
          priorityScore: importanceScore,
        },
      });
    }
  }

  return NextResponse.json({ entry: normalizeJournalEntry(entry) });
}

export async function DELETE(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.journalEntry.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
