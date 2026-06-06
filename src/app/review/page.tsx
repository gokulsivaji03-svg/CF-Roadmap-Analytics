"use client";

import { useSession } from "@/app/providers";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Repeat,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Trash2,
  TrendingUp,
  Brain,
  Target,
  BookOpen,
  LineChart,
} from "lucide-react";
import Link from "next/link";
import { formatDate, timeAgo } from "@/lib/utils";

interface ReviewAttempt {
  id: string;
  outcome: string;
  confidence: number | null;
  scheduledStage: number;
  resultingStage: number;
  wasSuccessful: boolean;
  intervalDays: number;
  mistakeCategories: string[];
  notes: string | null;
  createdAt: string;
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
  problemId: string | null;
  problemContestId: number | null;
  problemIndex: string | null;
  problemName: string | null;
  problemRating: number | null;
  latestProblemRating: number | null;
  problemTags: string[];
  problemUrl: string | null;
  reviewMode: string | null;
  stage: number;
  nextReviewAt: string;
  nextIntervalDays: number;
  lastReviewedAt: string | null;
  reviewCount: number;
  successCount: number;
  failureCount: number;
  solvedEasilyCount: number;
  solvedWithEffortCount: number;
  neededHintCount: number;
  neededEditorialCount: number;
  stillStuckCount: number;
  retentionScore: number;
  importanceScore: number;
  priorityScore: number;
  isCompleted: boolean;
  isDismissed: boolean;
  masteredAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  originalUserRating: number | null;
  currentUserRating: number;
  ratingDeltaFromOriginal: number;
  ratingReadinessMessage: string | null;
  mistakeCategories: string[];
  similarProblemRecommendations: SimilarProblemRecommendation[];
  attempts: ReviewAttempt[];
}

interface MistakePattern {
  id: string;
  pattern: string;
  count: number;
  examples: string[];
}

interface ReviewData {
  due: ReviewItem[];
  all: ReviewItem[];
  patterns: MistakePattern[];
  dashboard: {
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
  analytics: {
    topFailureTags: { tag: string; count: number }[];
    mostRepeatedMistakes: MistakePattern[];
    averageReviewsBeforeMastery: number;
    editorialDependencyRate: number;
    independentSolveRate: number;
    ratingGrowthPrediction: {
      currentRating: number;
      readyFor: number;
    };
  };
  taxonomy: {
    mistakeCategories: string[];
    reviewModes: string[];
  };
}

const STAGE_LABELS = ["1d", "3d", "7d", "21d", "Mastered"];

function getCfProblemUrl(item: ReviewItem): string {
  if (item.problemUrl) return item.problemUrl;
  if (item.problemContestId != null && item.problemIndex) {
    return `https://codeforces.com/problemset/problem/${item.problemContestId}/${item.problemIndex}`;
  }
  return "#";
}

function getRatingColorClass(rating: number | null): string {
  if (rating == null) return "text-gray-500";
  if (rating < 1200) return "rating-text-newbie";
  if (rating < 1400) return "rating-text-pupil";
  if (rating < 1600) return "rating-text-specialist";
  if (rating < 1900) return "rating-text-expert";
  if (rating < 2200) return "rating-text-candidate";
  if (rating < 2500) return "rating-text-master";
  return "rating-text-grandmaster";
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function ReviewPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReviewData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/review");
      if (!res.ok) throw new Error("Failed to fetch review engine");
      const json: ReviewData = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "Could not load reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchReviews();
  }, [session, fetchReviews]);

  async function handleReview(
    reviewId: string,
    reviewMode: string,
    mistakeCategories: string[],
    notes: string,
  ) {
    setActionLoading(reviewId);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId,
          reviewMode,
          mistakeCategories,
          notes,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to submit review");
      }

      if (payload.recommendations?.length) {
        toast.success("Review logged. Similar repair problems added below.");
      } else if (payload.isCompleted) {
        toast.success("Problem mastered.");
      } else {
        toast.success("Review updated.");
      }

      await fetchReviews();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDismiss(reviewId: string) {
    setActionLoading(reviewId);
    try {
      const res = await fetch(`/api/review?id=${reviewId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to dismiss review");
      }
      toast.success("Review dismissed");
      await fetchReviews();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please sign in to view your reviews.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 card" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-56 card" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { due, all, patterns, dashboard, analytics, taxonomy } = data;
  const recentTimeline = all.slice(0, 6);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Repeat className="w-6 h-6 text-purple-500" />
            Review Engine
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Personalized coaching for retention, weak skills, and rating growth.
          </p>
        </div>
        <Link href="/review/analytics" className="btn-secondary text-sm">
          <LineChart className="w-4 h-4 mr-1.5" />
          Analytics
        </Link>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Brain}
          label="Retention Score"
          value={`${dashboard.retentionScore}`}
          hint="0–100 based on review performance"
        />
        <StatCard
          icon={Clock}
          label="Due Queue"
          value={`${dashboard.queueSummary.dueCount}`}
          hint={`${dashboard.queueSummary.overdueCount} overdue`}
        />
        <StatCard
          icon={TrendingUp}
          label="Ready For"
          value={`${dashboard.estimatedRatingReadiness.readyFor}`}
          hint={`Current rating ${dashboard.currentUserRating}`}
        />
        <StatCard
          icon={CheckCircle}
          label="Review Success"
          value={percentage(dashboard.reviewSuccessRate)}
          hint={`${dashboard.queueSummary.masteredCount} mastered`}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-red-500" />
            Needs Work
          </h2>
          <div className="flex flex-wrap gap-2">
            {dashboard.estimatedRatingReadiness.needsWork.length > 0 ? (
              dashboard.estimatedRatingReadiness.needsWork.map((tag) => (
                <span
                  key={tag}
                  className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">No major blockers detected.</span>
            )}
          </div>
          {dashboard.mostCommonMistake && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Most common mistake:{" "}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {dashboard.mostCommonMistake}
              </span>
            </p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Rating Growth Signals
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <MetricLine
              label="Independent solve rate"
              value={percentage(dashboard.independentSolveRate)}
            />
            <MetricLine
              label="Review completion"
              value={percentage(dashboard.reviewCompletionRate)}
            />
            <MetricLine
              label="Editorial dependency"
              value={percentage(dashboard.editorialDependencyRate)}
            />
            <MetricLine
              label="Avg reviews before mastery"
              value={dashboard.averageReviewsBeforeMastery.toFixed(1)}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Prioritized Review Queue
          </h2>
          {due.length > 0 && (
            <span className="badge badge-expert">{due.length} due</span>
          )}
        </div>

        {due.length === 0 ? (
          <div className="card p-8 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              All caught up.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              No reviews are due right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {due.map((item) => (
              <ReviewQueueCard
                key={item.id}
                item={item}
                taxonomy={taxonomy}
                isLoading={actionLoading === item.id}
                onSubmit={handleReview}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </section>

      {patterns.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pattern Intelligence
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {patterns.slice(0, 6).map((pattern) => (
              <div key={pattern.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                    {pattern.pattern}
                  </h3>
                  <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {pattern.count}x
                  </span>
                </div>
                {pattern.examples.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Example: {pattern.examples[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Learning Timeline
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recentTimeline.map((item) => (
            <div key={item.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={getCfProblemUrl(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-gray-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {item.problemName || "Unknown Problem"}
                    </a>
                    {item.problemRating != null && (
                      <span
                        className={`text-xs font-semibold ${getRatingColorClass(item.problemRating)}`}
                      >
                        {item.problemRating}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.ratingReadinessMessage}
                  </p>
                </div>
                <span
                  className={`badge ${
                    item.isDismissed
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      : item.isCompleted
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}
                >
                  {item.isDismissed
                    ? "Dismissed"
                    : item.isCompleted
                      ? "Mastered"
                      : "In Progress"}
                </span>
              </div>
              <AttemptTimeline attempts={item.attempts} />
            </div>
          ))}
        </div>
      </section>

      {all.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Repeat className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Review History
            </h2>
            <span className="text-sm text-gray-500">({all.length} total)</span>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-surface-border-dark bg-gray-50 dark:bg-gray-900/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Problem
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Retention
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Priority
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Last Mode
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-surface-border-dark">
                  {all.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white truncate max-w-[240px]">
                              {item.problemName || "Unknown"}
                            </span>
                            {item.problemRating != null && (
                              <span
                                className={`text-xs font-semibold ${getRatingColorClass(item.problemRating)}`}
                              >
                                {item.problemRating}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {item.ratingDeltaFromOriginal >= 0 ? "+" : ""}
                            {item.ratingDeltaFromOriginal} rating since first fail
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                        {item.retentionScore}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {item.priorityScore.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {item.reviewMode || "Not reviewed"}
                      </td>
                      <td className="px-4 py-3">
                        {item.isDismissed ? (
                          <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Dismissed
                          </span>
                        ) : item.isCompleted ? (
                          <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Mastered
                          </span>
                        ) : (
                          <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Due {timeAgo(item.nextReviewAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-500" />
        </div>
      </div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
        {value}
      </p>
    </div>
  );
}

function ReviewQueueCard({
  item,
  taxonomy,
  isLoading,
  onSubmit,
  onDismiss,
}: {
  item: ReviewItem;
  taxonomy: ReviewData["taxonomy"];
  isLoading: boolean;
  onSubmit: (
    reviewId: string,
    reviewMode: string,
    mistakeCategories: string[],
    notes: string,
  ) => Promise<void>;
  onDismiss: (reviewId: string) => Promise<void>;
}) {
  const [selectedMistakes, setSelectedMistakes] = useState<string[]>(
    item.mistakeCategories,
  );
  const [notes, setNotes] = useState("");

  function toggleMistake(category: string) {
    setSelectedMistakes((prev) =>
      prev.includes(category)
        ? prev.filter((entry) => entry !== category)
        : [...prev, category],
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={getCfProblemUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate"
            >
              {item.problemName || "Unknown Problem"}
            </a>
            {item.problemRating != null && (
              <span
                className={`text-xs font-semibold ${getRatingColorClass(item.problemRating)}`}
              >
                {item.problemRating}
              </span>
            )}
            <a
              href={getCfProblemUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-500"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {item.ratingReadinessMessage}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Priority {item.priorityScore.toFixed(1)}
            </span>
            <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              Retention {item.retentionScore}
            </span>
            <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Importance {item.importanceScore.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {item.problemTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.problemTags.map((tag) => (
            <span
              key={tag}
              className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <StageIndicator stage={item.stage} isCompleted={item.isCompleted} />

      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          What went wrong?
        </p>
        <div className="flex flex-wrap gap-2">
          {taxonomy.mistakeCategories.map((category) => {
            const active = selectedMistakes.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleMistake(category)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
                    : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional coaching note: what blocked you this time?"
        className="input-field resize-y"
      />

      {item.similarProblemRecommendations.length > 0 && (
        <div className="rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-900/10 p-3">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">
            Repair Problems
          </p>
          <div className="space-y-2">
            {item.similarProblemRecommendations.map((problem) => (
              <a
                key={`${problem.type}-${problem.contestId}-${problem.index}`}
                href={problem.cfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 text-sm text-blue-700 dark:text-blue-300 hover:underline"
              >
                <span>
                  {problem.type === "easier" ? "Easier" : "Equal"}: {problem.name}
                </span>
                <span className="font-semibold">{problem.rating}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {taxonomy.reviewModes.map((mode) => (
          <button
            key={mode}
            onClick={() => onSubmit(item.id, mode, selectedMistakes, notes)}
            disabled={isLoading}
            className="btn-secondary text-sm justify-center"
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          Last reviewed{" "}
          {item.lastReviewedAt ? timeAgo(item.lastReviewedAt) : "never"}
        </span>
        <button
          onClick={() => onDismiss(item.id)}
          disabled={isLoading}
          className="inline-flex items-center gap-1 text-red-500 hover:text-red-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  );
}

function AttemptTimeline({ attempts }: { attempts: ReviewAttempt[] }) {
  if (attempts.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
        Attempted → Failed → Waiting for first review.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {attempts.slice(0, 4).map((attempt) => (
        <div
          key={attempt.id}
          className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg"
        >
          <div
            className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
              attempt.wasSuccessful ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {attempt.outcome}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatDate(attempt.createdAt)} · next in {attempt.intervalDays} day
              {attempt.intervalDays === 1 ? "" : "s"}
            </p>
            {attempt.mistakeCategories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {attempt.mistakeCategories.slice(0, 3).map((category) => (
                  <span
                    key={category}
                    className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StageIndicator({
  stage,
  isCompleted,
}: {
  stage: number;
  isCompleted: boolean;
}) {
  const currentStage = Math.min(stage, STAGE_LABELS.length - 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Review timeline</span>
        <span>{isCompleted ? "Mastered" : STAGE_LABELS[currentStage]}</span>
      </div>
      <div className="flex items-center gap-2">
        {STAGE_LABELS.map((label, index) => {
          const filled = index <= currentStage;
          return (
            <div key={label} className="flex-1">
              <div
                className={`h-2 rounded-full ${
                  filled
                    ? "bg-blue-500"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
