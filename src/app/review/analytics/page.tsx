"use client";

import { useSession } from "@/app/providers";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  ArrowLeft,
  TrendingUp,
  AlertTriangle,
  Target,
  BookOpen,
} from "lucide-react";

interface ReviewAnalyticsResponse {
  dashboard: {
    currentUserRating: number;
    retentionScore: number;
    reviewSuccessRate: number;
    reviewCompletionRate: number;
    editorialDependencyRate: number;
    independentSolveRate: number;
    averageReviewsBeforeMastery: number;
    estimatedRatingReadiness: {
      readyFor: number;
      needsWork: string[];
    };
  };
  analytics: {
    topFailureTags: { tag: string; count: number }[];
    mostRepeatedMistakes: { id: string; pattern: string; count: number }[];
    averageReviewsBeforeMastery: number;
    editorialDependencyRate: number;
    independentSolveRate: number;
    ratingGrowthPrediction: {
      currentRating: number;
      readyFor: number;
    };
  };
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function ReviewAnalyticsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<ReviewAnalyticsResponse | null>(null);

  useEffect(() => {
    if (!session) return;
    void fetch("/api/review")
      .then((res) => res.json())
      .then((json) => setData(json));
  }, [session]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please sign in to view review analytics.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <LineChart className="w-6 h-6 text-blue-500" />
            Review Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Trend view for retention, weak skills, and rating readiness.
          </p>
        </div>
        <Link href="/review" className="btn-secondary text-sm">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Review Queue
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Current Rating"
          value={`${data.dashboard.currentUserRating}`}
        />
        <StatCard
          icon={Target}
          label="Ready For"
          value={`${data.analytics.ratingGrowthPrediction.readyFor}`}
        />
        <StatCard
          icon={BookOpen}
          label="Independent Solve Rate"
          value={percentage(data.dashboard.independentSolveRate)}
        />
        <StatCard
          icon={AlertTriangle}
          label="Editorial Dependency"
          value={percentage(data.dashboard.editorialDependencyRate)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
            Top Failure Tags
          </h2>
          <div className="space-y-3">
            {data.analytics.topFailureTags.map((tag) => (
              <div key={tag.tag} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {tag.tag}
                </span>
                <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {tag.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
            Most Repeated Mistakes
          </h2>
          <div className="space-y-3">
            {data.analytics.mostRepeatedMistakes.slice(0, 8).map((mistake) => (
              <div
                key={mistake.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {mistake.pattern}
                </span>
                <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {mistake.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
          Coaching Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <SummaryMetric
            label="Retention score"
            value={`${data.dashboard.retentionScore}`}
          />
          <SummaryMetric
            label="Review success"
            value={percentage(data.dashboard.reviewSuccessRate)}
          />
          <SummaryMetric
            label="Avg reviews before mastery"
            value={data.dashboard.averageReviewsBeforeMastery.toFixed(1)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.dashboard.estimatedRatingReadiness.needsWork.map((tag) => (
            <span
              key={tag}
              className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            >
              Needs work: {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
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
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-500" />
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
        {value}
      </p>
    </div>
  );
}
