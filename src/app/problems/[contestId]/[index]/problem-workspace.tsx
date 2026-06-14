"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "@/app/providers";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCode2,
  RefreshCw,
  Save,
} from "lucide-react";
import {
  getCodeforcesSubmitHref,
  getProblemWorkspaceHref,
} from "@/lib/problem-links";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-400">
      Loading editor...
    </div>
  ),
});

type WorkspaceProblem = {
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  solvedCount: number | null;
  cfUrl: string;
};

type LanguageOption = {
  id: "cpp20" | "python3" | "java17";
  label: string;
  editorLanguage: "cpp" | "python" | "java";
};

type StoredDraft = {
  language: LanguageOption["id"];
  code: string;
  updatedAt: number;
};

type VerdictState = {
  verdict: string;
  programmingLanguage: string;
  creationTimeSeconds: number | null;
  url: string;
  passedTestCount: number | null;
} | null;

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: "cpp20", label: "GNU C++20", editorLanguage: "cpp" },
  { id: "python3", label: "Python 3", editorLanguage: "python" },
  { id: "java17", label: "Java 17", editorLanguage: "java" },
];

const STARTER_TEMPLATES: Record<LanguageOption["id"], string> = {
  cpp20: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`,
  python3: `def solve():
    pass


if __name__ == "__main__":
    solve()
`,
  java17: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
    }
}
`,
};

function formatVerdict(verdict: string) {
  return verdict
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatSolvedCount(solvedCount: number | null) {
  if (solvedCount == null) return "Unknown";
  return solvedCount.toLocaleString();
}

function formatSavedAt(timestamp: number | null) {
  if (!timestamp) return "Not saved yet";

  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildJournalHref(problem: WorkspaceProblem) {
  const params = new URLSearchParams({
    openForm: "1",
    cfContestId: String(problem.contestId),
    cfProblemIndex: problem.index,
    problemName: problem.name,
    problemUrl: problem.cfUrl,
  });

  if (problem.rating != null) {
    params.set("problemRating", String(problem.rating));
  }

  if (problem.tags.length > 0) {
    params.set("problemTags", problem.tags.join(", "));
  }

  return `/journal?${params.toString()}`;
}

export function ProblemWorkspace({ problem }: { problem: WorkspaceProblem }) {
  const { data: session } = useSession();
  const defaultLanguage = LANGUAGE_OPTIONS[0].id;
  const draftStorageKey = `cf-workspace-draft:${session?.user?.id ?? "guest"}:${problem.contestId}:${problem.index}`;

  const [language, setLanguage] = useState<LanguageOption["id"]>(defaultLanguage);
  const [code, setCode] = useState(STARTER_TEMPLATES[defaultLanguage]);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState(
    "Drafts are stored locally in this browser for Phase 1.",
  );
  const [isSyncingVerdict, setIsSyncingVerdict] = useState(false);
  const [verdict, setVerdict] = useState<VerdictState>(null);
  const [verdictMessage, setVerdictMessage] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [showEmbeddedViewer, setShowEmbeddedViewer] = useState(false);

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedDraft = window.localStorage.getItem(draftStorageKey);
      if (storedDraft) {
        const parsed = JSON.parse(storedDraft) as StoredDraft;
        if (parsed.language && STARTER_TEMPLATES[parsed.language]) {
          setLanguage(parsed.language);
        }
        if (typeof parsed.code === "string" && parsed.code.length > 0) {
          setCode(parsed.code);
        }
        if (typeof parsed.updatedAt === "number") {
          setLastSavedAt(parsed.updatedAt);
          setDraftStatus(`Loaded local draft from ${formatSavedAt(parsed.updatedAt)}.`);
        }
      } else {
        setLanguage(defaultLanguage);
        setCode(STARTER_TEMPLATES[defaultLanguage]);
        setLastSavedAt(null);
        setDraftStatus("Drafts are stored locally in this browser for Phase 1.");
      }
    } catch {
      setDraftStatus("Could not load a saved draft. Continuing with a fresh editor.");
    }

    hydratedRef.current = true;
  }, [defaultLanguage, draftStorageKey]);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      try {
        const payload: StoredDraft = {
          language,
          code,
          updatedAt: Date.now(),
        };
        window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
        setLastSavedAt(payload.updatedAt);
        setDraftStatus(`Autosaved locally at ${formatSavedAt(payload.updatedAt)}.`);
      } catch {
        setDraftStatus("Autosave failed. Your browser may be blocking local storage.");
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [code, draftStorageKey, language]);

  const selectedLanguage =
    LANGUAGE_OPTIONS.find((option) => option.id === language) ?? LANGUAGE_OPTIONS[0];

  function persistDraft() {
    if (typeof window === "undefined") return;

    try {
      const payload: StoredDraft = {
        language,
        code,
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      setLastSavedAt(payload.updatedAt);
      setDraftStatus(`Saved locally at ${formatSavedAt(payload.updatedAt)}.`);
      toast.success("Draft saved locally.");
    } catch {
      setDraftStatus("Could not save your draft locally.");
      toast.error("Draft save failed.");
    }
  }

  function handleLanguageChange(nextLanguage: LanguageOption["id"]) {
    const currentTemplate = STARTER_TEMPLATES[language];
    const shouldSwapTemplate =
      code.trim().length === 0 || code === currentTemplate;

    setLanguage(nextLanguage);
    if (shouldSwapTemplate) {
      setCode(STARTER_TEMPLATES[nextLanguage]);
    }
  }

  async function handleSubmitOnCodeforces() {
    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        copied = true;
      }
    } catch {
      copied = false;
    }

    const submitUrl = getCodeforcesSubmitHref(problem.contestId);
    window.open(submitUrl, "_blank", "noopener,noreferrer");

    const message = copied
      ? "Code copied. Paste it into Codeforces, select the problem and language, then submit. Return here and click Sync verdict."
      : "Codeforces submit page opened. Copy your code manually, then submit there and return here to sync verdict.";

    setSubmitMessage(message);
    toast.success(copied ? "Code copied and submit page opened." : "Submit page opened.");
  }

  async function handleSyncVerdict() {
    if (!session?.user?.id) {
      setVerdictMessage("Sign in to sync verdict.");
      toast.error("Sign in to sync verdict.");
      return;
    }

    setIsSyncingVerdict(true);
    setVerdictMessage(null);

    try {
      const res = await fetch(
        `/api/cf/verdict?contestId=${problem.contestId}&index=${encodeURIComponent(problem.index)}`,
      );
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error || "Failed to sync verdict.");
      }

      if (!payload.submission) {
        setVerdict(null);
        setVerdictMessage(
          payload.message ||
            "No recent submission found yet. Submit on Codeforces, then sync again.",
        );
        toast("No recent submission found yet.");
        return;
      }

      setVerdict(payload.submission as VerdictState);
      setVerdictMessage(null);
      toast.success("Latest verdict synced.");
    } catch (error: any) {
      const message = error.message || "Failed to sync verdict.";
      setVerdictMessage(message);
      toast.error(message);
    } finally {
      setIsSyncingVerdict(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/daily-plan" className="hover:text-blue-500">
              Daily Plan
            </Link>
            <span>/</span>
            <span>
              {problem.contestId}
              {problem.index}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            {problem.name}
          </h1>
          <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="badge">{problem.contestId + problem.index}</span>
            {problem.rating != null && <span className="badge">{problem.rating}</span>}
            <span className="badge">Solved {formatSolvedCount(problem.solvedCount)}</span>
          </div>
        </div>

        <a
          href={problem.cfUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary inline-flex items-center justify-center"
        >
          Open Statement on Codeforces
          <ExternalLink className="ml-2 h-4 w-4" />
        </a>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <section className="space-y-6">
          <div className="card p-6">
            <div className="flex items-start gap-3">
              <FileCode2 className="mt-1 h-5 w-5 text-blue-500" />
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Problem Viewer
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Codeforces does not expose an official public problem-statement API.
                    Phase 1 keeps the editor in-app and offers a safe statement fallback.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                      Contest
                    </p>
                    <p className="mt-2 font-semibold text-gray-900 dark:text-white">
                      {problem.contestId}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                      Index
                    </p>
                    <p className="mt-2 font-semibold text-gray-900 dark:text-white">
                      {problem.index}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                      Rating
                    </p>
                    <p className="mt-2 font-semibold text-gray-900 dark:text-white">
                      {problem.rating ?? "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                      Solved Count
                    </p>
                    <p className="mt-2 font-semibold text-gray-900 dark:text-white">
                      {formatSolvedCount(problem.solvedCount)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {problem.tags.length > 0 ? (
                      problem.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        No tags available.
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    If the embedded Codeforces page does not load in your browser, keep the
                    editor here and open the official statement in a new tab.
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEmbeddedViewer((value) => !value)}
                      className="btn-secondary"
                    >
                      {showEmbeddedViewer ? "Hide Embedded Viewer" : "Try Embedded Viewer"}
                    </button>
                    <Link href={buildJournalHref(problem)} className="btn-secondary">
                      Add Journal Entry
                    </Link>
                    <Link
                      href={getProblemWorkspaceHref(problem.contestId, problem.index)}
                      className="btn-ghost"
                    >
                      Refresh Workspace
                    </Link>
                  </div>

                  {showEmbeddedViewer && (
                    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                      <iframe
                        title={`${problem.name} on Codeforces`}
                        src={problem.cfUrl}
                        className="h-[480px] w-full bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Safe Submission Flow
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Direct Codeforces submission is not available through the official public
              API. This workspace never asks for your Codeforces password, never stores
              session cookies, and never auto-submits on your behalf.
            </p>

            {submitMessage && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                {submitMessage}
              </div>
            )}

            {verdictMessage && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                {verdictMessage}
              </div>
            )}

            {verdict && (
              <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900/60 dark:bg-green-950/20">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-green-700 dark:text-green-300">
                    {formatVerdict(verdict.verdict)}
                  </span>
                  <span className="text-sm text-green-700/80 dark:text-green-300/80">
                    {verdict.programmingLanguage}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-green-700/80 dark:text-green-300/80">
                  {verdict.creationTimeSeconds ? (
                    <span>
                      Submitted{" "}
                      {new Date(verdict.creationTimeSeconds * 1000).toLocaleString("en-US")}
                    </span>
                  ) : null}
                  {verdict.passedTestCount != null ? (
                    <span>Passed tests: {verdict.passedTestCount}</span>
                  ) : null}
                  <a
                    href={verdict.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center font-medium text-green-700 underline dark:text-green-300"
                  >
                    View submission
                    <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
              Local sample runner coming later. Phase 1 does not run arbitrary code on
              the server.
            </div>
          </div>
        </section>

        <section className="card flex min-h-[760px] flex-col p-0">
          <div className="border-b border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  In-App Editor
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Draft storage: {session?.user?.id ? "scoped to your signed-in browser session" : "guest browser only"}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="language">
                  Language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(event) =>
                    handleLanguageChange(event.target.value as LanguageOption["id"])
                  }
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={persistDraft} className="btn-secondary inline-flex items-center">
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </button>
              <button
                type="button"
                onClick={handleSubmitOnCodeforces}
                className="btn-primary inline-flex items-center"
              >
                <Copy className="mr-2 h-4 w-4" />
                Submit on Codeforces
              </button>
              <button
                type="button"
                onClick={handleSyncVerdict}
                disabled={isSyncingVerdict}
                className="btn-secondary inline-flex items-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncingVerdict ? "animate-spin" : ""}`} />
                {session?.user?.id ? "Sync Verdict" : "Sign In to Sync Verdict"}
              </button>
              <a
                href={problem.cfUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost inline-flex items-center"
              >
                Open on Codeforces
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </div>

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {draftStatus} Last saved: {formatSavedAt(lastSavedAt)}.
            </p>
          </div>

          <div className="flex-1 p-4">
            <MonacoEditor
              height="100%"
              language={selectedLanguage.editorLanguage}
              value={code}
              onChange={(value) => setCode(value ?? "")}
              theme="vs-dark"
              options={{
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
