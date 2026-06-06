"use client";

import { useSession } from "@/app/providers";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  Search,
  Code,
  ExternalLink,
  Clock,
  Database,
  Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface Solution {
  submissionId: number;
  url: string;
  handle: string;
  rating: number | null;
  maxRating: number | null;
  rank: string | null;
  maxRank: string | null;
  language: string | undefined;
  participantType: string | undefined;
  creationTimeSeconds: number | undefined;
  timeConsumedMillis: number | undefined;
  memoryConsumedBytes: number | undefined;
}

interface JianglyResult {
  problem: {
    contestId: number;
    index: string;
    name: string | null;
    source: string;
  };
  handle: string;
  stats: {
    scannedSubmissions: number;
    acceptedMatches: number;
    returned: number;
  };
  solutions: Solution[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDate(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMemory(bytes: number | undefined): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatRuntime(ms: number | undefined): string {
  if (ms == null) return "—";
  return `${ms} ms`;
}

function participantTypeBadge(pt: string | undefined): string {
  if (!pt) return "";
  switch (pt) {
    case "CONTESTANT":
      return "badge badge-expert";
    case "PRACTICE":
      return "badge badge-pupil";
    case "VIRTUAL":
      return "badge badge-specialist";
    case "OUT_OF_COMPETITION":
      return "badge badge-candidate";
    default:
      return "badge badge-newbie";
  }
}

function participantTypeLabel(pt: string | undefined): string {
  if (!pt) return "—";
  switch (pt) {
    case "CONTESTANT":
      return "Contestant";
    case "PRACTICE":
      return "Practice";
    case "VIRTUAL":
      return "Virtual";
    case "OUT_OF_COMPETITION":
      return "Out of Competition";
    default:
      return pt;
  }
}

// ── Page Component ────────────────────────────────────────────────────

export default function JianglySolutionsPage() {
  const { data: session } = useSession();
  const [problemInput, setProblemInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JianglyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const input = problemInput.trim();
    if (!input) {
      toast.error("Enter a problem URL or shorthand (e.g. 1527/A)");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(
        `/api/cf/jiangly?problem=${encodeURIComponent(input)}&scan=20000`,
      );
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Request failed");
      }

      setResult(json as JianglyResult);

      if (json.solutions.length === 0) {
        toast("No accepted solutions found for this problem.", {
          icon: "ℹ️",
        });
      } else {
        toast.success(`Found ${json.solutions.length} solution(s)`);
      }
    } catch (err: any) {
      const msg = err.message || "Something went wrong";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  // ── Auth guard ──────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">
          Please sign in to search for Jiangly&apos;s solutions.
        </p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Code className="w-6 h-6 text-blue-500" />
          Jiangly Solution Finder
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Find accepted submissions by the legendary grandmaster{" "}
          <span className="font-semibold text-orange-500">jiangly</span> for any
          Codeforces problem.
        </p>
      </div>

      {/* ── Search Input ────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="e.g. 1527/A or https://codeforces.com/problemset/problem/1527/A"
              value={problemInput}
              onChange={(e) => setProblemInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="btn-primary shrink-0"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-1.5" />
                Find Jiangly&apos;s Solutions
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Problem URL or shorthand like &quot;1527/A&quot; (contestId / index).
        </p>
      </div>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <div className="card p-4 border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-4 animate-fade-in">
          {/* Problem info */}
          <div className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {result.problem.name ?? (
                    <span className="text-gray-400 italic">
                      Unknown problem
                    </span>
                  )}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {result.problem.contestId}
                  {result.problem.index}
                </p>
              </div>
              <a
                href={`https://codeforces.com/problemset/problem/${result.problem.contestId}/${result.problem.index}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-blue-500 hover:text-blue-600"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Open problem
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Scanned
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {result.stats.scannedSubmissions.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center shrink-0">
                <Code className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Accepted
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {result.stats.acceptedMatches}
                </p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Quickest AC
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {result.solutions.length > 0
                    ? formatRuntime(
                        Math.min(
                          ...result.solutions.map(
                            (s) => s.timeConsumedMillis ?? Infinity,
                          ),
                        ),
                      )
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Api note */}

          {/* Solutions table */}
          {result.solutions.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-surface-border-dark bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                        Submission ID
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                        Language
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                        Runtime
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                        Memory
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                        Type
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                        Date
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                        Link
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-surface-border-dark">
                    {result.solutions.map((s) => (
                      <tr
                        key={s.submissionId}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-gray-100">
                          {s.submissionId}
                        </td>
                        <td
                          className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[180px] truncate"
                          title={s.language}
                        >
                          {s.language ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {formatRuntime(s.timeConsumedMillis)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatMemory(s.memoryConsumedBytes)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={participantTypeBadge(s.participantType)}
                          >
                            {participantTypeLabel(s.participantType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(s.creationTimeSeconds)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 font-medium text-xs"
                          >
                            View
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Code className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                No accepted solutions found for this problem.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Try a different problem or increase the scan limit.
              </p>
            </div>
          )}

          {/* API note */}
          <div className="card p-4 flex items-start gap-3 border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10">
            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                Note
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                The official Codeforces API does not expose public source code.
                It only includes source with contest.status + includeSources
                when you are the contest manager. This page shows submission
                metadata (runtime, memory, language, date) from jiangly&apos;s{" "}
                <span className="font-semibold">user.status</span> — click the
                &quot;View&quot; link to open the submission on Codeforces where
                source code may be publicly visible.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!result && !error && !loading && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Code className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Enter a problem to get started
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Enter a Codeforces problem URL or shorthand like &quot;1527/A&quot;
            to find every accepted solution by <strong>jiangly</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
