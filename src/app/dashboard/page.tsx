"use client";

import { useSession } from "@/app/providers";
import {
  getProblemWorkspaceHref,
} from "@/lib/problem-links";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";

interface AnalysisData {
  profile: {
    handle: string;
    rating: number;
    maxRating: number;
    rank: string;
  };
  stats: {
    solvedCount: number;
    contestsParticipated: number;
  };
  tagStats: {
    tag: string;
    attemptedCount: number;
    accuracy: number;
  }[];
  ratingProgression: {
    ratingChange: number;
  }[];
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
  sortOrder: number;
}

interface DailyPlan {
  id: string;
  date: string;
  isCompleted: boolean;
  items: DailyPlanItem[];
}

interface SimilarProblemRecommendation {
  contestId?: number;
  index?: string;
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
  similarProblemRecommendations: SimilarProblemRecommendation[];
}

interface ReviewData {
  due: ReviewItem[];
  dashboard?: {
    queueSummary: {
      dueCount: number;
      overdueCount: number;
    };
  };
}

interface RoadmapMilestone {
  id: string;
  title: string;
  targetRating: number;
}

interface RoadmapData {
  currentMilestone: RoadmapMilestone | null;
  nextMilestone?: RoadmapMilestone;
}

interface DashboardState {
  analysis: AnalysisData | null;
  dailyPlan: DailyPlan | null;
  review: ReviewData | null;
  roadmap: RoadmapData | null;
}

interface ProfileStripData {
  username: string;
  rating: string;
  rank: string;
  goal: string;
}

interface TodayPlanChecklistItem {
  id: string;
  label: string;
  meta: string;
  done: boolean;
  placeholder?: boolean;
}

interface TodayPlanSummary {
  completedLabel: string;
  items: TodayPlanChecklistItem[];
  ctaHref: string;
  ctaLabel: "Start Training" | "Continue Training";
  helperText: string;
}

interface RecommendedProblemSummary {
  title: string;
  rating: string;
  tags: string[];
  reason: string;
  href: string;
}

interface WeakAreaSummary {
  tag: string;
  successRate: string;
}

interface ProgressSnapshotItem {
  label: string;
  value: string;
}

function humanizeRank(rank: string | null | undefined): string {
  if (!rank) return "Unranked";

  return rank
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRating(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Unknown";
  return `${value}`;
}

function formatSignedNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function getDailyPlanProgress(plan: DailyPlan | null) {
  const orderedItems = [...(plan?.items ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const visibleItems = orderedItems.slice(0, 4);
  const completed = visibleItems.filter((item) => item.isCompleted).length;

  return {
    completed,
    total: 4,
    orderedItems,
    visibleItems,
    hasPlan: orderedItems.length > 0,
  };
}

function getGoalLabel(
  roadmap: RoadmapData | null,
  fallbackRating: number,
): string {
  const target = roadmap?.nextMilestone ?? roadmap?.currentMilestone;
  if (target) {
    return `${target.title} (${target.targetRating})`;
  }

  return `Hold ${fallbackRating}`;
}

function getProblemHref(problem: {
  problemUrl?: string | null;
  problemContestId?: number | null;
  problemIndex?: string | null;
}): string {
  if (problem.problemContestId != null && problem.problemIndex) {
    return getProblemWorkspaceHref(problem.problemContestId, problem.problemIndex);
  }
  if (problem.problemUrl) return problem.problemUrl;
  return "/daily-plan";
}

function buildProfileStripData(
  analysis: AnalysisData,
  roadmap: RoadmapData | null,
): ProfileStripData {
  return {
    username: analysis.profile.handle,
    rating: formatRating(analysis.profile.rating),
    rank: humanizeRank(analysis.profile.rank),
    goal: getGoalLabel(roadmap, analysis.profile.rating),
  };
}

function buildTodayPlanSummary(
  plan: DailyPlan | null,
  review: ReviewData | null,
): TodayPlanSummary {
  const progress = getDailyPlanProgress(plan);
  const dueCount =
    review?.dashboard?.queueSummary.dueCount ?? review?.due.length ?? 0;

  const planItems = progress.visibleItems.map((item) => ({
    id: item.id,
    label: item.problemName ?? "Practice problem",
    meta: item.problemRating ? `${item.problemRating}` : "Plan item",
    done: item.isCompleted,
  }));

  const fallbackItems: TodayPlanChecklistItem[] = [
    {
      id: "generate-plan",
      label: "Generate today's plan",
      meta: "Daily Plan",
      done: false,
      placeholder: true,
    },
    {
      id: "pick-problem",
      label: "Pick the first focus problem",
      meta: "Next step",
      done: false,
      placeholder: true,
    },
    {
      id: "review-miss",
      label: "Review one past miss",
      meta: "Review",
      done: false,
      placeholder: true,
    },
    {
      id: "log-takeaway",
      label: "Log one takeaway",
      meta: "Journal",
      done: false,
      placeholder: true,
    },
  ];

  const items = [...planItems];
  while (items.length < 4) {
    items.push(fallbackItems[items.length]);
  }

  const ctaLabel =
    dueCount > 0 || progress.hasPlan || progress.completed > 0
      ? "Continue Training"
      : "Start Training";

  const ctaHref = dueCount > 0 ? "/review" : "/daily-plan";

  let helperText = "Generate today's 4-step practice plan.";
  if (dueCount > 0) {
    helperText = `${dueCount} review${dueCount === 1 ? "" : "s"} due first`;
  } else if (progress.hasPlan && progress.completed < progress.total) {
    helperText = "Pick up the next checklist item";
  } else if (progress.completed === progress.total) {
    helperText = "Plan complete. Move to your next stretch solve";
  }

  return {
    completedLabel: `${progress.completed} / ${progress.total} completed`,
    items,
    ctaHref,
    ctaLabel,
    helperText,
  };
}

function buildRecommendedProblemSummary(
  plan: DailyPlan | null,
  review: ReviewData | null,
  weakestAreas: WeakAreaSummary[],
): RecommendedProblemSummary | null {
  const weakestTags = new Set(
    weakestAreas.map((area) => area.tag.toLowerCase()),
  );
  const nextPlanItem = [...(plan?.items ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((item) => !item.isCompleted);

  if (nextPlanItem) {
    let reason = "Next item from today's plan";
    if (
      nextPlanItem.problemTags.some((tag) =>
        weakestTags.has(tag.toLowerCase()),
      )
    ) {
      reason = "Targets a weak area";
    } else if (nextPlanItem.itemType === "review") {
      reason = "Reinforces a past miss";
    }

    return {
      title: nextPlanItem.problemName ?? "Planned problem",
      rating: formatRating(nextPlanItem.problemRating),
      tags: nextPlanItem.problemTags,
      reason,
      href: getProblemHref(nextPlanItem),
    };
  }

  const similarReviewProblem = review?.due[0]?.similarProblemRecommendations?.[0];
  if (similarReviewProblem) {
    return {
      title: similarReviewProblem.name,
      rating: formatRating(similarReviewProblem.rating),
      tags: similarReviewProblem.tags,
      reason: "Reinforces a past miss",
      href:
        similarReviewProblem.contestId != null && similarReviewProblem.index
          ? getProblemWorkspaceHref(
              similarReviewProblem.contestId,
              similarReviewProblem.index,
            )
          : similarReviewProblem.cfUrl,
    };
  }

  const dueReview = review?.due[0];
  if (dueReview) {
    return {
      title: dueReview.problemName ?? "Due review problem",
      rating: formatRating(dueReview.problemRating),
      tags: dueReview.problemTags,
      reason: "Due for review",
      href: getProblemHref(dueReview),
    };
  }

  return null;
}

function buildWeakAreaSummary(
  tagStats: AnalysisData["tagStats"],
): WeakAreaSummary[] {
  return [...tagStats]
    .filter((tag) => tag.attemptedCount > 0)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.attemptedCount - a.attemptedCount;
    })
    .slice(0, 3)
    .map((tag) => ({
      tag: tag.tag,
      successRate: `${Math.round(tag.accuracy * 100)}%`,
    }));
}

function buildProgressSnapshot(analysis: AnalysisData): ProgressSnapshotItem[] {
  const latestDelta = analysis.ratingProgression[0]?.ratingChange ?? null;

  return [
    { label: "Solved", value: `${analysis.stats.solvedCount}` },
    { label: "Contests", value: `${analysis.stats.contestsParticipated}` },
    { label: "Recent Gain", value: formatSignedNumber(latestDelta) },
    { label: "Max Rating", value: formatRating(analysis.profile.maxRating) },
  ];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [router, status]);

  async function fetchDashboardData() {
    setLoading(true);

    try {
      const analysisRes = await fetch("/api/cf/analysis");
      if (analysisRes.status === 404) {
        setRedirecting(true);
        router.replace("/connect-handle");
        return;
      }

      if (!analysisRes.ok) {
        throw new Error("Failed to load dashboard analysis");
      }

      const analysis = (await analysisRes.json()) as AnalysisData;

      const [planResult, reviewResult, roadmapResult] =
        await Promise.allSettled([
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
      toast.error(
        error instanceof Error ? error.message : "Could not load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return <DashboardSkeleton />;
  }

  if (status === "unauthenticated") {
    return <DashboardSkeleton />;
  }

  if (!session || loading || redirecting || !dashboard.analysis) {
    return <DashboardSkeleton />;
  }

  const { analysis, dailyPlan, review, roadmap } = dashboard;
  const profileStrip = buildProfileStripData(analysis, roadmap);
  const weakestAreas = buildWeakAreaSummary(analysis.tagStats);
  const todayPlan = buildTodayPlanSummary(dailyPlan, review);
  const recommendedProblem = buildRecommendedProblemSummary(
    dailyPlan,
    review,
    weakestAreas,
  );
  const progressSnapshot = buildProgressSnapshot(analysis);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <ProfileStripCard data={profileStrip} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <TodaysPlanCard summary={todayPlan} />
        <RecommendedProblemCard problem={recommendedProblem} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <WeakestAreasCard items={weakestAreas} />
        <ProgressSnapshotCard items={progressSnapshot} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-pulse">
      <div className="card h-28" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="card h-[28rem]" />
        <div className="card h-[28rem]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card h-72" />
        <div className="card h-72" />
      </div>
    </div>
  );
}

function ProfileStripCard({ data }: { data: ProfileStripData }) {
  return (
    <section className="card p-6 sm:p-7">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileValue label="Username" value={data.username} />
        <ProfileValue label="Rating" value={data.rating} />
        <ProfileValue label="Rank" value={data.rank} />
        <ProfileValue label="Goal" value={data.goal} />
      </div>
    </section>
  );
}

function ProfileValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function TodaysPlanCard({ summary }: { summary: TodayPlanSummary }) {
  return (
    <section className="card p-6 sm:p-7">
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Today&apos;s Plan
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{summary.completedLabel}</span>
            <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            <span>{summary.helperText}</span>
          </div>
        </div>

        <div className="space-y-3">
          {summary.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                item.placeholder
                  ? "border-dashed border-gray-200 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-900/30"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-gray-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900 dark:text-white">
                  {item.label}
                </p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {item.meta}
              </span>
            </div>
          ))}
        </div>

        <div>
          <Link href={summary.ctaHref} className="btn-primary inline-flex">
            {summary.ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

function RecommendedProblemCard({
  problem,
}: {
  problem: RecommendedProblemSummary | null;
}) {
  return (
    <section className="card p-6 sm:p-7">
      <div className="flex h-full flex-col gap-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Next Recommended Problem
          </h2>
          <Link
            href="/daily-plan"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Daily Plan
          </Link>
        </div>

        {!problem ? (
          <CompactEmptyState
            title="No problem yet"
            description="Generate today&apos;s plan to unlock the next solve."
          />
        ) : (
          <div className="flex h-full flex-col gap-5">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {problem.title}
              </p>
              <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Rating {problem.rating}</span>
                <span className="h-1 w-1 self-center rounded-full bg-gray-300 dark:bg-gray-700" />
                <span>{problem.reason}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {problem.tags.length > 0 ? (
                problem.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  No tags
                </span>
              )}
            </div>

            <div className="mt-auto">
              <ProblemLink href={problem.href} label="Solve in App" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function WeakestAreasCard({ items }: { items: WeakAreaSummary[] }) {
  return (
    <section className="card p-6 sm:p-7">
      <div className="space-y-5">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Weakest Areas
        </h2>

        {items.length === 0 ? (
          <CompactEmptyState
            title="No weak tags yet"
            description="More solved attempts will surface them here."
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.tag}
                className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 dark:border-gray-800"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  {item.tag}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {item.successRate}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProgressSnapshotCard({
  items,
}: {
  items: ProgressSnapshotItem[];
}) {
  return (
    <section className="card p-6 sm:p-7">
      <div className="space-y-5">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Progress Snapshot
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-gray-200 px-4 py-5 dark:border-gray-800"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompactEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 dark:border-gray-800">
      <p className="font-medium text-gray-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

function ProblemLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className="btn-secondary inline-flex w-full justify-center">
        {label}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="btn-secondary inline-flex w-full justify-center"
    >
      {label}
      <ExternalLink className="ml-2 h-4 w-4" />
    </a>
  );
}
