"use client";

import { useSession } from "@/app/providers";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock3,
  Code,
  ExternalLink,
  LineChart,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

interface AnalysisData {
  profile: {
    handle: string;
    rating: number;
    maxRating: number;
    rank: string;
    maxRank: string;
    avatar: string | null;
  };
  stats: {
    totalSubmissions: number;
    solvedCount: number;
    avgSolveTimeMs: number;
    contestsParticipated: number;
  };
  tagStats: {
    tag: string;
    solvedCount: number;
    attemptedCount: number;
    avgRating: number;
    accuracy: number;
  }[];
  attemptDifficultyBreakdown: {
    bracket: string;
    totalProblems: number;
    solvedProblems: number;
    oneAttemptSolvedCount: number;
    multipleWrongProblemsCount: number;
  }[];
  ratingProgression: {
    contestId: number;
    contestName: string | null;
    oldRating: number;
    newRating: number;
    ratingChange: number;
    date: string;
  }[];
  mistakes: { category: string; count: number }[];
}

interface DailyPlanItem {
  id: string;
  problemContestId: number | null;
  problemIndex: string | null;
  problemName: string | null;
  problemRating: number | null;
  problemTags: string[];
  problemUrl: string | null;
  itemType: string;
  isCompleted: boolean;
  timeSpent: number | null;
  sortOrder: number;
}

interface DailyPlan {
  id: string;
  date: string;
  isCompleted: boolean;
  items: DailyPlanItem[];
}

interface SimilarProblemRecommendation {
  type: "easier" | "equal";
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  cfUrl: string;
}

interface ReviewItem {
  id: string;
  problemContestId: number | null;
  problemIndex: string | null;
  problemName: string | null;
  problemRating: number | null;
  problemTags: string[];
  problemUrl: string | null;
  reviewMode: string | null;
  reviewCount: number;
  successCount: number;
  failureCount: number;
  stillStuckCount: number;
  retentionScore: number;
  isCompleted: boolean;
  similarProblemRecommendations: SimilarProblemRecommendation[];
  nextReviewAt: string;
  overdueDays?: number;
}

interface ReviewData {
  due: ReviewItem[];
  all: ReviewItem[];
  patterns: {
    id: string;
    pattern: string;
    count: number;
    examples: string[];
  }[];
  dashboard?: {
    currentUserRating: number;
    retentionScore: number;
    problemsReviewed: number;
    reviewSuccessRate: number;
    reviewCompletionRate: number;
    editorialDependencyRate: number;
    independentSolveRate: number;
    averageReviewsBeforeMastery: number;
    mostCommonMistake: string | null;
    weakestTags: { tag: string; count: number }[];
    strongestTags: { tag: string; count: number }[];
    estimatedRatingReadiness: {
      readyFor: number;
      needsWork: string[];
    };
    queueSummary: {
      dueCount: number;
      overdueCount: number;
      masteredCount: number;
    };
  };
  analytics?: {
    topFailureTags: { tag: string; count: number }[];
    mostRepeatedMistakes: { id: string; pattern: string; count: number }[];
    ratingGrowthPrediction: {
      currentRating: number;
      readyFor: number;
    };
  };
}

interface RoadmapMilestone {
  id: string;
  title: string;
  targetRating: number;
  description: string;
}

interface RoadmapData {
  currentRating: number;
  totalSolved: number;
  currentMilestone: RoadmapMilestone | null;
  nextMilestone?: RoadmapMilestone;
}

interface DashboardState {
  analysis: AnalysisData | null;
  dailyPlan: DailyPlan | null;
  review: ReviewData | null;
  roadmap: RoadmapData | null;
}

interface NextDashboardAction {
  href: string;
  label: string;
  helperText: string;
}

interface ReadinessBucket {
  rating: number;
  score: number;
  confidenceLabel: string;
}

interface Blocker {
  id: string;
  title: string;
  metric: string;
  reason: string;
  suggestedAction: string;
  score: number;
}

interface RecommendedProblem {
  title: string;
  rating: number | null;
  tags: string[];
  reason: string;
  href: string;
}

interface RecentWin {
  id: string;
  title: string;
  detail: string;
}

const rankColors: Record<string, string> = {
  newbie: "text-gray-500",
  pupil: "text-green-600",
  specialist: "text-teal-500",
  expert: "text-blue-600",
  "candidate-master": "text-purple-600",
  master: "text-orange-500",
  "international-master": "text-orange-500",
  grandmaster: "text-red-600",
  legendarygrandmaster: "text-red-600",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToNearest100(value: number): number {
  return Math.round(value / 100) * 100;
}

function percentage(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function formatRating(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Unknown";
  return `${value}`;
}

function getGlobalAccuracy(tagStats: AnalysisData["tagStats"]): number {
  if (tagStats.length === 0) return 0.5;

  const totalAttempts = tagStats.reduce(
    (sum, tag) => sum + Math.max(tag.attemptedCount, 0),
    0,
  );
  if (totalAttempts === 0) return 0.5;

  const weightedAccuracy = tagStats.reduce(
    (sum, tag) => sum + tag.accuracy * tag.attemptedCount,
    0,
  );
  return clamp(weightedAccuracy / totalAttempts, 0, 1);
}

function getDifficultySolveRate(
  breakdown: AnalysisData["attemptDifficultyBreakdown"],
  targetRating: number,
  fallback: number,
): number {
  const bracket = breakdown.find((item) => {
    if (targetRating <= 1000) return item.bracket === "800-1000";
    if (targetRating <= 1300) return item.bracket === "1100-1300";
    if (targetRating <= 1600) return item.bracket === "1400-1600";
    if (targetRating <= 1900) return item.bracket === "1700-1900";
    return item.bracket === "2000+";
  });

  if (!bracket || bracket.totalProblems === 0) return fallback;
  return clamp(bracket.solvedProblems / bracket.totalProblems, 0, 1);
}

function getDailyPlanProgress(plan: DailyPlan | null) {
  const total = plan?.items.length ?? 0;
  const completed = plan?.items.filter((item) => item.isCompleted).length ?? 0;

  return {
    completed,
    total,
    isComplete: total > 0 && completed === total,
    hasPlan: total > 0,
  };
}

function calculateReadinessScore(
  analysis: AnalysisData,
  review: ReviewData | null,
): number {
  const globalAccuracy = getGlobalAccuracy(analysis.tagStats);
  const reviewSuccess = review?.dashboard?.reviewSuccessRate ?? 0.55;
  const retention = (review?.dashboard?.retentionScore ?? 55) / 100;
  const weakTagPenalty =
    analysis.tagStats.filter((tag) => tag.accuracy < 0.5).length * 0.04;
  const mistakePenalty =
    Math.min(
      0.12,
      analysis.mistakes.slice(0, 3).reduce((sum, mistake) => sum + mistake.count, 0) *
        0.01,
    ) || 0;

  // Keep this linear and inspectable:
  // accuracy + review health build confidence, while recurring blockers subtract from it.
  const score =
    globalAccuracy * 0.45 +
    reviewSuccess * 0.3 +
    retention * 0.25 -
    weakTagPenalty -
    mistakePenalty;

  return Math.round(clamp(score, 0, 1) * 100);
}

function buildReadinessLadder(
  analysis: AnalysisData,
  review: ReviewData | null,
  roadmap: RoadmapData | null,
): ReadinessBucket[] {
  const currentRating = analysis.profile.rating || roadmap?.currentRating || 800;
  const startBucket = Math.max(
    800,
    Math.floor((Math.max(currentRating, 800) - 150) / 100) * 100,
  );
  const bucketRatings = Array.from({ length: 4 }, (_, index) => startBucket + index * 100);
  const globalAccuracy = getGlobalAccuracy(analysis.tagStats);
  const reviewSuccess = review?.dashboard?.reviewSuccessRate ?? 0.55;
  const retention = (review?.dashboard?.retentionScore ?? 55) / 100;
  const blockerPenalty = clamp(
    analysis.tagStats.filter((tag) => tag.accuracy < 0.5).length * 0.03 +
      (review?.dashboard?.queueSummary.overdueCount ?? 0) * 0.02,
    0,
    0.2,
  );

  // Per-bucket readiness also stays linear on purpose:
  // bucket solve rate + review health + distance from current rating - blocker pressure.
  return bucketRatings.map((rating) => {
    const solveRate = getDifficultySolveRate(
      analysis.attemptDifficultyBreakdown,
      rating,
      globalAccuracy,
    );
    const ratingGap = Math.max(0, rating - currentRating);
    const distanceFactor = clamp(1 - ratingGap / 450, 0.2, 1);
    const rawScore =
      solveRate * 0.42 +
      reviewSuccess * 0.22 +
      retention * 0.18 +
      distanceFactor * 0.18 -
      blockerPenalty;
    const score = Math.round(clamp(rawScore, 0, 1) * 100);

    let confidenceLabel = "Stretch";
    if (score >= 80) confidenceLabel = "Ready";
    else if (score >= 60) confidenceLabel = "Close";

    return { rating, score, confidenceLabel };
  });
}

function getTopBlockers(
  analysis: AnalysisData,
  review: ReviewData | null,
): Blocker[] {
  const reviewFailureCounts = new Map(
    (review?.dashboard?.weakestTags ?? []).map((tag) => [tag.tag, tag.count]),
  );
  const blockers: Blocker[] = [];

  for (const tag of analysis.tagStats) {
    const repeatedFailures = reviewFailureCounts.get(tag.tag) ?? 0;
    const accuracy = clamp(tag.accuracy, 0, 1);
    const score =
      (1 - accuracy) * 70 +
      Math.min(tag.attemptedCount, 8) * 3 +
      repeatedFailures * 6;

    if (score < 35) continue;

    const reasons = [];
    if (accuracy < 0.5) reasons.push("low solve rate");
    if (repeatedFailures > 0) reasons.push("repeated review failures");
    if (reasons.length === 0) reasons.push("limited recent success");

    blockers.push({
      id: `tag-${tag.tag}`,
      title: tag.tag,
      metric: `Success Rate: ${Math.round(accuracy * 100)}%`,
      reason: reasons.join(" + "),
      suggestedAction:
        tag.avgRating > 0
          ? `Drill ${Math.round(tag.avgRating / 100) * 100}-rated ${tag.tag} problems and log the failure mode after each solve.`
          : `Solve two focused ${tag.tag} problems before your next stretch attempt.`,
      score,
    });
  }

  for (const pattern of review?.analytics?.mostRepeatedMistakes ?? []) {
    blockers.push({
      id: `mistake-${pattern.id}`,
      title: pattern.pattern,
      metric: `Repeated ${pattern.count}x`,
      reason: "common journal/review mistake category",
      suggestedAction:
        "Add a short pre-submit checklist for this mistake and review one solved example before practice.",
      score: pattern.count * 10,
    });
  }

  for (const mistake of analysis.mistakes) {
    blockers.push({
      id: `journal-${mistake.category}`,
      title: mistake.category,
      metric: `Repeated ${mistake.count}x`,
      reason: "common journal mistake category",
      suggestedAction:
        "Pick one problem specifically to rehearse this failure mode and write the fix in your journal.",
      score: mistake.count * 9,
    });
  }

  return blockers
    .sort((a, b) => b.score - a.score)
    .filter(
      (blocker, index, all) =>
        all.findIndex((candidate) => candidate.title === blocker.title) === index,
    )
    .slice(0, 3);
}

function getNextDashboardAction(
  plan: DailyPlan | null,
  review: ReviewData | null,
): NextDashboardAction {
  const dueCount = review?.dashboard?.queueSummary.dueCount ?? review?.due.length ?? 0;
  const progress = getDailyPlanProgress(plan);

  if (dueCount > 0) {
    return {
      href: "/review",
      label: "Continue Training",
      helperText: `${dueCount} review${dueCount === 1 ? "" : "s"} due right now`,
    };
  }

  if (progress.hasPlan && !progress.isComplete) {
    return {
      href: "/daily-plan",
      label: "Continue Training",
      helperText: `${progress.completed} / ${progress.total} plan items completed`,
    };
  }

  return {
    href: "/daily-plan",
    label: "Continue Training",
    helperText: "Start or generate today's plan",
  };
}

function getProblemHref(problem: {
  problemUrl?: string | null;
  problemContestId?: number | null;
  problemIndex?: string | null;
}): string {
  if (problem.problemUrl) return problem.problemUrl;
  if (problem.problemContestId != null && problem.problemIndex) {
    return `https://codeforces.com/problemset/problem/${problem.problemContestId}/${problem.problemIndex}`;
  }
  return "/daily-plan";
}

function getRecommendedProblem(
  plan: DailyPlan | null,
  review: ReviewData | null,
  blockers: Blocker[],
  currentRating: number,
  readyFor: number,
): RecommendedProblem | null {
  const blockerTitles = blockers.map((blocker) => blocker.title.toLowerCase());
  const incompleteItems = plan?.items.filter((item) => !item.isCompleted) ?? [];

  if (incompleteItems.length > 0) {
    const chosen =
      incompleteItems.find((item) =>
        item.problemTags.some((tag) => blockerTitles.includes(tag.toLowerCase())),
      ) ?? incompleteItems[0];
    const rating = chosen.problemRating;

    let reason = "Core difficulty problem";
    if (chosen.itemType === "review") {
      reason = "Review-reinforcement problem";
    } else if (
      chosen.problemTags.some((tag) => blockerTitles.includes(tag.toLowerCase()))
    ) {
      reason = "Matches weakest tag";
    } else if (rating != null && rating >= Math.max(currentRating + 100, readyFor - 100)) {
      reason = "Stretch problem for rating growth";
    }

    return {
      title: chosen.problemName ?? "Planned problem",
      rating,
      tags: chosen.problemTags,
      reason,
      href: getProblemHref(chosen),
    };
  }

  for (const dueReview of review?.due ?? []) {
    const candidate = dueReview.similarProblemRecommendations?.[0];
    if (!candidate) continue;

    return {
      title: candidate.name,
      rating: candidate.rating,
      tags: candidate.tags,
      reason: "Review-reinforcement problem",
      href: candidate.cfUrl,
    };
  }

  const reviewProblem = review?.due[0];
  if (reviewProblem) {
    return {
      title: reviewProblem.problemName ?? "Due review problem",
      rating: reviewProblem.problemRating,
      tags: reviewProblem.problemTags,
      reason: "Review-reinforcement problem",
      href: getProblemHref(reviewProblem),
    };
  }

  return null;
}

function getRecentWins(
  analysis: AnalysisData,
  plan: DailyPlan | null,
  review: ReviewData | null,
): RecentWin[] {
  const progress = getDailyPlanProgress(plan);
  const wins: RecentWin[] = [];

  if (progress.isComplete) {
    wins.push({
      id: "plan-complete",
      title: "Completed today's daily plan",
      detail: `${progress.total} planned problem${progress.total === 1 ? "" : "s"} cleared today.`,
    });
  } else if (progress.completed > 0) {
    wins.push({
      id: "plan-progress",
      title: "Made progress on today's plan",
      detail: `${progress.completed} of ${progress.total} tasks already completed.`,
    });
  }

  const mastered = review?.dashboard?.queueSummary.masteredCount ?? 0;
  if (mastered > 0) {
    wins.push({
      id: "mastered",
      title: "Mastered review backlog items",
      detail: `${mastered} review${mastered === 1 ? "" : "s"} moved to mastered.`,
    });
  }

  const latestContest = analysis.ratingProgression[0];
  if (latestContest?.ratingChange > 0) {
    wins.push({
      id: "rating-up",
      title: "Recent contest rating gain",
      detail: `Latest contest moved you by +${latestContest.ratingChange}.`,
    });
  }

  const strongestTag = [...analysis.tagStats]
    .sort((a, b) => b.accuracy - a.accuracy)
    .find((tag) => tag.attemptedCount >= 3 && tag.accuracy >= 0.7);
  if (strongestTag) {
    wins.push({
      id: "strong-tag",
      title: `${strongestTag.tag} is becoming reliable`,
      detail: `${Math.round(strongestTag.accuracy * 100)}% success across ${strongestTag.attemptedCount} tracked attempts.`,
    });
  }

  const dueCount = review?.dashboard?.queueSummary.dueCount ?? review?.due.length ?? 0;
  if ((review?.all.length ?? 0) > 0 && dueCount === 0) {
    wins.push({
      id: "queue-clear",
      title: "Review queue is clear",
      detail: "No reviews are due right now.",
    });
  }

  return wins.slice(0, 4);
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardState>({
    analysis: null,
    dailyPlan: null,
    review: null,
    roadmap: null,
  });

  useEffect(() => {
    if (!session) return;
    void fetchDashboardData();
  }, [session]);

  async function fetchDashboardData(mode: "load" | "refresh" = "load") {
    if (mode === "load") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const analysisRes = await fetch("/api/cf/analysis");
      if (analysisRes.status === 404) {
        setNeedsSync(true);
        setDashboard({
          analysis: null,
          dailyPlan: null,
          review: null,
          roadmap: null,
        });
        return;
      }

      if (!analysisRes.ok) {
        throw new Error("Failed to load dashboard analysis");
      }

      const analysis = (await analysisRes.json()) as AnalysisData;
      setNeedsSync(false);

      const [planResult, reviewResult, roadmapResult] = await Promise.allSettled([
        fetch("/api/daily-plan"),
        fetch("/api/review"),
        fetch("/api/roadmap"),
      ]);

      const dailyPlan =
        planResult.status === "fulfilled" && planResult.value.ok
          ? ((await planResult.value.json()) as { plan: DailyPlan | null }).plan
          : null;
      const review =
        reviewResult.status === "fulfilled" && reviewResult.value.ok
          ? ((await reviewResult.value.json()) as ReviewData)
          : null;
      const roadmap =
        roadmapResult.status === "fulfilled" && roadmapResult.value.ok
          ? ((await roadmapResult.value.json()) as RoadmapData)
          : null;

      setDashboard({ analysis, dailyPlan, review, roadmap });
    } catch (error: unknown) {
      setNeedsSync(true);
      toast.error(
        error instanceof Error ? error.message : "Could not load dashboard",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSync() {
    if (!handle.trim()) {
      toast.error("Enter your Codeforces handle");
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch("/api/cf/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }
      toast.success("Codeforces data synced!");
      await fetchDashboardData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (needsSync || !dashboard.analysis) {
    return (
      <div className="mx-auto mt-20 max-w-lg">
        <div className="card p-8 text-center">
          <Code className="mx-auto mb-4 h-12 w-12 text-blue-500" />
          <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            Connect Codeforces
          </h2>
          <p className="mb-6 text-gray-500 dark:text-gray-400">
            Enter your Codeforces handle to sync your profile, submissions, and
            contest history.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Your Codeforces handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="input-field flex-1"
              onKeyDown={(e) => e.key === "Enter" && void handleSync()}
            />
            <button
              onClick={() => void handleSync()}
              disabled={syncing}
              className="btn-primary"
            >
              {syncing ? "Syncing..." : "Sync"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { analysis, dailyPlan, review, roadmap } = dashboard;
  const readinessScore = calculateReadinessScore(analysis, review);
  const readinessLadder = buildReadinessLadder(analysis, review, roadmap);
  const blockers = getTopBlockers(analysis, review);
  const nextAction = getNextDashboardAction(dailyPlan, review);
  const readyFor =
    review?.dashboard?.estimatedRatingReadiness.readyFor ??
    roadmap?.nextMilestone?.targetRating ??
    roundToNearest100(analysis.profile.rating);
  const recommendedProblem = getRecommendedProblem(
    dailyPlan,
    review,
    blockers,
    analysis.profile.rating,
    readyFor,
  );
  const recentWins = getRecentWins(analysis, dailyPlan, review);
  const planProgress = getDailyPlanProgress(dailyPlan);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Mission-first coaching view for today&apos;s practice.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchDashboardData("refresh")}
            className="btn-ghost"
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <Link
            href="/settings"
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            Settings
          </Link>
        </div>
      </div>

      <TodaysMissionCard
        profile={analysis.profile}
        roadmap={roadmap}
        planProgress={planProgress}
        review={review}
        readinessScore={readinessScore}
        readyFor={readyFor}
        nextAction={nextAction}
        onContinue={() => router.push(nextAction.href)}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <ReadinessLadder ladder={readinessLadder} />
        </div>
        <div className="xl:col-span-7">
          <ReviewHealthCard review={review} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <TopBlockersCard blockers={blockers} />
        </div>
        <div className="xl:col-span-4">
          <RecommendedProblemCard problem={recommendedProblem} />
        </div>
        <div className="xl:col-span-3">
          <RecentWinsCard wins={recentWins} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat
          icon={Target}
          label="Solved"
          value={`${analysis.stats.solvedCount}`}
          helper="Accepted submissions tracked"
        />
        <MiniStat
          icon={Zap}
          label="Submissions"
          value={`${analysis.stats.totalSubmissions}`}
          helper="Recent Codeforces history"
        />
        <MiniStat
          icon={Trophy}
          label="Contests"
          value={`${analysis.stats.contestsParticipated}`}
          helper="Rating signal source"
        />
        <MiniStat
          icon={Brain}
          label="Max Rating"
          value={`${analysis.profile.maxRating}`}
          helper={analysis.profile.maxRank}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LegacyChartCard
          title="Rating Progression"
          description="Contest history stays visible, but below today’s action cards."
          icon={LineChart}
          emptyMessage="No rating progression data yet. Sync contest history to unlock this chart."
          hasData={analysis.ratingProgression.length > 0}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={analysis.ratingProgression.map((entry) => ({
                ...entry,
                date: entry.date
                  ? new Date(entry.date).toLocaleDateString()
                  : "",
              }))}
            >
              <defs>
                <linearGradient id="ratingAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "#111827",
                }}
                labelStyle={{ color: "#f9fafb" }}
              />
              <Area
                type="monotone"
                dataKey="newRating"
                stroke="#2563eb"
                fill="url(#ratingAreaFill)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </LegacyChartCard>

        <LegacyChartCard
          title="Tag Accuracy Overview"
          description="Useful context for blockers and recommended drills."
          icon={ShieldCheck}
          emptyMessage="Tag accuracy appears once solved and attempted tag stats are available."
          hasData={analysis.tagStats.length > 0}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={[...analysis.tagStats]
                .sort((a, b) => b.attemptedCount - a.attemptedCount)
                .slice(0, 10)}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis
                type="number"
                domain={[0, 1]}
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis
                dataKey="tag"
                type="category"
                width={120}
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <Tooltip
                formatter={(value: number) => percentage(value)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "#111827",
                }}
                labelStyle={{ color: "#f9fafb" }}
              />
              <Bar dataKey="accuracy" fill="#0f766e" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </LegacyChartCard>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="card h-72" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="card h-72 xl:col-span-5" />
        <div className="card h-72 xl:col-span-7" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="card h-80 xl:col-span-5" />
        <div className="card h-80 xl:col-span-4" />
        <div className="card h-80 xl:col-span-3" />
      </div>
    </div>
  );
}

function TodaysMissionCard({
  profile,
  roadmap,
  planProgress,
  review,
  readinessScore,
  readyFor,
  nextAction,
  onContinue,
}: {
  profile: AnalysisData["profile"];
  roadmap: RoadmapData | null;
  planProgress: ReturnType<typeof getDailyPlanProgress>;
  review: ReviewData | null;
  readinessScore: number;
  readyFor: number;
  nextAction: NextDashboardAction;
  onContinue: () => void;
}) {
  const dueCount = review?.dashboard?.queueSummary.dueCount ?? review?.due.length ?? 0;
  const nextMilestone = roadmap?.nextMilestone;

  return (
    <div className="card overflow-hidden border-blue-200/70 dark:border-blue-900/40">
      <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-teal-950 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-blue-100">
              <Sparkles className="h-3.5 w-3.5" />
              Today&apos;s Mission
            </div>
            <div className="flex items-center gap-4">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                  className="h-14 w-14 rounded-2xl border border-white/10 object-cover"
                />
              ) : null}
              <div>
                <h2 className="text-2xl font-bold">{profile.handle}</h2>
                <p className={`text-sm font-semibold ${rankColors[profile.rank] ?? "text-blue-200"}`}>
                  {profile.rank} • {profile.rating}
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm text-blue-100/85">
              Reviews, plan progress, and readiness are condensed here so the next
              action is obvious instead of buried under charts.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.16em] text-blue-100/75">
              Next action
            </p>
            <p className="mt-2 text-lg font-semibold">{nextAction.helperText}</p>
            <button onClick={onContinue} className="btn-primary mt-4 bg-white text-slate-950 hover:bg-blue-50">
              {nextAction.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MissionStat
            label="Daily plan progress"
            value={planProgress.hasPlan ? `${planProgress.completed} / ${planProgress.total}` : "0 / 0"}
            helper={
              planProgress.hasPlan
                ? planProgress.isComplete
                  ? "Plan completed"
                  : "Items completed"
                : "No plan generated yet"
            }
          />
          <MissionStat
            label="Reviews due today"
            value={`${dueCount}`}
            helper={
              dueCount > 0
                ? `${review?.dashboard?.queueSummary.overdueCount ?? 0} overdue`
                : "Queue is clear"
            }
          />
          <MissionStat
            label="Target rating / milestone"
            value={`${readyFor}`}
            helper={nextMilestone ? `${nextMilestone.title} at ${nextMilestone.targetRating}` : "Hold current growth band"}
          />
          <MissionStat
            label="Estimated readiness score"
            value={`${readinessScore}%`}
            helper="Composite of solve accuracy and review health"
          />
        </div>
      </div>
    </div>
  );
}

function MissionStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-blue-100/70">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-blue-100/75">{helper}</p>
    </div>
  );
}

function ReadinessLadder({ ladder }: { ladder: ReadinessBucket[] }) {
  return (
    <div className="card p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Target className="h-5 w-5 text-blue-500" />
            Readiness Ladder
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Estimated from solve rate by difficulty bracket, review health, and blocker pressure.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {ladder.map((bucket) => (
          <div key={bucket.rating} className="grid grid-cols-[64px_1fr_auto] items-center gap-4">
            <div className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-200">
              {bucket.rating}
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-full rounded-full transition-all ${
                  bucket.score >= 80
                    ? "bg-emerald-500"
                    : bucket.score >= 60
                      ? "bg-blue-500"
                      : bucket.score >= 40
                        ? "bg-amber-500"
                        : "bg-rose-500"
                }`}
                style={{ width: `${bucket.score}%` }}
              />
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900 dark:text-white">
                {bucket.score}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {bucket.confidenceLabel}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewHealthCard({ review }: { review: ReviewData | null }) {
  const dueCount = review?.dashboard?.queueSummary.dueCount ?? review?.due.length ?? 0;
  const masteredCount = review?.dashboard?.queueSummary.masteredCount ?? 0;
  const reviewSuccessRate = review?.dashboard?.reviewSuccessRate ?? null;
  const retentionScore = review?.dashboard?.retentionScore ?? null;
  const mostRepeatedMistake =
    review?.dashboard?.mostCommonMistake ?? review?.patterns?.[0]?.pattern ?? "Not enough review history yet";

  // TODO: If /api/review exposes a richer dashboard summary later, prefer that payload directly here.
  return (
    <div className="card border-amber-200/80 p-6 dark:border-amber-900/40">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            Review Health
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Reviews stay prominent because they are the highest-confidence recovery loop in the app.
          </p>
        </div>
        <Link href="/review" className="btn-secondary">
          Review Now
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricPanel
          icon={Clock3}
          label="Reviews due"
          value={`${dueCount}`}
          helper={
            (review?.dashboard?.queueSummary.overdueCount ?? 0) > 0
              ? `${review?.dashboard?.queueSummary.overdueCount} overdue`
              : "Nothing overdue"
          }
        />
        <MetricPanel
          icon={CheckCircle2}
          label="Review success rate"
          value={reviewSuccessRate == null ? "N/A" : percentage(reviewSuccessRate)}
          helper={
            retentionScore == null
              ? "Retention unavailable"
              : `Retention ${retentionScore}`
          }
        />
        <MetricPanel
          icon={AlertTriangle}
          label="Most repeated mistake"
          value={mostRepeatedMistake}
          helper="Derived from review attempts and journal patterns"
        />
        <MetricPanel
          icon={Trophy}
          label="Mastered reviews"
          value={`${masteredCount}`}
          helper="Problems that graduated from the queue"
        />
      </div>
    </div>
  );
}

function MetricPanel({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helper}</p>
    </div>
  );
}

function TopBlockersCard({ blockers }: { blockers: Blocker[] }) {
  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          Top Blockers
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Replace generic weak tags with the clearest obstacles to near-term progress.
        </p>
      </div>

      {blockers.length === 0 ? (
        <EmptyCardState
          title="No clear blockers right now"
          description="Once your tag stats or review failures concentrate around a few patterns, they’ll show up here."
        />
      ) : (
        <div className="space-y-4">
          {blockers.map((blocker, index) => (
            <div
              key={blocker.id}
              className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                    #{index + 1}
                  </p>
                  <h4 className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {blocker.title}
                  </h4>
                </div>
                <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                  {blocker.metric}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                Reason: {blocker.reason}
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Suggested action: {blocker.suggestedAction}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendedProblemCard({
  problem,
}: {
  problem: RecommendedProblem | null;
}) {
  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <Zap className="h-5 w-5 text-emerald-500" />
          Today&apos;s Recommended Problem
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          One problem selected from today&apos;s plan or review repair candidates.
        </p>
      </div>

      {!problem ? (
        <EmptyCardState
          title="No recommendation yet"
          description="Generate a daily plan or build review history to surface a stronger recommendation."
          ctaHref="/daily-plan"
          ctaLabel="Open Daily Plan"
        />
      ) : (
        <div className="flex h-full flex-col">
          <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/10">
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
              Reason selected
            </p>
            <p className="mt-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
              {problem.reason}
            </p>
          </div>
          <h4 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            {problem.title}
          </h4>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Rating {formatRating(problem.rating)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {problem.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              >
                {tag}
              </span>
            ))}
            {problem.tags.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                No tags available
              </span>
            ) : null}
          </div>
          <a
            href={problem.href}
            target="_blank"
            rel="noreferrer"
            className="btn-primary mt-6 w-full"
          >
            Solve
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}

function RecentWinsCard({ wins }: { wins: RecentWin[] }) {
  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <Trophy className="h-5 w-5 text-amber-500" />
          Recent Wins
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Small signals that momentum is improving.
        </p>
      </div>

      {wins.length === 0 ? (
        <EmptyCardState
          title="Wins will show up here"
          description="Clear reviews, complete your plan, or land a positive contest delta to populate this section."
        />
      ) : (
        <div className="space-y-4">
          {wins.map((win) => (
            <div key={win.id} className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {win.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {win.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helper}</p>
        </div>
        <div className="rounded-xl bg-gray-100 p-2 dark:bg-gray-800">
          <Icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </div>
      </div>
    </div>
  );
}

function LegacyChartCard({
  title,
  description,
  icon: Icon,
  hasData,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  icon: typeof LineChart;
  hasData: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <Icon className="h-5 w-5 text-blue-500" />
          {title}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>

      {hasData ? children : <EmptyCardState title="No chart data yet" description={emptyMessage} />}
    </div>
  );
}

function EmptyCardState({
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm dark:border-gray-800">
      <p className="font-medium text-gray-900 dark:text-white">{title}</p>
      <p className="mt-1 text-gray-500 dark:text-gray-400">{description}</p>
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className="btn-secondary mt-4">
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
