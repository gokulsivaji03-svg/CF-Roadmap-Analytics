import "server-only";

import rawTagFrequencyData from "@/data/cf-tag-frequency.json";

export interface TagFrequency {
  tag: string;
  count: number;
  percentage: number;
}

export interface TagFrequencyRange {
  range_label: string;
  min_rating: number;
  max_rating: number;
  total_tagged_problems: number;
  top_tags: TagFrequency[];
  problems?: Array<{
    problem_id: string;
    rating?: number;
    tags?: string[];
  }>;
}

export interface TagFrequencyData {
  years: number;
  top_tag_limit: number;
  ranges: TagFrequencyRange[];
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

function toTagFrequencyRange(value: unknown): TagFrequencyRange | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.range_label !== "string" ||
    typeof candidate.min_rating !== "number" ||
    typeof candidate.max_rating !== "number"
  ) {
    return null;
  }

  const topTags = Array.isArray(candidate.top_tags)
    ? candidate.top_tags
        .map((tagValue) => {
          if (!tagValue || typeof tagValue !== "object") return null;

          const tagCandidate = tagValue as Record<string, unknown>;
          if (typeof tagCandidate.tag !== "string") return null;

          return {
            tag: tagCandidate.tag,
            count:
              typeof tagCandidate.count === "number" ? tagCandidate.count : 0,
            percentage:
              typeof tagCandidate.percentage === "number"
                ? tagCandidate.percentage
                : 0,
          } satisfies TagFrequency;
        })
        .filter((tag): tag is TagFrequency => tag !== null)
    : [];

  const problems = Array.isArray(candidate.problems)
    ? candidate.problems.flatMap((problemValue) => {
        if (!problemValue || typeof problemValue !== "object") return [];

        const problemCandidate = problemValue as Record<string, unknown>;
        if (typeof problemCandidate.problem_id !== "string") return [];

        return [
          {
            problem_id: problemCandidate.problem_id,
            rating:
              typeof problemCandidate.rating === "number"
                ? problemCandidate.rating
                : undefined,
            tags: Array.isArray(problemCandidate.tags)
              ? problemCandidate.tags.filter(
                  (tag): tag is string => typeof tag === "string",
                )
              : undefined,
          },
        ];
      })
    : undefined;

  return {
    range_label: candidate.range_label,
    min_rating: candidate.min_rating,
    max_rating: candidate.max_rating,
    total_tagged_problems:
      typeof candidate.total_tagged_problems === "number"
        ? candidate.total_tagged_problems
        : 0,
    top_tags: topTags,
    problems,
  };
}

function normalizeTagFrequencyData(value: unknown): TagFrequencyData {
  if (!value || typeof value !== "object") {
    return { years: 0, top_tag_limit: 0, ranges: [] };
  }

  const candidate = value as Record<string, unknown>;
  return {
    years: typeof candidate.years === "number" ? candidate.years : 0,
    top_tag_limit:
      typeof candidate.top_tag_limit === "number" ? candidate.top_tag_limit : 0,
    ranges: Array.isArray(candidate.ranges)
      ? candidate.ranges
          .map((rangeValue) => toTagFrequencyRange(rangeValue))
          .filter((range): range is TagFrequencyRange => range !== null)
      : [],
  };
}

const tagFrequencyData = normalizeTagFrequencyData(rawTagFrequencyData);

export function getRatingBucket(rating?: number | null): TagFrequencyRange | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) {
    return null;
  }

  const sortedRanges = [...tagFrequencyData.ranges].sort(
    (a, b) => a.min_rating - b.min_rating,
  );

  for (let index = 0; index < sortedRanges.length; index++) {
    const range = sortedRanges[index];
    const nextRange = sortedRanges[index + 1];
    const upperBoundIsExclusive = nextRange?.min_rating === range.max_rating;
    const inRange =
      rating >= range.min_rating &&
      (upperBoundIsExclusive ? rating < range.max_rating : rating <= range.max_rating);

    if (inRange) {
      return range;
    }
  }

  return null;
}

export function getTopTagsForRating(
  rating?: number | null,
  limit = 5,
): TagFrequency[] {
  const bucket = getRatingBucket(rating);
  if (!bucket) return [];

  return bucket.top_tags.slice(0, Math.max(0, limit)).map((tag) => ({ ...tag }));
}

export function getCommonTagBoost(problemTags: string[], rating?: number | null): number {
  const bucket = getRatingBucket(rating);
  if (!bucket || problemTags.length === 0) return 0;

  const tagLookup = new Map(
    bucket.top_tags.map((tag) => [normalizeTag(tag.tag), tag.percentage]),
  );
  const uniqueProblemTags = Array.from(
    new Set(problemTags.map((tag) => normalizeTag(tag)).filter(Boolean)),
  );

  const matchedWeight = uniqueProblemTags.reduce((total, tag) => {
    return total + (tagLookup.get(tag) ?? 0);
  }, 0);

  return Math.min(90, Math.round(matchedWeight * 1.2));
}

export function getCommonTagReasons(problemTags: string[], rating?: number | null): string[] {
  const bucket = getRatingBucket(rating);
  if (!bucket || problemTags.length === 0) return [];

  const tagLookup = new Map(
    bucket.top_tags.map((tag) => [normalizeTag(tag.tag), tag.tag]),
  );

  return Array.from(
    new Set(
      problemTags
        .map((tag) => normalizeTag(tag))
        .map((tag) => tagLookup.get(tag))
        .filter((tag): tag is string => Boolean(tag))
        .slice(0, 2)
        .map((tag) => `common ${bucket.range_label} tag: ${tag}`),
    ),
  );
}
