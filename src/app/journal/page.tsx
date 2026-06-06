"use client";

import { useSession } from "@/app/providers";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  BookOpen,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { getMistakeCategoryOptions } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface JournalEntry {
  id: string;
  problemId: string | null;
  cfContestId: number | null;
  cfProblemIndex: string | null;
  problemName: string | null;
  problemRating: number | null;
  problemTags: string[];
  problemUrl: string | null;
  initialIdea: string | null;
  whatTried: string | null;
  whereGotStuck: string | null;
  hintsUsed: string | null;
  finalInsight: string | null;
  mistakeCategory: string | null;
  mistakeCategories: string[];
  takeaway: string | null;
  solvedIndependently: boolean;
  timeSpent: number | null;
  confidenceLevel: number | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Default form state                                                 */
/* ------------------------------------------------------------------ */

const emptyForm = {
  problemId: "",
  cfContestId: "",
  cfProblemIndex: "",
  problemName: "",
  problemRating: "",
  problemTags: "",
  problemUrl: "",
  initialIdea: "",
  whatTried: "",
  whereGotStuck: "",
  hintsUsed: "",
  finalInsight: "",
  mistakeCategories: [] as string[],
  takeaway: "",
  solvedIndependently: false,
  timeSpent: "",
  confidenceLevel: "",
};

type FormState = typeof emptyForm;

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function JournalPage() {
  const { data: session } = useSession();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({ ...emptyForm });

  const mistakeOptions = getMistakeCategoryOptions();

  /* ----- Fetch entries ----- */
  useEffect(() => {
    if (!session) return;
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchEntries() {
    setLoading(true);
    try {
      const res = await fetch("/api/journal");
      if (!res.ok) throw new Error("Failed to fetch journal entries");
      const json = await res.json();
      setEntries(json.entries ?? []);
    } catch (err: any) {
      toast.error(err.message || "Could not load journal");
    } finally {
      setLoading(false);
    }
  }

  /* ----- Create entry ----- */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = { ...form };

      // Parse numeric fields
      if (payload.cfContestId)
        payload.cfContestId = Number(payload.cfContestId);
      else payload.cfContestId = null;
      if (payload.problemRating)
        payload.problemRating = Number(payload.problemRating);
      else payload.problemRating = null;
      if (payload.timeSpent) payload.timeSpent = Number(payload.timeSpent);
      else payload.timeSpent = null;
      if (payload.confidenceLevel)
        payload.confidenceLevel = Number(payload.confidenceLevel);
      else payload.confidenceLevel = null;

      // Parse tags
      if (typeof payload.problemTags === "string") {
        payload.problemTags = (payload.problemTags as string)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }

      // Convert empty strings to null
      for (const key of Object.keys(payload)) {
        if (payload[key] === "") payload[key] = null;
      }

      // Ensure boolean
      payload.solvedIndependently = Boolean(payload.solvedIndependently);

      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save entry");
      }

      toast.success("Journal entry saved!");
      setForm({ ...emptyForm });
      setShowForm(false);
      await fetchEntries();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  /* ----- Delete entry ----- */
  async function handleDelete(id: string) {
    if (!confirm("Delete this journal entry?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/journal?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      toast.success("Entry deleted");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  /* ----- Expand / collapse ----- */
  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMistakeCategory(category: string) {
    setForm((prev) => ({
      ...prev,
      mistakeCategories: prev.mistakeCategories.includes(category)
        ? prev.mistakeCategories.filter((item) => item !== category)
        : [...prev.mistakeCategories, category],
    }));
  }

  /* ----- Auth guard ----- */
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please sign in to view your journal.</p>
      </div>
    );
  }

  /* ----- Loading state ----- */
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 space-y-3">
            <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const isExpanded = (id: string) => expandedIds.has(id);

  /* ----- Render ----- */
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-500" />
            Problem Journal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Log what you learned from each problem you attempt.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus className="w-4 h-4 mr-1" />
          New Entry
        </button>
      </div>

      {/* New-entry form */}
      {showForm && (
        <div className="card p-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            New Journal Entry
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row: problem identifiers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Problem URL
                </label>
                <input
                  type="text"
                  placeholder="https://codeforces.com/contest/..."
                  value={form.problemUrl}
                  onChange={(e) =>
                    setForm({ ...form, problemUrl: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contest ID
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2050"
                  value={form.cfContestId}
                  onChange={(e) =>
                    setForm({ ...form, cfContestId: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Problem Index
                </label>
                <input
                  type="text"
                  placeholder="e.g. A, B, C1"
                  value={form.cfProblemIndex}
                  onChange={(e) =>
                    setForm({ ...form, cfProblemIndex: e.target.value })
                  }
                  className="input-field"
                />
              </div>
            </div>

            {/* Row: name, rating, tags */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Problem Name
                </label>
                <input
                  type="text"
                  placeholder="Name of the problem"
                  value={form.problemName}
                  onChange={(e) =>
                    setForm({ ...form, problemName: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rating
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={form.problemRating}
                  onChange={(e) =>
                    setForm({ ...form, problemRating: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="dp, greedy, math"
                  value={form.problemTags}
                  onChange={(e) =>
                    setForm({ ...form, problemTags: e.target.value })
                  }
                  className="input-field"
                />
              </div>
            </div>

            {/* Textareas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Idea
              </label>
              <textarea
                rows={2}
                placeholder="What was your first approach?"
                value={form.initialIdea}
                onChange={(e) =>
                  setForm({ ...form, initialIdea: e.target.value })
                }
                className="input-field resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                What I Tried
              </label>
              <textarea
                rows={2}
                placeholder="What did you attempt to implement?"
                value={form.whatTried}
                onChange={(e) =>
                  setForm({ ...form, whatTried: e.target.value })
                }
                className="input-field resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Where I Got Stuck
              </label>
              <textarea
                rows={2}
                placeholder="What was the blocker?"
                value={form.whereGotStuck}
                onChange={(e) =>
                  setForm({ ...form, whereGotStuck: e.target.value })
                }
                className="input-field resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hints Used
              </label>
              <textarea
                rows={2}
                placeholder="What hints or editorial sections did you read?"
                value={form.hintsUsed}
                onChange={(e) =>
                  setForm({ ...form, hintsUsed: e.target.value })
                }
                className="input-field resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Final Insight
              </label>
              <textarea
                rows={2}
                placeholder="What was the key observation that solved it?"
                value={form.finalInsight}
                onChange={(e) =>
                  setForm({ ...form, finalInsight: e.target.value })
                }
                className="input-field resize-y"
              />
            </div>

            {/* Mistake taxonomy + takeaway */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mistake Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {mistakeOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleMistakeCategory(opt)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        form.mistakeCategories.includes(opt)
                          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
                          : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Takeaway
                </label>
                <textarea
                  rows={2}
                  placeholder="What will you remember next time?"
                  value={form.takeaway}
                  onChange={(e) =>
                    setForm({ ...form, takeaway: e.target.value })
                  }
                  className="input-field resize-y"
                />
              </div>
            </div>

            {/* Row: checkboxes + number inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="solvedIndependently"
                  checked={form.solvedIndependently}
                  onChange={(e) =>
                    setForm({ ...form, solvedIndependently: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="solvedIndependently"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Solved independently
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time Spent (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 45"
                  value={form.timeSpent}
                  onChange={(e) =>
                    setForm({ ...form, timeSpent: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confidence (1-10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  placeholder="1-10"
                  value={form.confidenceLevel}
                  onChange={(e) =>
                    setForm({ ...form, confidenceLevel: e.target.value })
                  }
                  className="input-field"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? "Saving..." : "Save Entry"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm({ ...emptyForm });
                  setShowForm(false);
                }}
                className="btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && !loading && (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            No journal entries yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Start logging your problem-solving journey.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-1" />
            First Entry
          </button>
        </div>
      )}

      {/* Entries list */}
      <div className="space-y-4">
        {entries.map((entry) => {
          const expanded = isExpanded(entry.id);
          return (
            <div key={entry.id} className="card p-5 animate-fade-in">
              {/* Card header */}
              <div className="flex items-start justify-between gap-4">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => toggleExpand(entry.id)}
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                    {entry.problemName || "Untitled Problem"}
                    {entry.problemRating && (
                      <span className="badge badge-expert text-xs">
                        {entry.problemRating}
                      </span>
                    )}
                    {entry.solvedIndependently ? (
                      <span className="badge badge-pupil text-xs">Solved</span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                        Needed Help
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatDate(entry.createdAt)}
                    {entry.timeSpent != null && ` · ${entry.timeSpent}m`}
                    {entry.confidenceLevel != null &&
                      ` · Confidence: ${entry.confidenceLevel}/10`}
                  </p>
                  {entry.problemTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {entry.problemTags.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                      {entry.problemTags.length > 5 && (
                        <span className="badge bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                          +{entry.problemTags.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {entry.problemUrl && (
                    <a
                      href={entry.problemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost p-2"
                      title="Open problem"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    className="btn-ghost p-2"
                    title={expanded ? "Collapse" : "Expand"}
                  >
                    {expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="btn-ghost p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded body */}
              {expanded && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3 animate-fade-in">
                  <FieldDisplay
                    label="Problem URL"
                    value={entry.problemUrl}
                    isUrl
                  />
                  <FieldDisplay
                    label="Contest ID / Index"
                    value={
                      entry.cfContestId != null
                        ? `${entry.cfContestId}${entry.cfProblemIndex ?? ""}`
                        : null
                    }
                  />
                  <FieldDisplay
                    label="Initial Idea"
                    value={entry.initialIdea}
                  />
                  <FieldDisplay label="What I Tried" value={entry.whatTried} />
                  <FieldDisplay
                    label="Where I Got Stuck"
                    value={entry.whereGotStuck}
                  />
                  <FieldDisplay label="Hints Used" value={entry.hintsUsed} />
                  <FieldDisplay
                    label="Final Insight"
                    value={entry.finalInsight}
                  />
                  {entry.mistakeCategories.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Mistake Categories
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {entry.mistakeCategories.map((category) => (
                          <span
                            key={category}
                            className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <FieldDisplay label="Takeaway" value={entry.takeaway} />
                  {entry.problemTags.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tags
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {entry.problemTags.map((tag) => (
                          <span
                            key={tag}
                            className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <InfoChip
                      label="Solved independently"
                      value={entry.solvedIndependently ? "Yes" : "No"}
                    />
                    <InfoChip
                      label="Time spent"
                      value={
                        entry.timeSpent != null ? `${entry.timeSpent}m` : "—"
                      }
                    />
                    <InfoChip
                      label="Confidence"
                      value={
                        entry.confidenceLevel != null
                          ? `${entry.confidenceLevel}/10`
                          : "—"
                      }
                    />
                    <InfoChip
                      label="Attempts"
                      value={String(entry.attemptCount)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper sub-components                                              */
/* ------------------------------------------------------------------ */

function FieldDisplay({
  label,
  value,
  isUrl,
}: {
  label: string;
  value: string | null | undefined;
  isUrl?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      {isUrl ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1 text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <p className="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
          {value}
        </p>
      )}
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
