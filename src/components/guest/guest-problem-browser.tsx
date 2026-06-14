"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Target } from "lucide-react";

type GuestProblem = {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  cfUrl: string;
};

type RatingRange = {
  label: string;
  min: number;
  max: number;
  helper: string;
};

const suggestedRanges: RatingRange[] = [
  {
    label: "800-1000",
    min: 800,
    max: 1000,
    helper: "Good if you want warm-up problems and basic implementation reps.",
  },
  {
    label: "1100-1300",
    min: 1100,
    max: 1300,
    helper: "Good if you can solve easy Div. 3 tasks and want more pattern practice.",
  },
  {
    label: "1400-1600",
    min: 1400,
    max: 1600,
    helper: "Good if you want intermediate greedy, math, and data-structure practice.",
  },
  {
    label: "1700-1900",
    min: 1700,
    max: 1900,
    helper: "Good if you are comfortable with standard CF patterns and want harder rounds.",
  },
  {
    label: "2000-2200",
    min: 2000,
    max: 2200,
    helper: "Good if you are training for advanced contest performance.",
  },
];

function problemKey(problem: GuestProblem) {
  return `${problem.contestId}-${problem.index}`;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function GuestProblemBrowser() {
  const [selectedRange, setSelectedRange] = useState<RatingRange>(
    suggestedRanges[1],
  );
  const [problems, setProblems] = useState<GuestProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProblems() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/cf/problems?minRating=${selectedRange.min}&maxRating=${selectedRange.max}`,
        );
        const json = (await res.json()) as {
          error?: string;
          problems?: GuestProblem[];
        };

        if (!res.ok) {
          throw new Error(json.error || "Failed to load guest problems");
        }

        const uniqueProblems = Array.from(
          new Map(
            (json.problems ?? []).map((problem) => [
              problemKey(problem),
              problem,
            ]),
          ).values(),
        );

        if (!cancelled) {
          setProblems(shuffle(uniqueProblems).slice(0, 8));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load guest problems",
          );
          setProblems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProblems();

    return () => {
      cancelled = true;
    };
  }, [selectedRange]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Target className="h-6 w-6 text-blue-500" />
          Guest Practice Mode
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pick the rating band that feels right today. You can browse problems
          without signing in, then connect GitHub or Google later for tracking.
        </p>
      </div>

      <div className="card p-6">
        <p className="mb-4 text-sm font-medium text-gray-900 dark:text-white">
          Suggested ELO ranges
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suggestedRanges.map((range) => {
            const selected =
              range.min === selectedRange.min && range.max === selectedRange.max;

            return (
              <button
                key={range.label}
                type="button"
                onClick={() => setSelectedRange(range)}
                className={
                  selected
                    ? "rounded-xl border border-blue-500 bg-blue-50 p-4 text-left dark:bg-blue-900/20"
                    : "rounded-xl border border-gray-200 p-4 text-left hover:border-blue-300 dark:border-surface-border-dark"
                }
              >
                <p className="font-semibold text-gray-900 dark:text-white">
                  {range.label}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {range.helper}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              Suggested problems for {selectedRange.label}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              These are pulled from the public Codeforces problemset.
            </p>
          </div>
          <Link href="/" className="btn-secondary text-sm">
            Sign in instead
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading guest problem suggestions...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : problems.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No problems were returned for this range right now.
          </p>
        ) : (
          <div className="grid gap-3">
            {problems.map((problem) => (
              <a
                key={problemKey(problem)}
                href={problem.cfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-gray-200 p-4 hover:border-blue-300 dark:border-surface-border-dark"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {problem.contestId}
                      {problem.index}. {problem.name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        Rating {problem.rating}
                      </span>
                      {problem.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
