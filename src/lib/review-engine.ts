import { fetchProblemsFromCF } from "@/lib/cf-api";

export const REVIEW_MODE_CONFIG = {
  "Solved Easily": {
    key: "Solved Easily",
    isSuccess: true,
    stageDelta: 2,
    intervalMultiplier: 1.45,
    retentionDelta: 18,
  },
  "Solved With Effort": {
    key: "Solved With Effort",
    isSuccess: true,
    stageDelta: 1,
    intervalMultiplier: 1,
    retentionDelta: 10,
  },
  "Needed Hint": {
    key: "Needed Hint",
    isSuccess: true,
    stageDelta: 1,
    intervalMultiplier: 0.7,
    retentionDelta: 4,
  },
  "Needed Editorial": {
    key: "Needed Editorial",
    isSuccess: false,
    stageDelta: 0,
    intervalMultiplier: 0.55,
    retentionDelta: -5,
  },
  "Still Stuck": {
    key: "Still Stuck",
    isSuccess: false,
    stageDelta: -99,
    intervalMultiplier: 0.4,
    retentionDelta: -12,
  },
} as const;

export const REVIEW_MODE_OPTIONS = Object.keys(REVIEW_MODE_CONFIG);
export const REVIEW_STAGE_INTERVALS = [1, 3, 7, 21];

type ReviewMode = keyof typeof REVIEW_MODE_CONFIG;

export interface ReviewComputationInput {
  stage: number;
  failureCount: number;
  successCount: number;
  reviewCount: number;
  problemRating: number | null;
  originalUserRating: number | null;
  importanceScore: number;
  retentionScore: number;
}

export interface AdaptiveReviewUpdate {
  nextStage: number;
  nextIntervalDays: number;
  isCompleted: boolean;
  retentionScore: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeAdaptiveReviewUpdate(
  review: ReviewComputationInput,
  currentUserRating: number,
  reviewMode: ReviewMode,
): AdaptiveReviewUpdate {
  const mode = REVIEW_MODE_CONFIG[reviewMode];
  let nextStage =
    reviewMode === "Still Stuck"
      ? 0
      : clamp(review.stage + mode.stageDelta, 0, REVIEW_STAGE_INTERVALS.length);

  if (reviewMode === "Needed Editorial") {
    nextStage = Math.max(0, review.stage);
  }

  const isCompleted = nextStage >= REVIEW_STAGE_INTERVALS.length;
  const baseStageIndex = clamp(
    isCompleted ? REVIEW_STAGE_INTERVALS.length - 1 : nextStage,
    0,
    REVIEW_STAGE_INTERVALS.length - 1,
  );
  let nextIntervalDays = REVIEW_STAGE_INTERVALS[baseStageIndex];

  const ratingGap = currentUserRating - (review.originalUserRating ?? currentUserRating);
  const difficultyGap =
    (review.problemRating ?? currentUserRating) - currentUserRating;

  nextIntervalDays *= mode.intervalMultiplier;

  if (difficultyGap >= 150) nextIntervalDays *= 0.8;
  if (difficultyGap <= -150) nextIntervalDays *= 1.2;
  if (ratingGap >= 200) nextIntervalDays *= 1.15;
  if (review.failureCount >= 3) nextIntervalDays *= 0.85;
  if (reviewMode === "Solved Easily" && ratingGap >= 250) nextIntervalDays *= 1.15;
  if (reviewMode === "Needed Hint") nextIntervalDays = Math.min(nextIntervalDays, 5);
  if (reviewMode === "Needed Editorial") nextIntervalDays = Math.min(nextIntervalDays, 3);
  if (reviewMode === "Still Stuck") nextIntervalDays = 1;

  if (isCompleted) {
    nextIntervalDays = Math.max(21, Math.round(nextIntervalDays));
  }

  const retentionScore = clamp(
    review.retentionScore +
      mode.retentionDelta +
      review.successCount * 0.8 -
      review.failureCount * 0.7 +
      Math.max(0, ratingGap / 50) * 0.8,
    0,
    100,
  );

  return {
    nextStage,
    nextIntervalDays: clamp(Math.round(nextIntervalDays), 1, 90),
    isCompleted,
    retentionScore,
  };
}

export interface ImportanceInput {
  problemRating: number | null;
  problemTags: string[];
  failureCount: number;
  reviewCount: number;
  tagExposure: Record<string, number>;
}

export function computeImportanceScore(input: ImportanceInput): number {
  const ratingScore = (input.problemRating ?? 800) / 120;
  const rarityScore =
    input.problemTags.length > 0
      ? input.problemTags.reduce((sum, tag) => {
          const exposure = input.tagExposure[tag] ?? 0;
          return sum + 12 / Math.max(4, exposure + 4);
        }, 0) / input.problemTags.length
      : 0;
  const failureScore = input.failureCount * 4;
  const repeatedReviewScore = input.reviewCount * 1.5;

  return Number((ratingScore + rarityScore + failureScore + repeatedReviewScore).toFixed(2));
}

export function computePriorityScore(input: {
  overdueDays: number;
  failureCount: number;
  importanceScore: number;
  neededEditorialCount: number;
  stillStuckCount: number;
}): number {
  return Number(
    (
      input.overdueDays * 3 +
      input.failureCount * 4 +
      input.importanceScore * 1.5 +
      input.neededEditorialCount * 2 +
      input.stillStuckCount * 3
    ).toFixed(2),
  );
}

export function computeRetentionScore(input: {
  successCount: number;
  reviewCount: number;
  completed: boolean;
  lastReviewedAt?: Date | null;
  nextReviewAt?: Date | null;
}): number {
  if (input.reviewCount === 0) return 0;

  const successRate = input.successCount / input.reviewCount;
  const daysSinceReview = input.lastReviewedAt
    ? Math.max(
        0,
        (Date.now() - input.lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;
  const scheduleHealth = input.nextReviewAt
    ? Math.max(
        0,
        1 -
          Math.max(
            0,
            (Date.now() - input.nextReviewAt.getTime()) /
              (1000 * 60 * 60 * 24 * 14),
          ),
      )
    : 0.5;

  return clamp(
    Math.round(successRate * 65 + scheduleHealth * 20 + (input.completed ? 15 : 0) - daysSinceReview * 1.1),
    0,
    100,
  );
}

export interface SimilarProblemRecommendation {
  type: "easier" | "equal";
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  cfUrl: string;
}

export async function getSimilarProblemRecommendations(input: {
  problemRating: number | null;
  problemTags: string[];
}): Promise<SimilarProblemRecommendation[]> {
  if (!input.problemRating || input.problemTags.length === 0) {
    return [];
  }

  const tagSubset = input.problemTags.slice(0, 2);
  const easier = await fetchProblemsFromCF(
    tagSubset,
    Math.max(800, input.problemRating - 200),
    Math.max(800, input.problemRating - 100),
  );
  const equal = await fetchProblemsFromCF(
    tagSubset,
    Math.max(800, input.problemRating - 50),
    input.problemRating + 100,
  );

  const recommendations: SimilarProblemRecommendation[] = [];
  const easierPick = easier.find((problem) => problem.rating != null);
  const equalPick = equal.find(
    (problem) =>
      problem.rating != null &&
      `${problem.contestId}-${problem.index}` !==
        `${easierPick?.contestId}-${easierPick?.index}`,
  );

  if (easierPick?.rating != null) {
    recommendations.push({
      type: "easier",
      ...easierPick,
      rating: easierPick.rating,
    });
  }

  if (equalPick?.rating != null) {
    recommendations.push({
      type: "equal",
      ...equalPick,
      rating: equalPick.rating,
    });
  }

  return recommendations;
}
