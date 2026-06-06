export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  if (value.trim() === "") return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyStringArray(value: unknown): string {
  return JSON.stringify(parseStringArray(value));
}

export function normalizeJournalEntry<T extends { problemTags: unknown }>(
  entry: T,
): T & { problemTags: string[]; mistakeCategories?: string[] } {
  return {
    ...entry,
    problemTags: parseStringArray(entry.problemTags),
    ...("mistakeCategories" in entry
      ? { mistakeCategories: parseStringArray((entry as any).mistakeCategories) }
      : {}),
  } as T & { problemTags: string[]; mistakeCategories?: string[] };
}

export function normalizeReviewItem<T extends { problemTags: unknown }>(
  item: T,
): T & {
  problemTags: string[];
  mistakeCategories?: string[];
  similarProblemRecommendations?: string[];
} {
  return {
    ...item,
    problemTags: parseStringArray(item.problemTags),
    ...("mistakeCategories" in item
      ? { mistakeCategories: parseStringArray((item as any).mistakeCategories) }
      : {}),
    ...("similarProblemRecommendations" in item
      ? {
          similarProblemRecommendations: parseStringArray(
            (item as any).similarProblemRecommendations,
          ),
        }
      : {}),
  } as T & {
    problemTags: string[];
    mistakeCategories?: string[];
    similarProblemRecommendations?: string[];
  };
}

export function normalizeContestProblem<T extends { problemTags: unknown }>(
  problem: T,
): T & { problemTags: string[] } {
  return {
    ...problem,
    problemTags: parseStringArray(problem.problemTags),
  } as T & { problemTags: string[] };
}

export function normalizeDailyPlan<T extends { items: Array<{ problemTags: unknown }> }>(
  plan: T,
): T & { items: Array<T["items"][number] & { problemTags: string[] }> } {
  return {
    ...plan,
    items: plan.items.map((item) => ({
      ...item,
      problemTags: parseStringArray(item.problemTags),
    })),
  } as T & { items: Array<T["items"][number] & { problemTags: string[] }> };
}

export function normalizeReviewAttempt<T extends { mistakeCategories: unknown }>(
  attempt: T,
): T & { mistakeCategories: string[] } {
  return {
    ...attempt,
    mistakeCategories: parseStringArray(attempt.mistakeCategories),
  } as T & { mistakeCategories: string[] };
}
