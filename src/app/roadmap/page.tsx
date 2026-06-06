"use client";

import { useSession } from "@/app/providers";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Trophy,
  Target,
  Star,
  Zap,
  TrendingUp,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────

interface Milestone {
  id: string;
  title: string;
  targetRating: number;
  description: string;
  requiredTags: string[];
  requiredSkills: string[];
  problemCountTarget: number;
  contestTargets: string[];
  color: string;
  isReached: boolean;
  isCurrent: boolean;
  progress: number;
  userProblemCount: number;
  userRating: number;
}

interface RoadmapData {
  milestones: Milestone[];
  currentRating: number;
  totalSolved: number;
  currentMilestone: Milestone | null;
  nextMilestone: Milestone | null;
}

type RatingTier =
  | "newbie"
  | "pupil"
  | "specialist"
  | "expert"
  | "candidate"
  | "master"
  | "grandmaster";

// ── Helpers ────────────────────────────────────────────────────────

function tierForRating(rating: number): RatingTier {
  if (rating >= 2400) return "grandmaster";
  if (rating >= 2100) return "master";
  if (rating >= 1900) return "candidate";
  if (rating >= 1600) return "expert";
  if (rating >= 1400) return "specialist";
  if (rating >= 1200) return "pupil";
  return "newbie";
}

function tierForMilestoneColor(color: string): RatingTier {
  const map: Record<string, RatingTier> = {
    "#808080": "newbie",
    "#008000": "pupil",
    "#03a89e": "specialist",
    "#0000ff": "expert",
    "#aa00aa": "candidate",
    "#ff8c00": "master",
    "#ff0000": "grandmaster",
  };
  return map[color.toLowerCase()] ?? "newbie";
}

function ratingLabel(rating: number): string {
  if (rating >= 2400) return "Grandmaster";
  if (rating >= 2100) return "Master";
  if (rating >= 1900) return "Candidate Master";
  if (rating >= 1600) return "Expert";
  if (rating >= 1400) return "Specialist";
  if (rating >= 1200) return "Pupil";
  return "Newbie";
}

function statusLabel(m: Milestone): { text: string; className: string } {
  if (m.isReached && !m.isCurrent)
    return { text: "Reached", className: "text-green-600 dark:text-green-400" };
  if (m.isCurrent)
    return {
      text: "Current",
      className: "text-blue-600 dark:text-blue-400 animate-pulse",
    };
  return { text: "Upcoming", className: "text-gray-400 dark:text-gray-500" };
}

// ── Component ──────────────────────────────────────────────────────

export default function RoadmapPage() {
  const { data: session, status: authStatus } = useSession();

  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetchRoadmap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchRoadmap() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/roadmap");
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to load roadmap" }));
        throw new Error(err.error || "Failed to load roadmap");
      }
      const json: RoadmapData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ── Auth / loading / error guards ──────────────────────────────

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 card p-8 max-w-md">
          <Trophy className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            Please sign in to view your roadmap.
          </p>
          <Link href="/" className="btn-primary inline-flex">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 card p-8 max-w-md">
          <p className="text-red-500 dark:text-red-400">{error}</p>
          <button onClick={fetchRoadmap} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.milestones.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 card p-8 max-w-md">
          <Target className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            No roadmap data available yet. Sync your Codeforces profile to get
            started.
          </p>
          <Link href="/dashboard" className="btn-primary inline-flex">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { milestones, currentRating, totalSolved } = data;
  const currentTier = tierForRating(currentRating);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* ── Header ───────────────────────────────────────────── */}

      <div className="animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <Zap className="w-7 h-7 text-yellow-500" />
          Your Roadmap
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm sm:text-base">
          Follow this structured path to improve your Codeforces rating.
        </p>
      </div>

      {/* ── Stats Bar ────────────────────────────────────────── */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Current Rating
            </p>
            <p className={`text-lg font-bold rating-text-${currentTier}`}>
              {currentRating}
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Solved
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {totalSolved.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Next Target
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {data.nextMilestone
                ? `${data.nextMilestone.targetRating}`
                : "Max"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Milestone Path ────────────────────────────────────── */}

      <div className="relative">
        {/* Vertical connecting line (behind all milestone cards) */}
        <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

        <div className="space-y-6">
          {milestones.map((m, idx) => {
            const tier = tierForMilestoneColor(m.color);
            const status = statusLabel(m);

            return (
              <div
                key={m.id}
                className={`relative animate-fade-in`}
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {/* Timeline dot */}
                <div className="absolute left-0 top-6 hidden sm:block z-10">
                  <div
                    className={`
                      w-[47px] h-[47px] -ml-[11px] rounded-full border-4 border-white dark:border-surface-dark
                      flex items-center justify-center transition-all duration-300
                      ${
                        m.isReached
                          ? "bg-green-500 shadow-lg shadow-green-500/30"
                          : m.isCurrent
                            ? "bg-blue-500 shadow-lg shadow-blue-500/30 animate-pulse"
                            : "bg-gray-200 dark:bg-gray-700"
                      }
                    `}
                  >
                    {m.isReached && !m.isCurrent ? (
                      <Star className="w-4 h-4 text-white" />
                    ) : m.isCurrent ? (
                      <Zap className="w-4 h-4 text-white" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                    )}
                  </div>
                </div>

                {/* Milestone Card */}
                <div className="sm:ml-16">
                  <div
                    className={`
                      card overflow-hidden transition-all duration-300
                      ${
                        m.isCurrent
                          ? "ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg shadow-blue-500/10"
                          : m.isReached
                            ? "ring-1 ring-green-300 dark:ring-green-700"
                            : "hover:shadow-md"
                      }
                    `}
                  >
                    {/* Gradient accent bar at top */}
                    <div
                      className="h-1.5 w-full"
                      style={{
                        background: `linear-gradient(90deg, ${m.color}88, ${m.color}, ${m.color}88)`,
                      }}
                    />

                    <div className="p-5 sm:p-6">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                              {m.title}
                            </h2>
                            <span className={`badge badge-${tier} text-xs`}>
                              Target {m.targetRating}
                            </span>
                            <span
                              className={`text-xs font-medium ${status.className}`}
                            >
                              · {status.text}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                            {m.description}
                          </p>
                        </div>

                        {/* Mobile timeline indicator */}
                        <div
                          className="sm:hidden w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: m.isReached
                              ? "#22c55e"
                              : m.isCurrent
                                ? "#3b82f6"
                                : "#e5e7eb",
                          }}
                        >
                          {m.isReached && !m.isCurrent ? (
                            <Star className="w-4 h-4 text-white" />
                          ) : m.isCurrent ? (
                            <Zap className="w-4 h-4 text-white" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Content grid */}
                      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Left column */}
                        <div className="space-y-4">
                          {/* Required Skills */}
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                              <ChevronRight className="w-3.5 h-3.5" />
                              Required Skills
                            </h3>
                            <ul className="space-y-1">
                              {m.requiredSkills.map((skill) => (
                                <li
                                  key={skill}
                                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                                >
                                  <span
                                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: m.color }}
                                  />
                                  {skill}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Contest Targets */}
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                              <Trophy className="w-3.5 h-3.5" />
                              Contest Targets
                            </h3>
                            <ul className="space-y-1">
                              {m.contestTargets.map((target) => (
                                <li
                                  key={target}
                                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                                >
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                  {target}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-4">
                          {/* Required Tags */}
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5" />
                              Key Topics
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                              {m.requiredTags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`badge badge-${tier}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Progress */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Problem Progress
                              </h3>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                {m.userProblemCount.toLocaleString()} /{" "}
                                {m.problemCountTarget.toLocaleString()}
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{
                                  width: `${m.progress}%`,
                                  background: m.isReached
                                    ? "linear-gradient(90deg, #22c55e, #16a34a)"
                                    : `linear-gradient(90deg, ${m.color}88, ${m.color})`,
                                }}
                              />
                            </div>

                            {/* Milestone connector hint */}
                            {idx < milestones.length - 1 && (
                              <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                                <ChevronRight className="w-3 h-3" />
                                <span>
                                  Next:{" "}
                                  <span className="font-medium text-gray-600 dark:text-gray-400">
                                    {milestones[idx + 1].title}
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="text-center pt-4 pb-8">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Keep solving problems and participating in contests to progress along
          the roadmap.
        </p>
      </div>
    </div>
  );
}

// ── Loading Skeleton ────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div className="animate-pulse space-y-2">
        <div className="h-8 w-56 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-4 w-72 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-2">
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>

      <div className="space-y-6 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card overflow-hidden">
            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800" />
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-6 w-36 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-5 w-20 bg-gray-200 dark:bg-gray-800 rounded-full" />
              </div>
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
                  <div className="h-3 w-full bg-gray-200 dark:bg-gray-800 rounded" />
                  <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
                  <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded full" />
                  <div className="h-3 w-full bg-gray-200 dark:bg-gray-800 rounded" />
                  <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
