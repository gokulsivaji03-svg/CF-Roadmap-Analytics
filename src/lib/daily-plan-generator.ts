import { fetchProblemsFromCF } from "./cf-api";
import { getCommonTagBoost, getCommonTagReasons } from "./tag-frequency";

export interface RecommendationProblem {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  cfUrl: string;
  solvedCount?: number | null;
}

export interface PlanProblem extends RecommendationProblem {
  itemType: "practice" | "review";
  reasonLabels: string[];
  recommendationBand: RecommendationBand;
  recommendationScore: number;
}

interface DailyPlanConfig {
  rating: number;
  weakTags: string[];
  failedProblems: {
    contestId: number;
    index: string;
    name?: string;
    rating?: number;
    tags?: string[];
    url?: string;
  }[];
  date: Date;
  solvedProblemKeys?: string[];
  excludedContestIds?: number[];
  aggressive?: boolean;
}

export interface RatingRange {
  min: number;
  max: number;
}

export interface DifficultyProfile {
  center: number;
  consistencyRange: RatingRange;
  growthRange: RatingRange;
  stretchRange: RatingRange;
  overallRange: RatingRange;
}

export type RecommendationBand = "consistency" | "growth" | "stretch";

const DEFAULT_PLAN_SIZE = 4;

function getProblemKey(problem: Pick<RecommendationProblem, "contestId" | "index">) {
  return `${problem.contestId}-${problem.index}`;
}

function clampMinimumRating(rating: number) {
  return Math.max(800, rating);
}

function inRange(
  rating: number,
  range: RatingRange,
  options?: { includeMin?: boolean; includeMax?: boolean },
) {
  const includeMin = options?.includeMin ?? true;
  const includeMax = options?.includeMax ?? true;

  const minOk = includeMin ? rating >= range.min : rating > range.min;
  const maxOk = includeMax ? rating <= range.max : rating < range.max;
  return minOk && maxOk;
}

function normalizeWeakTagSet(weakTags: string[]) {
  return new Set(weakTags.map((tag) => tag.toLowerCase()));
}

function getBandTarget(currentRating: number, band: RecommendationBand) {
  if (band === "consistency") return currentRating;
  if (band === "growth") return currentRating + 200;
  return currentRating + 400;
}

function getBandPriority(band: RecommendationBand) {
  if (band === "consistency") return 0;
  if (band === "growth") return 1;
  return 2;
}

function getMatchedWeakTags(problem: RecommendationProblem, weakTagSet: Set<string>) {
  return problem.tags.filter((tag) => weakTagSet.has(tag.toLowerCase()));
}

function buildReasonLabels(
  problem: RecommendationProblem,
  currentRating: number,
  band: RecommendationBand,
  matchedWeakTags: string[],
  commonTagReasons: string[],
) {
  const reasonLabels: string[] = [];
  const seen = new Set<string>();

  const pushReason = (reason: string) => {
    if (!reason || seen.has(reason)) return;
    seen.add(reason);
    reasonLabels.push(reason);
  };

  if (matchedWeakTags.length > 0) {
    pushReason(`weak tag: ${matchedWeakTags[0]}`);
  }

  for (const reason of commonTagReasons) {
    pushReason(reason);
  }

  if (band === "consistency") {
    pushReason("consistency practice");
  }

  if (band === "stretch") {
    pushReason("stretch problem");
  }

  const ratingPush = problem.rating - currentRating;
  if (ratingPush >= 100) {
    pushReason(`rating push: +${Math.round(ratingPush / 100) * 100}`);
  }

  return reasonLabels;
}

function computeRecommendationScore(input: {
  problem: RecommendationProblem;
  band: RecommendationBand;
  currentRating: number;
  weakTagSet: Set<string>;
  solvedProblemKeys: Set<string>;
  hasWeakTagData: boolean;
}) {
  const {
    problem,
    band,
    currentRating,
    weakTagSet,
    solvedProblemKeys,
    hasWeakTagData,
  } = input;
  const matchedWeakTags = getMatchedWeakTags(problem, weakTagSet);
  const problemKey = getProblemKey(problem);
  if (solvedProblemKeys.has(problemKey)) {
    return null;
  }

  const targetRating = getBandTarget(currentRating, band);
  const ratingDistance = Math.abs(problem.rating - targetRating);
  const commonTagReasons = getCommonTagReasons(problem.tags, currentRating);
  const rawCommonTagBoost = getCommonTagBoost(problem.tags, currentRating);
  const commonTagScore = hasWeakTagData
    ? Math.min(rawCommonTagBoost, 80)
    : Math.min(Math.round(rawCommonTagBoost * 1.35), 120);
  const weakTagScore = matchedWeakTags.length * 180;
  const ratingScore = Math.max(0, 260 - ratingDistance);
  const popularityScore = Math.round(
    Math.log10((problem.solvedCount ?? 0) + 1) * 12,
  );
  const score = 100 + weakTagScore + ratingScore + commonTagScore + popularityScore;

  return {
    score,
    matchedWeakTags,
    ratingDistance,
    popularity: problem.solvedCount ?? 0,
    reasonLabels: buildReasonLabels(
      problem,
      currentRating,
      band,
      matchedWeakTags,
      commonTagReasons,
    ),
  };
}

function rankProblems(
  problems: RecommendationProblem[],
  band: RecommendationBand,
  currentRating: number,
  weakTags: string[],
  solvedProblemKeys: Set<string>,
  usedKeys: Set<string>,
) {
  const weakTagSet = normalizeWeakTagSet(weakTags);
  const hasWeakTagData = weakTagSet.size > 0;

  return problems
    .filter((problem) => {
      const problemKey = getProblemKey(problem);
      return !usedKeys.has(problemKey) && !solvedProblemKeys.has(problemKey);
    })
    .map((problem) => {
      const details = computeRecommendationScore({
        problem,
        band,
        currentRating,
        weakTagSet,
        solvedProblemKeys,
        hasWeakTagData,
      });
      if (!details) return null;

      return {
        ...problem,
        itemType: details.matchedWeakTags.length > 0 ? ("review" as const) : ("practice" as const),
        recommendationBand: band,
        recommendationScore: details.score,
        reasonLabels: details.reasonLabels,
        matchedWeakTagCount: details.matchedWeakTags.length,
        ratingDistance: details.ratingDistance,
        popularity: details.popularity,
      };
    })
    .filter((problem): problem is NonNullable<typeof problem> => problem !== null)
    .filter((problem) => problem.recommendationScore > 0)
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }
      if (b.matchedWeakTagCount !== a.matchedWeakTagCount) {
        return b.matchedWeakTagCount - a.matchedWeakTagCount;
      }
      if (a.ratingDistance !== b.ratingDistance) {
        return a.ratingDistance - b.ratingDistance;
      }
      if (b.popularity !== a.popularity) {
        return b.popularity - a.popularity;
      }
      if (a.contestId !== b.contestId) {
        return a.contestId - b.contestId;
      }
      return a.index.localeCompare(b.index);
    });
}

function getBandRange(profile: DifficultyProfile, band: RecommendationBand) {
  if (band === "consistency") return profile.consistencyRange;
  if (band === "growth") return profile.growthRange;
  return profile.stretchRange;
}

function getBandQuota(aggressive: boolean): Array<{ band: RecommendationBand; count: number }> {
  return aggressive
    ? [
        { band: "consistency", count: 1 },
        { band: "growth", count: 2 },
        { band: "stretch", count: 1 },
      ]
    : [
        { band: "consistency", count: 2 },
        { band: "growth", count: 1 },
        { band: "stretch", count: 1 },
      ];
}

function getFallbackBand(problem: RecommendationProblem, profile: DifficultyProfile) {
  const ranges: RecommendationBand[] = ["consistency", "growth", "stretch"];
  const exactMatch = ranges.find((band) =>
    inRange(problem.rating, getBandRange(profile, band), {
      includeMin: band === "consistency",
      includeMax: true,
    }),
  );

  if (exactMatch) {
    return exactMatch;
  }

  return ranges
    .map((band) => ({
      band,
      distance: Math.abs(problem.rating - getBandTarget(profile.center, band)),
    }))
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return getBandPriority(a.band) - getBandPriority(b.band);
    })[0].band;
}

export function buildDifficultyProfile(
  rating: number,
  aggressive: boolean,
): DifficultyProfile {
  const center = clampMinimumRating(rating + (aggressive ? 100 : 0));

  return {
    center,
    consistencyRange: {
      min: clampMinimumRating(center - 100),
      max: clampMinimumRating(center + 100),
    },
    growthRange: {
      min: clampMinimumRating(center + 100),
      max: clampMinimumRating(center + 300),
    },
    stretchRange: {
      min: clampMinimumRating(center + 300),
      max: clampMinimumRating(center + 500),
    },
    overallRange: {
      min: clampMinimumRating(center - 100),
      max: clampMinimumRating(center + 500),
    },
  };
}

export function buildPlanItems(
  problems: RecommendationProblem[],
  weakTags: string[],
  profile: DifficultyProfile,
  options?: {
    aggressive?: boolean;
    solvedProblemKeys?: Iterable<string>;
    targetCount?: number;
  },
): PlanProblem[] {
  const usedKeys = new Set<string>();
  const solvedProblemKeys = new Set(options?.solvedProblemKeys ?? []);
  const selected: PlanProblem[] = [];
  const targetCount = options?.targetCount ?? DEFAULT_PLAN_SIZE;

  for (const bucket of getBandQuota(Boolean(options?.aggressive))) {
    const bucketProblems = problems.filter((problem) =>
      inRange(problem.rating, getBandRange(profile, bucket.band), {
        includeMin: bucket.band === "consistency",
        includeMax: true,
      }),
    );
    const ranked = rankProblems(
      bucketProblems,
      bucket.band,
      profile.center,
      weakTags,
      solvedProblemKeys,
      usedKeys,
    );

    for (const problem of ranked.slice(0, bucket.count)) {
      usedKeys.add(getProblemKey(problem));
      selected.push(problem);
    }
  }

  if (selected.length < targetCount) {
    const fallback = problems
      .filter((problem) => !usedKeys.has(getProblemKey(problem)))
      .map((problem) => {
        const fallbackBand = getFallbackBand(problem, profile);
        const [ranked] = rankProblems(
          [problem],
          fallbackBand,
          profile.center,
          weakTags,
          solvedProblemKeys,
          usedKeys,
        );
        return ranked;
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.recommendationScore !== a.recommendationScore) {
          return b.recommendationScore - a.recommendationScore;
        }
        return getBandPriority(a.recommendationBand) - getBandPriority(b.recommendationBand);
      });

    for (const problem of fallback) {
      if (selected.length >= targetCount) break;

      const key = getProblemKey(problem);
      if (usedKeys.has(key)) continue;

      usedKeys.add(key);
      selected.push(problem);
    }
  }

  return selected.slice(0, targetCount);
}

export async function generateDailyPlan(config: DailyPlanConfig) {
  const {
    rating,
    weakTags,
    failedProblems,
    date,
    solvedProblemKeys = [],
    excludedContestIds = [],
    aggressive = false,
  } = config;
  const profile = buildDifficultyProfile(rating, aggressive);
  const excludedContestIdSet = new Set(excludedContestIds);
  const newProblems = (await fetchProblemsFromCF(
    [],
    profile.overallRange.min,
    profile.overallRange.max,
  )).filter((problem) => !excludedContestIdSet.has(problem.contestId));

  const reviewProblems = failedProblems
    .filter((problem) => problem.rating != null)
    .slice(0, 2)
    .map((problem) => ({
      contestId: problem.contestId,
      index: problem.index,
      name: problem.name || `Problem ${problem.contestId}${problem.index}`,
      rating: problem.rating ?? profile.center,
      tags: problem.tags || [],
      cfUrl:
        problem.url ||
        `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
      solvedCount: null,
      itemType: "review" as const,
      reasonLabels: ["review reinforcement"],
      recommendationBand: "consistency" as const,
      recommendationScore: 9999,
    }));

  const plannedProblems = buildPlanItems(newProblems, weakTags, profile, {
    aggressive,
    solvedProblemKeys,
    targetCount: Math.max(0, DEFAULT_PLAN_SIZE - reviewProblems.length),
  });

  return {
    date,
    items: [...reviewProblems, ...plannedProblems].map((problem, index) => ({
      ...problem,
      sortOrder: index,
    })),
  };
}

export async function generateContestSimulation(
  rating: number,
  count = 5,
  weakTags: string[] = [],
) {
  const profile = buildDifficultyProfile(rating, true);
  const problems = await fetchProblemsFromCF(
    [],
    profile.consistencyRange.min,
    profile.growthRange.max,
  );

  const selected = buildPlanItems(problems, weakTags, profile, {
    aggressive: true,
    targetCount: count,
  }).map((problem, index) => ({
    contestId: problem.contestId,
    index: problem.index,
    name: problem.name,
    rating: problem.rating,
    tags: problem.tags,
    cfUrl: problem.cfUrl,
    sortOrder: index,
    status: "pending" as const,
  }));

  return {
    problems: selected,
    durationMins: count * 24,
    difficulty: `${profile.consistencyRange.min}-${profile.growthRange.max}`,
  };
}
