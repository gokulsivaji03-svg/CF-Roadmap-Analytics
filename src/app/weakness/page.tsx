"use client";

import { useSession } from "@/app/providers";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Target,
  AlertTriangle,
  TrendingUp,
  Activity,
  Brain,
  Lightbulb,
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
  attemptTagStats: {
    tag: string;
    totalProblems: number;
    solvedProblems: number;
    oneAttemptSolvedCount: number;
    multipleWrongProblemsCount: number;
    oneAttemptSolveRate: number;
    multipleWrongProblemRate: number;
    avgRating: number;
  }[];
  attemptDifficultyBreakdown: {
    bracket: string;
    totalProblems: number;
    solvedProblems: number;
    oneAttemptSolvedCount: number;
    multipleWrongProblemsCount: number;
  }[];
  attemptSummary: {
    totalProblemsAnalyzed: number;
    oneAttemptSolvedProblems: number;
    multipleWrongProblems: number;
  };
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

const DIFFICULTY_BRACKETS = [
  { label: "800-1000", min: 800, max: 1000, color: "#808080" },
  { label: "1100-1300", min: 1100, max: 1300, color: "#008000" },
  { label: "1400-1600", min: 1400, max: 1600, color: "#03a89e" },
  { label: "1700-1900", min: 1700, max: 1900, color: "#0000ff" },
  { label: "2000+", min: 2000, max: 5000, color: "#aa00aa" },
];

function generateInsights(data: AnalysisData): string[] {
  const insights: string[] = [];

  const weakestTag = [...data.attemptTagStats]
    .filter((tag) => tag.multipleWrongProblemsCount > 0)
    .sort((a, b) => {
      if (b.multipleWrongProblemRate !== a.multipleWrongProblemRate) {
        return b.multipleWrongProblemRate - a.multipleWrongProblemRate;
      }
      return b.multipleWrongProblemsCount - a.multipleWrongProblemsCount;
    })[0];
  const strongestTag = [...data.attemptTagStats]
    .filter((tag) => tag.solvedProblems > 0 && tag.oneAttemptSolvedCount > 0)
    .sort((a, b) => {
      if (b.oneAttemptSolveRate !== a.oneAttemptSolveRate) {
        return b.oneAttemptSolveRate - a.oneAttemptSolveRate;
      }
      return b.oneAttemptSolvedCount - a.oneAttemptSolvedCount;
    })[0];
  const hardestBracket = [...data.attemptDifficultyBreakdown].sort(
    (a, b) => b.multipleWrongProblemsCount - a.multipleWrongProblemsCount,
  )[0];
  const easiestBracket = [...data.attemptDifficultyBreakdown].sort((a, b) => {
    const aRate =
      a.totalProblems > 0 ? a.oneAttemptSolvedCount / a.totalProblems : 0;
    const bRate =
      b.totalProblems > 0 ? b.oneAttemptSolvedCount / b.totalProblems : 0;
    return bRate - aRate;
  })[0];

  if (weakestTag) {
    insights.push(
      `${weakestTag.tag} is your biggest trouble spot: ${weakestTag.multipleWrongProblemsCount} problem(s) in this tag took multiple wrong submissions.`,
    );
  }

  if (strongestTag) {
    insights.push(
      `${strongestTag.tag} is your cleanest tag right now: ${strongestTag.oneAttemptSolvedCount} problem(s) were solved on the first attempt there.`,
    );
  }

  if (hardestBracket && hardestBracket.multipleWrongProblemsCount > 0) {
    insights.push(
      `${hardestBracket.bracket} is where repeated mistakes cluster most. Slow down on those problems and write the edge cases before coding.`,
    );
  }

  if (easiestBracket && easiestBracket.totalProblems > 0) {
    const rate = Math.round(
      (easiestBracket.oneAttemptSolvedCount / easiestBracket.totalProblems) *
        100,
    );
    insights.push(
      `${easiestBracket.bracket} is your cleanest difficulty band with a ${rate}% first-try solve rate.`,
    );
  }

  if (
    data.attemptSummary.totalProblemsAnalyzed >= 10 &&
    data.attemptSummary.oneAttemptSolvedProblems /
      data.attemptSummary.totalProblemsAnalyzed <
      0.3
  ) {
    insights.push(
      "You are rarely solving problems cleanly on the first try. Spend more time planning before the first submission.",
    );
  }

  if (
    data.mistakes.some((mistake) =>
      mistake.category.toLowerCase().includes("edge"),
    )
  ) {
    insights.push(
      "Your journal still flags edge cases as a recurring issue. Add a short manual testcase checklist before each submission.",
    );
  }

  return insights;
}

function decorateDifficultyBreakdown(
  difficultyBreakdown: AnalysisData["attemptDifficultyBreakdown"],
) {
  return DIFFICULTY_BRACKETS.map((bracket) => {
    const match = difficultyBreakdown.find((item) => item.bracket === bracket.label);
    return {
      bracket: bracket.label,
      totalProblems: match?.totalProblems ?? 0,
      solvedProblems: match?.solvedProblems ?? 0,
      oneAttemptSolvedCount: match?.oneAttemptSolvedCount ?? 0,
      multipleWrongProblemsCount: match?.multipleWrongProblemsCount ?? 0,
      firstTryRate:
        match && match.totalProblems > 0
          ? match.oneAttemptSolvedCount / match.totalProblems
          : 0,
      color: bracket.color,
    };
  });
}

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f43f5e",
];

export default function WeaknessPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSync, setNeedsSync] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetchAnalysis();
  }, [session]);

  async function fetchAnalysis() {
    setLoading(true);
    try {
      const res = await fetch("/api/cf/analysis");
      if (res.status === 404) {
        setNeedsSync(true);
        return;
      }
      const json = await res.json();
      setData(json);
      setNeedsSync(false);
    } catch {
      setNeedsSync(true);
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">
          Please sign in to view your weakness analysis.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-48 card" />
        <div className="h-64 card" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 card" />
          <div className="h-48 card" />
        </div>
      </div>
    );
  }

  if (needsSync || !data) {
    return (
      <div className="max-w-lg mx-auto mt-20 animate-fade-in">
        <div className="card p-8 text-center">
          <Target className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            No Analysis Yet
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You haven&apos;t synced your Codeforces data yet. Sync from your
            dashboard to get started.
          </p>
          <Link href="/dashboard" className="btn-primary">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const {
    profile,
    tagStats = [],
    attemptTagStats = [],
    attemptDifficultyBreakdown = [],
    attemptSummary,
    mistakes = [],
  } = data;
  const weakest = [...attemptTagStats]
    .filter((tag) => tag.totalProblems >= 2 && tag.multipleWrongProblemsCount > 0)
    .sort((a, b) => {
      if (b.multipleWrongProblemRate !== a.multipleWrongProblemRate) {
        return b.multipleWrongProblemRate - a.multipleWrongProblemRate;
      }
      return b.multipleWrongProblemsCount - a.multipleWrongProblemsCount;
    })
    .slice(0, 8);
  const strongest = [...attemptTagStats]
    .filter((tag) => tag.solvedProblems >= 2 && tag.oneAttemptSolvedCount > 0)
    .sort((a, b) => {
      if (b.oneAttemptSolveRate !== a.oneAttemptSolveRate) {
        return b.oneAttemptSolveRate - a.oneAttemptSolveRate;
      }
      return b.oneAttemptSolvedCount - a.oneAttemptSolvedCount;
    })
    .slice(0, 8);
  const difficultyBreakdown = decorateDifficultyBreakdown(
    attemptDifficultyBreakdown,
  );
  const insights = generateInsights(data);

  const chartData = [...attemptTagStats]
    .filter((tag) => tag.totalProblems >= 2 && tag.multipleWrongProblemsCount > 0)
    .sort((a, b) => {
      if (b.multipleWrongProblemRate !== a.multipleWrongProblemRate) {
        return b.multipleWrongProblemRate - a.multipleWrongProblemRate;
      }
      return b.multipleWrongProblemsCount - a.multipleWrongProblemsCount;
    })
    .slice(0, 15)
    .map((t) => ({
    name: t.tag,
    multipleWrongRate: +(t.multipleWrongProblemRate * 100).toFixed(1),
    multipleWrongProblemsCount: t.multipleWrongProblemsCount,
    totalProblems: t.totalProblems,
  }));

  const pieData = difficultyBreakdown.filter((d) => d.totalProblems > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Weakness Analytics
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Deep dive into your Codeforces performance by tag and pattern
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAnalysis} className="btn-ghost">
            <Activity className="w-4 h-4 mr-1" /> Refresh
          </button>
          <Link href="/dashboard" className="btn-secondary text-sm">
            Dashboard
          </Link>
        </div>
      </div>

      {/* Profile summary */}
      <div className="card p-5 flex items-center gap-4">
        {profile.avatar && (
          <img src={profile.avatar} alt="" className="w-12 h-12 rounded-full" />
        )}
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {profile.handle}
          </p>
          <p className="text-sm text-gray-500">
            Rating: <span className="font-medium">{profile.rating}</span>{" "}
            &middot; Problems analyzed:{" "}
            <span className="font-medium">
              {attemptSummary.totalProblemsAnalyzed}
            </span>{" "}
            &middot; First-try solves:{" "}
            <span className="font-medium">
              {attemptSummary.oneAttemptSolvedProblems}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart - Multiple wrong submission tags */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-red-500" />
            Tags Most Often Requiring Multiple Wrong Submissions
          </h3>
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-500">
              No repeated-submission pattern found yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 100, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  stroke="#666"
                  tickFormatter={(v: number) => `${v}%`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  tick={{ fontSize: 12 }}
                  stroke="#666"
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "Multi-wrong rate"]}
                  labelFormatter={(label: string) => label}
                  contentStyle={{
                    background: "#1a1a1e",
                    border: "1px solid #2a2a2e",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="multipleWrongRate"
                  fill="#ef4444"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weakest Tags */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Trouble Tags
          </h3>
          {weakest.length === 0 ? (
            <p className="text-sm text-gray-500">
              No tags with multiple wrong submissions yet.
            </p>
          ) : (
            <div className="space-y-3">
              {weakest.map((t, i) => (
                <div key={t.tag}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">
                        {i + 1}.
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {t.tag}
                      </span>
                    </div>
                    <span className="text-red-500 font-medium">
                      {t.multipleWrongProblemsCount}/{t.totalProblems}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all"
                      style={{ width: `${t.multipleWrongProblemRate * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Strongest Tags */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-green-500" />
            Best First-Try Tags
          </h3>
          {strongest.length === 0 ? (
            <p className="text-sm text-gray-500">
              Solve more tagged problems to identify your strongest tags.
            </p>
          ) : (
            <div className="space-y-3">
              {strongest.map((t, i) => (
                <div key={t.tag}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">
                        {i + 1}.
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {t.tag}
                      </span>
                    </div>
                    <span className="text-green-500 font-medium">
                      {t.oneAttemptSolvedCount}/{t.solvedProblems}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${t.oneAttemptSolveRate * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Difficulty Breakdown */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            First-Try vs Retry Breakdown
          </h3>
          {difficultyBreakdown.every((d) => d.totalProblems === 0) ? (
            <p className="text-sm text-gray-500">
              Not enough data to break down by difficulty.
            </p>
          ) : (
            <div className="space-y-4">
              {difficultyBreakdown.map((d) => (
                <div key={d.bracket}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">
                      {d.bracket}
                    </span>
                    <span className="text-gray-500">
                      {d.oneAttemptSolvedCount} first try ·{" "}
                      {d.multipleWrongProblemsCount} multi-wrong ·{" "}
                      <span className="font-medium">
                        {Math.round(d.firstTryRate * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${d.firstTryRate * 100}%`,
                        backgroundColor: d.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {pieData.length > 0 && (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="totalProblems"
                    nameKey="bracket"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={entry.bracket} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${value} problems`,
                      props.payload.bracket,
                    ]}
                    contentStyle={{
                      background: "#1a1a1e",
                      border: "1px solid #2a2a2e",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center text-xs text-gray-500">
                {DIFFICULTY_BRACKETS.map((b) => (
                  <div key={b.label} className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: b.color }}
                    />
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detected Patterns & Mistakes */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Detected Patterns & Dominant Mistakes
          </h3>
          {mistakes.length === 0 ? (
            <p className="text-sm text-gray-500">
              No mistakes logged yet. Keep journaling to uncover patterns.
            </p>
          ) : (
            <div className="space-y-3">
              {mistakes.map((m) => (
                <div
                  key={m.category}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <span className="w-2 h-2 bg-amber-400 rounded-full" />
                    {m.category}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-newbie">{m.count}x</span>
                    <div
                      className="bg-amber-400 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(80, m.count * 12)}px`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly Report */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          Weekly Report & Insights
        </h3>
        {insights.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              Not enough problem-attempt data yet. Keep solving and submitting
              to generate clearer patterns.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-800"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {insight}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
