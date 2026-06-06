import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  normalizeReviewAttempt,
  normalizeReviewItem,
  parseJsonValue,
  parseStringArray,
  stringifyStringArray,
} from "@/lib/serialization";
import { getAppSession } from "@/lib/session";
import {
  computeAdaptiveReviewUpdate,
  computeImportanceScore,
  computePriorityScore,
  computeRetentionScore,
  getSimilarProblemRecommendations,
  REVIEW_MODE_CONFIG,
  REVIEW_MODE_OPTIONS,
  REVIEW_STAGE_INTERVALS,
} from "@/lib/review-engine";
import {
  getMistakeCategoryOptions,
  getReviewModeOptions,
} from "@/lib/utils";
import { recordMistakePatterns } from "@/lib/mistake-patterns";

function roundTo100(value: number) {
  return Math.round(value / 100) * 100;
}

function mapLegacyReviewMode(success?: boolean): string {
  return success ? "Solved With Effort" : "Still Stuck";
}

function getProblemKey(review: {
  problemContestId: number | null;
  problemIndex: string | null;
  problemName: string | null;
}) {
  if (review.problemContestId != null && review.problemIndex) {
    return `${review.problemContestId}-${review.problemIndex}`;
  }

  return review.problemName ?? "unknown";
}

export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const [profile, reviews, patterns, journals] = await Promise.all([
    prisma.cfProfile.findUnique({
      where: { userId: session.user.id },
      include: { tagStats: true },
    }),
    prisma.reviewSchedule.findMany({
      where: { userId: session.user.id },
      include: {
        attempts: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mistakePattern.findMany({
      where: { userId: session.user.id },
      orderBy: { count: "desc" },
    }),
    prisma.journalEntry.findMany({
      where: { userId: session.user.id },
      select: {
        solvedIndependently: true,
        mistakeCategory: true,
        mistakeCategories: true,
      },
    }),
  ]);

  const currentUserRating = profile?.rating ?? 0;
  const tagExposure = Object.fromEntries(
    (profile?.tagStats ?? []).map((tag) => [tag.tag, tag.attemptedCount]),
  );

  const updates: Promise<unknown>[] = [];
  const normalizedReviews = reviews.map((review) => {
    const normalizedBase = normalizeReviewItem(review);
    const normalized = {
      ...normalizedBase,
      problemTags: parseStringArray(review.problemTags),
      mistakeCategories: parseStringArray(review.mistakeCategories),
      similarProblemRecommendations: parseJsonValue<
        Array<{
          type: "easier" | "equal";
          contestId: number;
          index: string;
          name: string;
          rating: number;
          tags: string[];
          cfUrl: string;
        }>
      >(review.similarProblemRecommendations, []),
    };
    const attempts = review.attempts.map(normalizeReviewAttempt);
    const importanceScore = computeImportanceScore({
      problemRating: review.problemRating,
      problemTags: normalized.problemTags,
      failureCount: review.failureCount,
      reviewCount: review.reviewCount,
      tagExposure,
    });
    const overdueDays =
      !review.isCompleted && !review.isDismissed && review.nextReviewAt < now
        ? Math.floor(
            (now.getTime() - review.nextReviewAt.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;
    const priorityScore = computePriorityScore({
      overdueDays,
      failureCount: review.failureCount,
      importanceScore,
      neededEditorialCount: review.neededEditorialCount,
      stillStuckCount: review.stillStuckCount,
    });
    const retentionScore = computeRetentionScore({
      successCount: review.successCount,
      reviewCount: review.reviewCount,
      completed: review.isCompleted,
      lastReviewedAt: review.lastReviewedAt,
      nextReviewAt: review.nextReviewAt,
    });

    if (
      review.importanceScore !== importanceScore ||
      review.priorityScore !== priorityScore ||
      review.retentionScore !== retentionScore ||
      review.currentUserRatingSnapshot !== currentUserRating
    ) {
      updates.push(
        prisma.reviewSchedule.update({
          where: { id: review.id },
          data: {
            importanceScore,
            priorityScore,
            retentionScore,
            currentUserRatingSnapshot: currentUserRating,
            latestProblemRating: review.problemRating,
          },
        }),
      );
    }

    return {
      ...normalized,
      attempts,
      importanceScore,
      priorityScore,
      retentionScore,
      overdueDays,
      currentUserRating,
      ratingDeltaFromOriginal:
        currentUserRating - (review.originalUserRating ?? currentUserRating),
      ratingReadinessMessage:
        review.problemRating != null && review.originalUserRating != null
          ? `You failed this ${review.problemRating}-rated problem when you were ${review.originalUserRating}. You are now ${currentUserRating}. ${
              currentUserRating >= review.problemRating
                ? "This should now be solvable."
                : "This is still above your current level."
            }`
          : null,
      similarProblemRecommendations: normalized.similarProblemRecommendations,
    };
  });

  await Promise.all(updates);

  const due = normalizedReviews
    .filter(
      (review) =>
        !review.isCompleted && !review.isDismissed && review.nextReviewAt <= now,
    )
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return (
        new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
      );
    });

  const activeReviews = normalizedReviews.filter((review) => !review.isDismissed);
  const allAttempts = activeReviews.flatMap((review) => review.attempts);
  const completedReviews = activeReviews.filter((review) => review.isCompleted);

  const tagFailureMap = new Map<string, number>();
  const tagStrengthMap = new Map<string, number>();
  const weakTagSource = new Map<string, { failures: number; strengths: number }>();
  for (const review of activeReviews) {
    for (const tag of review.problemTags) {
      const stats = weakTagSource.get(tag) || { failures: 0, strengths: 0 };
      stats.failures += review.failureCount + review.stillStuckCount;
      stats.strengths += review.solvedEasilyCount + review.solvedWithEffortCount;
      weakTagSource.set(tag, stats);
      tagFailureMap.set(tag, stats.failures);
      tagStrengthMap.set(tag, stats.strengths);
    }
  }

  const weakestTags = Array.from(tagFailureMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  const strongestTags = Array.from(tagStrengthMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const aggregatedMistakes = new Map<string, { count: number; examples: string[] }>();
  for (const pattern of patterns) {
    aggregatedMistakes.set(pattern.pattern, {
      count: pattern.count,
      examples: parseStringArray(pattern.examples),
    });
  }
  for (const attempt of allAttempts) {
    for (const category of attempt.mistakeCategories) {
      const existing = aggregatedMistakes.get(category) || { count: 0, examples: [] };
      existing.count += 1;
      aggregatedMistakes.set(category, existing);
    }
  }
  for (const journal of journals) {
    const categories = [
      ...parseStringArray(journal.mistakeCategories),
      ...(journal.mistakeCategory ? [journal.mistakeCategory] : []),
    ];
    for (const category of categories) {
      const existing = aggregatedMistakes.get(category) || { count: 0, examples: [] };
      existing.count += 1;
      aggregatedMistakes.set(category, existing);
    }
  }

  const aggregatedPatterns = Array.from(aggregatedMistakes.entries())
    .map(([pattern, value], index) => ({
      id: `pattern-${index}`,
      pattern,
      count: value.count,
      examples: value.examples,
    }))
    .sort((a, b) => b.count - a.count);

  const reviewSuccessRate =
    allAttempts.length > 0
      ? allAttempts.filter((attempt) => attempt.wasSuccessful).length /
        allAttempts.length
      : 0;
  const reviewCompletionRate =
    activeReviews.length > 0 ? completedReviews.length / activeReviews.length : 0;
  const editorialDependencyRate =
    allAttempts.length > 0
      ? allAttempts.filter((attempt) => attempt.outcome === "Needed Editorial")
          .length / allAttempts.length
      : 0;
  const independentSolveRate =
    journals.length > 0
      ? journals.filter((journal) => journal.solvedIndependently).length /
        journals.length
      : 0;
  const averageReviewsBeforeMastery =
    completedReviews.length > 0
      ? completedReviews.reduce((sum, review) => sum + review.reviewCount, 0) /
        completedReviews.length
      : 0;
  const retentionScore =
    activeReviews.length > 0
      ? Math.round(
          activeReviews.reduce((sum, review) => sum + review.retentionScore, 0) /
            activeReviews.length,
        )
      : 0;

  const needsWorkTags = weakestTags.slice(0, 3).map((tag) => tag.tag);
  const readinessBoost =
    retentionScore >= 80 && reviewSuccessRate >= 0.8
      ? 200
      : retentionScore >= 65 && reviewSuccessRate >= 0.65
        ? 100
        : 0;
  const readyFor = roundTo100(Math.max(800, currentUserRating + readinessBoost));

  return NextResponse.json({
    due,
    all: normalizedReviews,
    patterns: aggregatedPatterns,
    dashboard: {
      currentUserRating,
      retentionScore,
      problemsReviewed: activeReviews.length,
      reviewSuccessRate,
      reviewCompletionRate,
      editorialDependencyRate,
      independentSolveRate,
      averageReviewsBeforeMastery,
      mostCommonMistake: aggregatedPatterns[0]?.pattern ?? null,
      weakestTags,
      strongestTags,
      estimatedRatingReadiness: {
        readyFor,
        needsWork: needsWorkTags,
      },
      queueSummary: {
        dueCount: due.length,
        overdueCount: due.filter((review) => review.overdueDays > 0).length,
        masteredCount: completedReviews.length,
      },
    },
    analytics: {
      topFailureTags: weakestTags,
      mostRepeatedMistakes: aggregatedPatterns.slice(0, 6),
      averageReviewsBeforeMastery,
      editorialDependencyRate,
      independentSolveRate,
      ratingGrowthPrediction: {
        currentRating: currentUserRating,
        readyFor,
      },
    },
    taxonomy: {
      mistakeCategories: getMistakeCategoryOptions(),
      reviewModes: getReviewModeOptions(),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();
  const reviewId = data.reviewId as string | undefined;
  const reviewMode = (data.reviewMode ||
    mapLegacyReviewMode(data.success as boolean | undefined)) as keyof typeof REVIEW_MODE_CONFIG;
  const mistakeCategories = parseStringArray(data.mistakeCategories);
  const notes =
    typeof data.notes === "string" && data.notes.trim().length > 0
      ? data.notes.trim()
      : null;
  const confidence =
    typeof data.confidence === "number" ? data.confidence : null;

  if (!reviewId) {
    return NextResponse.json({ error: "Review ID is required" }, { status: 400 });
  }

  if (!REVIEW_MODE_OPTIONS.includes(reviewMode)) {
    return NextResponse.json({ error: "Invalid review mode" }, { status: 400 });
  }

  const [review, profile] = await Promise.all([
    prisma.reviewSchedule.findFirst({
      where: { id: reviewId, userId: session.user.id },
    }),
    prisma.cfProfile.findUnique({
      where: { userId: session.user.id },
      include: { tagStats: true },
    }),
  ]);

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const currentUserRating = profile?.rating ?? 0;
  const tagExposure = Object.fromEntries(
    (profile?.tagStats ?? []).map((tag) => [tag.tag, tag.attemptedCount]),
  );
  const normalizedTags = parseStringArray(review.problemTags);
  const mergedMistakeCategories = Array.from(
    new Set([
      ...parseStringArray(review.mistakeCategories),
      ...mistakeCategories,
      ...(review.mistakeCategory ? [review.mistakeCategory] : []),
    ]),
  );
  const importanceScore = computeImportanceScore({
    problemRating: review.problemRating,
    problemTags: normalizedTags,
    failureCount:
      review.failureCount +
      (REVIEW_MODE_CONFIG[reviewMode].isSuccess ? 0 : 1),
    reviewCount: review.reviewCount + 1,
    tagExposure,
  });
  const adaptive = computeAdaptiveReviewUpdate(
    {
      stage: review.stage,
      failureCount: review.failureCount,
      successCount: review.successCount,
      reviewCount: review.reviewCount,
      problemRating: review.problemRating,
      originalUserRating: review.originalUserRating,
      importanceScore: review.importanceScore,
      retentionScore: review.retentionScore,
    },
    currentUserRating,
    reviewMode,
  );
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + adaptive.nextIntervalDays);
  const overdueDays =
    review.nextReviewAt < new Date()
      ? Math.floor(
          (Date.now() - review.nextReviewAt.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;
  const priorityScore = adaptive.isCompleted
    ? 0
    : computePriorityScore({
        overdueDays,
        failureCount:
          review.failureCount +
          (REVIEW_MODE_CONFIG[reviewMode].isSuccess ? 0 : 1),
        importanceScore,
        neededEditorialCount:
          review.neededEditorialCount +
          (reviewMode === "Needed Editorial" ? 1 : 0),
        stillStuckCount:
          review.stillStuckCount + (reviewMode === "Still Stuck" ? 1 : 0),
      });

  const recommendations =
    reviewMode === "Still Stuck" ||
    reviewMode === "Needed Editorial" ||
    reviewMode === "Needed Hint"
      ? await getSimilarProblemRecommendations({
          problemRating: review.problemRating,
          problemTags: normalizedTags,
        })
      : [];

  await prisma.reviewSchedule.update({
    where: { id: review.id },
    data: {
      stage: adaptive.nextStage,
      nextReviewAt,
      nextIntervalDays: adaptive.nextIntervalDays,
      lastReviewedAt: new Date(),
      reviewCount: { increment: 1 },
      successCount: REVIEW_MODE_CONFIG[reviewMode].isSuccess
        ? { increment: 1 }
        : undefined,
      failureCount: !REVIEW_MODE_CONFIG[reviewMode].isSuccess
        ? { increment: 1 }
        : undefined,
      solvedEasilyCount:
        reviewMode === "Solved Easily" ? { increment: 1 } : undefined,
      solvedWithEffortCount:
        reviewMode === "Solved With Effort" ? { increment: 1 } : undefined,
      neededHintCount:
        reviewMode === "Needed Hint" ? { increment: 1 } : undefined,
      neededEditorialCount:
        reviewMode === "Needed Editorial" ? { increment: 1 } : undefined,
      stillStuckCount:
        reviewMode === "Still Stuck" ? { increment: 1 } : undefined,
      overdueCount: overdueDays > 0 ? { increment: 1 } : undefined,
      maxStageReached: Math.max(review.maxStageReached, adaptive.nextStage),
      retentionScore: adaptive.retentionScore,
      importanceScore,
      priorityScore,
      currentUserRatingSnapshot: currentUserRating,
      latestProblemRating: review.problemRating,
      reviewMode,
      mistakeCategories: stringifyStringArray(mergedMistakeCategories),
      similarProblemRecommendations: JSON.stringify(recommendations),
      isCompleted: adaptive.isCompleted,
      masteredAt: adaptive.isCompleted ? new Date() : null,
      isDismissed: false,
      dismissedAt: null,
    },
  });

  await prisma.reviewAttempt.create({
    data: {
      reviewScheduleId: review.id,
      userId: session.user.id,
      outcome: reviewMode,
      confidence,
      userRatingSnapshot: currentUserRating,
      scheduledStage: review.stage,
      resultingStage: adaptive.nextStage,
      wasSuccessful: REVIEW_MODE_CONFIG[reviewMode].isSuccess,
      intervalDays: adaptive.nextIntervalDays,
      retentionScoreAfter: adaptive.retentionScore,
      priorityScoreAfter: priorityScore,
      mistakeCategories: stringifyStringArray(mergedMistakeCategories),
      notes,
    },
  });

  await recordMistakePatterns({
    userId: session.user.id,
    categories: mergedMistakeCategories,
    example: review.problemName,
  });

  return NextResponse.json({
    success: true,
    recommendations,
    nextReviewAt,
    nextIntervalDays: adaptive.nextIntervalDays,
    isCompleted: adaptive.isCompleted,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.reviewSchedule.updateMany({
    where: { id, userId: session.user.id },
    data: {
      isDismissed: true,
      dismissedAt: new Date(),
      priorityScore: 0,
    },
  });

  return NextResponse.json({ success: true });
}
