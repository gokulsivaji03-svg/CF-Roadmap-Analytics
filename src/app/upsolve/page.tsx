"use client";

import { useSession } from "@/app/providers";
import { getProblemWorkspaceHref } from "@/lib/problem-links";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowUpRight, ExternalLink, Layers3, Target, Trophy } from "lucide-react";

interface UpsolveProblem {
  contestId: number;
  contestName: string;
  contestStartTimeSeconds: number | null;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  solvedCount: number | null;
  cfUrl: string;
  reason: string;
}

interface ContestUpsolveSummary {
  contestId: number;
  contestName: string;
  contestStartTimeSeconds: number | null;
  contestEndTimeSeconds: number | null;
  solvedThroughIndex: string | null;
  solvedCountDuringContest: number;
  alreadyUpsolvedCount: number;
  totalProblems: number;
  recommended: UpsolveProblem[];
}

interface UpsolveResponse {
  profile: {
    handle: string;
    rating: number;
  };
  latestContest: ContestUpsolveSummary | null;
  contests: ContestUpsolveSummary[];
  pool: UpsolveProblem[];
  stats: {
    contestsParticipated: number;
    contestsWithUpsolves: number;
    totalUpsolveProblems: number;
  };
}

function formatContestDate(startTimeSeconds: number | null): string {
  if (!startTimeSeconds) return "Unknown date";
  return new Date(startTimeSeconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRating(rating: number | null): string {
  if (rating == null) return "Unrated";
  return `${rating}`;
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

export default function UpsolvePage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UpsolveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUpsolvePool = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/upsolve");
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error || "Failed to load upsolve pool");
      }

      setData(payload as UpsolveResponse);
    } catch (error: any) {
      const message = error.message || "Failed to load upsolve pool";
      setError(message);
      setData(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void fetchUpsolvePool();
  }, [fetchUpsolvePool, session]);

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Please sign in to view your upsolve pool.</p>
      </div>
    );
  }

  if (loading) {
    return <UpsolveSkeleton />;
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <ArrowUpRight className="h-6 w-6 text-blue-500" />
            Upsolve
          </h1>
        </div>
        <EmptyState
          title="Upsolve data is unavailable"
          description={
            error ??
            "Sync your Codeforces account first so we can build your contest upsolve pool."
          }
        />
      </div>
    );
  }

  const { latestContest, contests, pool, stats, profile } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <ArrowUpRight className="h-6 w-6 text-blue-500" />
            Upsolve
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Next unsolved contest problems for {profile.handle}.
          </p>
        </div>
        <Link href="/settings" className="btn-secondary inline-flex">
          Sync Codeforces
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SnapshotCard
          icon={Trophy}
          label="Contests"
          value={`${stats.contestsParticipated}`}
        />
        <SnapshotCard
          icon={Target}
          label="With Upsolves"
          value={`${stats.contestsWithUpsolves}`}
        />
        <SnapshotCard
          icon={Layers3}
          label="Pool Size"
          value={`${stats.totalUpsolveProblems}`}
        />
      </div>

      {!latestContest ? (
        <EmptyState
          title="No contest history yet"
          description="Sync your Codeforces account after a rated contest to start building an upsolve pool."
        />
      ) : (
        <section className="card p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                Latest Contest
              </p>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {latestContest.contestName}
              </h2>
              <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{formatContestDate(latestContest.contestStartTimeSeconds)}</span>
                <span className="h-1 w-1 self-center rounded-full bg-gray-300 dark:bg-gray-700" />
                <span>
                  Solved through {latestContest.solvedThroughIndex ?? "none"}
                </span>
                <span className="h-1 w-1 self-center rounded-full bg-gray-300 dark:bg-gray-700" />
                <span>
                  {latestContest.solvedCountDuringContest} solved in contest
                </span>
                <span className="h-1 w-1 self-center rounded-full bg-gray-300 dark:bg-gray-700" />
                <span>
                  {latestContest.alreadyUpsolvedCount} already upsolved later
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {latestContest.recommended.length > 0 ? (
              latestContest.recommended.map((problem) => (
                <ProblemCard
                  key={`${problem.contestId}-${problem.index}`}
                  problem={problem}
                />
              ))
            ) : (
              <EmptyState
                title="No unsolved next-step problems here"
                description="You already cleared the next recommended slots from your latest contest."
              />
            )}
          </div>
        </section>
      )}

      <section className="card p-6 sm:p-7">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Upsolve Pool
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Up to two next unsolved problems from each contest.
          </p>
        </div>

        {pool.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="Nothing in the pool right now"
              description="Either you cleared your tracked contest gaps already, or you need more contest history."
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {contests.map((contest) => (
              <div
                key={contest.contestId}
                className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {contest.contestName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Solved through {contest.solvedThroughIndex ?? "none"} •{" "}
                      {formatContestDate(contest.contestStartTimeSeconds)} •{" "}
                      {contest.alreadyUpsolvedCount} already upsolved
                    </p>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {contest.recommended.length} target
                    {contest.recommended.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {contest.recommended.map((problem) => (
                    <ProblemCard
                      key={`${problem.contestId}-${problem.index}`}
                      problem={problem}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UpsolveSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-pulse">
      <div className="h-10 w-56 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card h-28" />
        <div className="card h-28" />
        <div className="card h-28" />
      </div>
      <div className="card h-80" />
      <div className="card h-96" />
    </div>
  );
}

function SnapshotCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
        <div className="rounded-xl bg-gray-100 p-2 dark:bg-gray-800">
          <Icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </div>
      </div>
    </div>
  );
}

function ProblemCard({ problem }: { problem: UpsolveProblem }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {problem.index}
          </p>
          <h4 className="mt-1 font-semibold text-gray-900 dark:text-white">
            {problem.name}
          </h4>
        </div>
        <span
          className={`text-sm font-semibold ${getRatingColorClass(problem.rating)}`}
        >
          {formatRating(problem.rating)}
        </span>
      </div>

      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
        {problem.reason}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {problem.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {problem.contestName}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={getProblemWorkspaceHref(problem.contestId, problem.index)}
            className="btn-secondary inline-flex"
          >
            Solve in App
          </Link>
          <a
            href={problem.cfUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost inline-flex"
          >
            Open
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-5 dark:border-gray-800">
      <p className="font-medium text-gray-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}
