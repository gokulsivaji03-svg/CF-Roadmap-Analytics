"use client";

import { useSession } from "@/app/providers";
import {
  getCodeforcesProblemHref,
  getProblemWorkspaceHref,
} from "@/lib/problem-links";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  BookOpen,
  CheckCircle,
  Circle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────

interface PlanItem {
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
  reasonLabels?: string[];
}

interface DailyPlan {
  id: string;
  date: string;
  isCompleted: boolean;
  items: PlanItem[];
}

interface CfProblem {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  cfUrl: string;
  contestStartTimeSeconds?: number | null;
}

interface RatingRange {
  min: number;
  max: number;
}

interface DifficultyProfile {
  center: number;
  confidenceRange: RatingRange;
  coreRange: RatingRange;
  stretchRange: RatingRange;
  overallRange: RatingRange;
}

interface AnalysisSelectionContext {
  solvedProblemKeys?: string[];
  recentContestIds?: number[];
}

function getVisibleReasonLabels(reasonLabels?: string[]) {
  if (!Array.isArray(reasonLabels)) return [];

  return reasonLabels.filter((reason) => {
    const normalizedReason = reason.toLowerCase();
    return (
      !normalizedReason.startsWith("weak tag:") &&
      !normalizedReason.startsWith("common ") &&
      normalizedReason !== "review reinforcement"
    );
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Shuffle array in-place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roundTo100(value: number): number {
  return Math.round(value / 100) * 100;
}

function buildDifficultyProfile(
  rating: number,
  aggressive: boolean,
): DifficultyProfile {
  const center = roundTo100(
    Math.max(800, (aggressive ? 0.65 : 0.5) * rating + (aggressive ? 550 : 600)),
  );

  const confidenceRange = {
    min: Math.max(800, center - 200),
    max: Math.max(800, center - 100),
  };
  const coreRange = {
    min: Math.max(800, center - 100),
    max: center + 100,
  };
  const stretchRange = {
    min: center + 100,
    max: center + 200,
  };

  return {
    center,
    confidenceRange,
    coreRange,
    stretchRange,
    overallRange: {
      min: confidenceRange.min,
      max: stretchRange.max,
    },
  };
}

function inRange(
  rating: number,
  range: RatingRange,
  options?: { includeMin?: boolean; includeMax?: boolean },
): boolean {
  const includeMin = options?.includeMin ?? true;
  const includeMax = options?.includeMax ?? true;

  const minOk = includeMin ? rating >= range.min : rating > range.min;
  const maxOk = includeMax ? rating <= range.max : rating < range.max;
  return minOk && maxOk;
}

function getProblemKey(problem: Pick<CfProblem, "contestId" | "index">): string {
  return `${problem.contestId}-${problem.index}`;
}

function getFourYearsAgoSeconds(): number {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 4);
  return Math.floor(cutoff.getTime() / 1000);
}

function pickBucketProblems(
  source: CfProblem[],
  count: number,
  weakTags: string[],
  used: Set<string>,
) {
  const items: CfProblem[] = [];
  const weakFirst = shuffle(
    source.filter((problem) => problem.tags.some((tag) => weakTags.includes(tag))),
  );
  const remaining = shuffle(
    source.filter((problem) => !problem.tags.some((tag) => weakTags.includes(tag))),
  );

  for (const pool of [weakFirst, remaining]) {
    for (const problem of pool) {
      if (items.length >= count) break;

      const key = `${problem.contestId}-${problem.index}`;
      if (used.has(key)) continue;

      used.add(key);
      items.push(problem);
    }
  }

  return items;
}

/** Build a daily-plan body from problems and the user's weak tags. */
function buildPlanItems(
  problems: CfProblem[],
  weakTags: string[],
  profile: DifficultyProfile,
): {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  cfUrl: string;
  itemType: "practice" | "review";
}[] {
  const used = new Set<string>();
  const confidencePool = problems.filter((problem) =>
    inRange(problem.rating, profile.confidenceRange),
  );
  const corePool = problems.filter((problem) =>
    inRange(problem.rating, profile.coreRange, { includeMin: false }),
  );
  const stretchPool = problems.filter((problem) =>
    inRange(problem.rating, profile.stretchRange, { includeMin: false }),
  );

  const selected = [
    ...pickBucketProblems(confidencePool, 1, weakTags, used),
    ...pickBucketProblems(corePool, 2, weakTags, used),
    ...pickBucketProblems(stretchPool, 1, weakTags, used),
  ];

  if (selected.length < 4) {
    const fallback = pickBucketProblems(
      problems,
      4 - selected.length,
      weakTags,
      used,
    );
    selected.push(...fallback);
  }

  return selected.map((problem) => ({
    ...problem,
    itemType: problem.tags.some((tag) => weakTags.includes(tag))
      ? ("review" as const)
      : ("practice" as const),
  }));
}

function buildJournalHref(item: PlanItem): string {
  const params = new URLSearchParams();

  params.set("openForm", "1");

  if (item.problemContestId != null) {
    params.set("cfContestId", String(item.problemContestId));
  }
  if (item.problemIndex) {
    params.set("cfProblemIndex", item.problemIndex);
  }
  if (item.problemName) {
    params.set("problemName", item.problemName);
  }
  if (item.problemRating != null) {
    params.set("problemRating", String(item.problemRating));
  }
  if (item.problemUrl) {
    params.set("problemUrl", item.problemUrl);
  }
  if (item.problemTags.length > 0) {
    params.set("problemTags", item.problemTags.join(", "));
  }

  return `/journal?${params.toString()}`;
}

function getProblemWorkspaceLink(item: PlanItem) {
  if (item.problemContestId != null && item.problemIndex) {
    return getProblemWorkspaceHref(item.problemContestId, item.problemIndex);
  }

  return null;
}

function getCodeforcesLink(item: PlanItem) {
  if (item.problemUrl) return item.problemUrl;
  if (item.problemContestId != null && item.problemIndex) {
    return getCodeforcesProblemHref(item.problemContestId, item.problemIndex);
  }

  return null;
}

const AGGRESSIVE_MODE_STORAGE_KEY = "daily-plan-aggressive-mode";

// ── Component ───────────────────────────────────────────────────────

export default function DailyPlanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncingAnalysis, setSyncingAnalysis] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);
  const [aggressiveMode, setAggressiveMode] = useState(() => {
    if (typeof window === "undefined") return false;

    return window.localStorage.getItem(AGGRESSIVE_MODE_STORAGE_KEY) === "true";
  });

  // ── Auth redirect ────────────────────────────────────────────────

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // ── Fetch plan on mount ──────────────────────────────────────────

  const fetchPlan = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/daily-plan");
      if (res.status === 401) return;
      const json = await res.json();
      if (json.plan) {
        setPlan(json.plan);
        setNeedsSync(false);
      } else {
        setPlan(null);
      }
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchPlan();
  }, [session, fetchPlan]);

  useEffect(() => {
    window.localStorage.setItem(
      AGGRESSIVE_MODE_STORAGE_KEY,
      String(aggressiveMode),
    );
  }, [aggressiveMode]);

  // ── Generate plan ────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    try {
      setSyncingAnalysis(true);
      const saveRes = await fetch("/api/daily-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generate: true,
          aggressiveMode,
        }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Failed to save plan",
        );
      }
      const saved = await saveRes.json();
      setPlan(saved.plan);
      setNeedsSync(false);
      toast.success("Today's plan generated!");
    } catch (err: any) {
      if (err.message === "No CF profile found. Sync first.") {
        setNeedsSync(true);
      }
      toast.error(err.message || "Failed to generate plan");
    } finally {
      setSyncingAnalysis(false);
      setGenerating(false);
    }
  }

  // ── Check-off / time tracking ────────────────────────────────────

  async function toggleComplete(itemId: string, current: boolean) {
    // Optimistic update
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId ? { ...i, isCompleted: !current } : i,
        ),
      };
    });

    try {
      const res = await fetch("/api/daily-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, isCompleted: !current }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch {
      // Revert
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId ? { ...i, isCompleted: current } : i,
          ),
        };
      });
      toast.error("Failed to update problem status");
    }
  }

  // ── Loading state ────────────────────────────────────────────────

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 card" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // will redirect
  }

  // ── Needs sync ───────────────────────────────────────────────────

  if (needsSync) {
    return (
      <div className="max-w-lg mx-auto mt-20 animate-fade-in">
        <div className="card p-8 text-center">
          <Target className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Connect Codeforces First
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Sync your Codeforces profile so we can generate a personalized daily
            practice plan.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── No plan yet ──────────────────────────────────────────────────

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto mt-20 space-y-8 animate-fade-in">
        <div className="text-center">
          <Sparkles className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Daily Practice Plan
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            No plan for today yet. Generate one to get started!
          </p>
        </div>

        <div className="card p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            We&apos;ll analyze your Codeforces profile and pick 4 problems
            tailored to your rating and weak areas.
          </p>
          <label className="inline-flex items-center gap-3 mb-6 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={aggressiveMode}
              onChange={(e) => setAggressiveMode(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Aggressive progression
          </label>
          <div />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary px-8 py-3 text-lg"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin inline" />
                {syncingAnalysis ? "Analyzing profile…" : "Generating plan…"}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2 inline" />
                Generate Today&apos;s Plan
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Plan exists ──────────────────────────────────────────────────

  const completedCount = plan.items.filter((i) => i.isCompleted).length;
  const totalCount = plan.items.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Daily Practice Plan
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date(plan.date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress summary */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">
              {completedCount}
            </span>
            /{totalCount} completed
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={aggressiveMode}
              onChange={(e) => setAggressiveMode(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Aggressive
          </label>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-secondary"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="ml-1.5">Regenerate</span>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div
          className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      {/* Problem cards */}
      <div className="space-y-4">
        {plan.items.map((item) => {
          const visibleReasonLabels = getVisibleReasonLabels(item.reasonLabels);

          return (
            <div
              key={item.id}
              className={`card p-5 transition-all ${
                item.isCompleted ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleComplete(item.id, item.isCompleted)}
                  className="mt-0.5 shrink-0 focus:outline-none"
                  aria-label={
                    item.isCompleted ? "Mark incomplete" : "Mark complete"
                  }
                >
                  {item.isCompleted ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-400 hover:text-blue-500 transition-colors" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {item.problemName ??
                        `${item.problemContestId}${item.problemIndex}`}
                    </span>
                    {item.problemRating && (
                      <span className="badge">{item.problemRating}</span>
                    )}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.itemType === "review"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      }`}
                    >
                      {item.itemType === "review" ? "Review" : "Practice"}
                    </span>
                  </div>

                  {visibleReasonLabels.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {visibleReasonLabels.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action row */}
                  <div className="flex items-center gap-3 mt-3">
                    {getProblemWorkspaceLink(item) && (
                      <Link
                        href={getProblemWorkspaceLink(item)!}
                        className="btn-secondary text-xs inline-flex items-center gap-1"
                      >
                        <Target className="w-3.5 h-3.5" />
                        Solve in App
                      </Link>
                    )}

                    {getCodeforcesLink(item) && (
                      <a
                        href={getCodeforcesLink(item)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-xs inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open on Codeforces
                      </a>
                    )}

                    <Link
                      href={buildJournalHref(item)}
                      className="btn-ghost text-xs inline-flex items-center gap-1"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Add to Journal
                    </Link>
                  </div>
                </div>

                {/* Completion badge */}
                {item.isCompleted && (
                  <span className="badge bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 shrink-0">
                    Done
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion celebration */}
      {completedCount === totalCount && totalCount > 0 && (
        <div className="card p-8 text-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            All Done! 🎉
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Great work completing today&apos;s practice plan. Keep it up!
          </p>
        </div>
      )}
    </div>
  );
}
