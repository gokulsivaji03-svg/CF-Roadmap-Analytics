"use client";

import { useSession } from "@/app/providers";
import { useEffect, useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  Swords,
  Timer,
  Play,
  CheckCircle,
  XCircle,
  SkipForward,
  ExternalLink,
  Trophy,
  Clock,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ContestProblem {
  id: string;
  problemContestId: number;
  problemIndex: string;
  problemName: string;
  problemRating: number;
  problemTags: string[];
  problemUrl: string;
  status: "pending" | "solved" | "attempted" | "failed" | "skipped";
  timeSpent?: number;
  hintsUsed?: number;
  solvedIndependently?: boolean;
}

interface ContestSimulation {
  id: string;
  name: string;
  difficulty: string;
  problemCount: number;
  durationMins: number;
  isActive: boolean;
  score: number;
  createdAt: string;
  completedAt: string | null;
  problems: ContestProblem[];
}

interface SimulationsResponse {
  simulations: ContestSimulation[];
}

interface ContestResponse {
  contest: ContestSimulation;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function ratingClass(rating: number): string {
  if (rating < 1200) return "rating-text-newbie";
  if (rating < 1400) return "rating-text-pupil";
  if (rating < 1600) return "rating-text-specialist";
  if (rating < 1900) return "rating-text-expert";
  if (rating < 2100) return "rating-text-candidate";
  if (rating < 2400) return "rating-text-master";
  return "rating-text-grandmaster";
}

function statusIcon(status: ContestProblem["status"]) {
  switch (status) {
    case "solved":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "attempted":
      return <Clock className="w-4 h-4 text-amber-500" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-500" />;
    case "skipped":
      return <SkipForward className="w-4 h-4 text-gray-400" />;
    default:
      return null;
  }
}

const SCORE_MAP: Record<ContestProblem["status"], number> = {
  solved: 1,
  attempted: 0,
  failed: 0,
  skipped: 0,
  pending: 0,
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ContestPage() {
  const { data: session, status: authStatus } = useSession();

  // Data
  const [simulations, setSimulations] = useState<ContestSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Active contest
  const [activeContest, setActiveContest] = useState<ContestSimulation | null>(
    null,
  );
  const [remaining, setRemaining] = useState<number | null>(null);
  const [contestEnded, setContestEnded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalizedContestIdRef = useRef<string | null>(null);

  // Fetch all simulations on mount
  const fetchSimulations = useCallback(async () => {
    try {
      const res = await fetch("/api/contest");
      if (!res.ok) throw new Error("Failed to fetch contests");
      const json: SimulationsResponse = await res.json();
      setSimulations(json.simulations);

      // Check if there's an active (in-progress) contest
      const active = json.simulations.find((s) => s.isActive);
      setActiveContest(active ?? null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") fetchSimulations();
    else if (authStatus === "unauthenticated") setLoading(false);
  }, [authStatus, fetchSimulations]);

  // Timer logic for active contest
  useEffect(() => {
    if (!activeContest) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRemaining(null);
      setContestEnded(false);
      finalizedContestIdRef.current = null;
      return;
    }

    const start = new Date(activeContest.createdAt).getTime();
    const durationMs = activeContest.durationMins * 60 * 1000;
    const end = start + durationMs;

    function tick() {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setRemaining(diff);
      if (diff <= 0) {
        setContestEnded(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }

    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeContest]);

  // Auto-refetch when contest ends (to get updated scores)
  useEffect(() => {
    if (contestEnded && activeContest) {
      fetchSimulations();
    }
  }, [contestEnded, activeContest, fetchSimulations]);

  useEffect(() => {
    if (
      !activeContest ||
      !contestEnded ||
      !activeContest.isActive ||
      finalizedContestIdRef.current === activeContest.id
    ) {
      return;
    }

    finalizedContestIdRef.current = activeContest.id;

    void (async () => {
      try {
        const res = await fetch("/api/contest", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contestId: activeContest.id, finalize: true }),
        });
        if (!res.ok) {
          throw new Error("Failed to finalize contest");
        }
        await fetchSimulations();
      } catch (err: any) {
        toast.error(err.message || "Failed to finalize contest");
        finalizedContestIdRef.current = null;
      }
    })();
  }, [contestEnded, activeContest, fetchSimulations]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleStartContest() {
    setStarting(true);
    try {
      const res = await fetch("/api/contest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5 }),
      });
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to start contest" }));
        throw new Error(error.error || "Failed to start contest");
      }
      const json: ContestResponse = await res.json();
      toast.success("Contest started!");
      setSimulations((prev) => [json.contest, ...prev]);
      setActiveContest(json.contest);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStarting(false);
    }
  }

  async function handleProblemStatus(
    contestId: string,
    problemId: string,
    status: ContestProblem["status"],
  ) {
    try {
      const res = await fetch("/api/contest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contestId, problemId, status }),
      });
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to update problem" }));
        throw new Error(error.error || "Failed to update problem");
      }

      // Optimistically update the active contest's problem list
      setActiveContest((prev) => {
        if (!prev) return prev;
        const updatedProblems = prev.problems.map((p) =>
          p.id === problemId ? { ...p, status } : p,
        );
        const updated = { ...prev, problems: updatedProblems };
        // Check if all are done
        const allDone = updatedProblems.every((p) => p.status !== "pending");
        if (allDone) {
          const score = updatedProblems.filter(
            (p) => p.status === "solved",
          ).length;
          return { ...updated, isActive: false, score };
        }
        return updated;
      });

      // Also update in the simulations list
      setSimulations((prev) =>
        prev.map((s) => {
          if (s.id !== contestId) return s;
          const updatedProblems = s.problems.map((p) =>
            p.id === problemId ? { ...p, status } : p,
          );
          const allDone = updatedProblems.every((p) => p.status !== "pending");
          const score = updatedProblems.filter(
            (p) => p.status === "solved",
          ).length;
          return { ...s, problems: updatedProblems, isActive: !allDone, score };
        }),
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // ── Auth guard ───────────────────────────────────────────────────────────

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">
          Please sign in to view contest simulations.
        </p>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-12 w-44 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 card" />
          ))}
        </div>
      </div>
    );
  }

  // ── Active contest view ──────────────────────────────────────────────────

  if (activeContest) {
    const ended = contestEnded || !activeContest.isActive;
    const problems = activeContest.problems;
    const solvedCount = problems.filter((p) => p.status === "solved").length;
    const allDone = problems.every((p) => p.status !== "pending");

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeContest.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeContest.difficulty} &middot; {activeContest.problemCount}{" "}
              problems
            </p>
          </div>

          <div className="flex items-center gap-4">
            {!ended ? (
              remaining !== null && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg font-mono font-semibold tabular-nums">
                  <Timer className="w-4 h-4" />
                  {formatTime(remaining)}
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg font-semibold">
                <Trophy className="w-4 h-4" />
                Score: {solvedCount}/{problems.length}
              </div>
            )}
          </div>
        </div>

        {/* Problems */}
        <div className="space-y-3">
          {problems.map((problem, index) => {
            const isPending = problem.status === "pending";
            const isDone = !isPending;
            const points = SCORE_MAP[problem.status];

            return (
              <div
                key={problem.id}
                className={`card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-all ${
                  isDone ? "opacity-80" : ""
                }`}
              >
                {/* Index */}
                <div className="flex items-center gap-3 sm:w-12 shrink-0">
                  <span className="text-sm font-mono text-gray-400">
                    {problem.problemIndex}
                  </span>
                  {statusIcon(problem.status)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={problem.problemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate flex items-center gap-1"
                    >
                      {problem.problemName}
                      <ExternalLink className="w-3 h-3 inline shrink-0" />
                    </a>
                    <span
                      className={`text-sm font-semibold ${ratingClass(problem.problemRating)}`}
                    >
                      {problem.problemRating}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {!ended && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      onClick={() =>
                        handleProblemStatus(
                          activeContest.id,
                          problem.id,
                          "solved",
                        )
                      }
                      disabled={!isPending}
                      className="btn-ghost text-green-600 dark:text-green-400 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Solved"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        handleProblemStatus(
                          activeContest.id,
                          problem.id,
                          "attempted",
                        )
                      }
                      disabled={!isPending}
                      className="btn-ghost text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Attempted"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        handleProblemStatus(
                          activeContest.id,
                          problem.id,
                          "failed",
                        )
                      }
                      disabled={!isPending}
                      className="btn-ghost text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Failed"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        handleProblemStatus(
                          activeContest.id,
                          problem.id,
                          "skipped",
                        )
                      }
                      disabled={!isPending}
                      className="btn-ghost text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Skip"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Score for completed items */}
                {isDone && ended && (
                  <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 shrink-0 w-8 text-right">
                    {points > 0 ? "+1" : "0"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Score breakdown when all done */}
        {allDone && ended && (
          <div className="card p-6 animate-fade-in">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Contest Complete — Score Breakdown
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {(
                [
                  {
                    label: "Solved",
                    status: "solved" as const,
                    icon: CheckCircle,
                    color: "text-green-500",
                  },
                  {
                    label: "Attempted",
                    status: "attempted" as const,
                    icon: Clock,
                    color: "text-amber-500",
                  },
                  {
                    label: "Failed",
                    status: "failed" as const,
                    icon: XCircle,
                    color: "text-red-500",
                  },
                  {
                    label: "Skipped",
                    status: "skipped" as const,
                    icon: SkipForward,
                    color: "text-gray-400",
                  },
                ] as const
              ).map(({ label, status, icon: Icon, color }) => (
                <div
                  key={status}
                  className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {problems.filter((p) => p.status === status).length}
                  </p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                Final Score: {solvedCount} / {problems.length}
              </span>
            </div>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => {
            setActiveContest(null);
            fetchSimulations();
          }}
          className="btn-ghost"
        >
          &larr; Back to contest list
        </button>
      </div>
    );
  }

  // ── Main list view ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Swords className="w-6 h-6 text-blue-500" />
            Contest Simulations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Timed practice contests at your skill level
          </p>
        </div>

        <button
          onClick={handleStartContest}
          disabled={starting}
          className="btn-primary"
        >
          {starting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start New Contest
            </>
          )}
        </button>
      </div>

      {/* Previous simulations */}
      {simulations.length === 0 ? (
        <div className="card p-12 text-center">
          <Swords className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No contests yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Start your first timed contest simulation to practice
            problem-solving under pressure.
          </p>
          <button
            onClick={handleStartContest}
            disabled={starting}
            className="btn-primary"
          >
            {starting ? "Starting..." : "Start Your First Contest"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {simulations.map((sim) => {
            const done = !sim.isActive;
            const total = sim.problems.length;
            const solved = sim.problems.filter(
              (p) => p.status === "solved",
            ).length;
            const pending = sim.problems.filter(
              (p) => p.status === "pending",
            ).length;

            return (
              <div
                key={sim.id}
                className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setActiveContest(sim);
                }}
              >
                <div className="flex items-center gap-3 shrink-0">
                  {sim.isActive ? (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Active
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full text-xs font-semibold">
                      <CheckCircle className="w-3 h-3" />
                      Done
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {sim.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {sim.difficulty} &middot;{" "}
                    {new Date(sim.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm shrink-0">
                  {done ? (
                    <>
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
                        <Trophy className="w-4 h-4" />
                        {sim.score ?? solved}/{total}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-500">{pending} remaining</span>
                      <span className="text-blue-500 text-xs font-medium">
                        Click to resume &rarr;
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
