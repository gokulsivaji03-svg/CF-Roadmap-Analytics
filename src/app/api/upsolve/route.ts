import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchContests, fetchProblemsFromCF } from "@/lib/cf-api";
import { getAppSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatalogProblem = {
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  solvedCount: number | null;
  cfUrl: string;
};

type ContestUpsolveProblem = CatalogProblem & {
  contestName: string;
  contestStartTimeSeconds: number | null;
  reason: string;
};

type ContestUpsolveSummary = {
  contestId: number;
  contestName: string;
  contestStartTimeSeconds: number | null;
  contestEndTimeSeconds: number | null;
  solvedThroughIndex: string | null;
  solvedCountDuringContest: number;
  alreadyUpsolvedCount: number;
  totalProblems: number;
  recommended: ContestUpsolveProblem[];
};

function parseProblemIndex(index: string) {
  const match = String(index).toUpperCase().match(/^([A-Z]+)(\d+)?$/);
  if (!match) {
    return { letters: String(index).toUpperCase(), number: 0 };
  }

  return {
    letters: match[1],
    number: Number(match[2] ?? 0),
  };
}

function compareProblemIndex(a: string, b: string) {
  const left = parseProblemIndex(a);
  const right = parseProblemIndex(b);

  if (left.letters !== right.letters) {
    return left.letters.localeCompare(right.letters);
  }

  return left.number - right.number;
}

function buildReason(solvedThroughIndex: string | null, problemIndex: string) {
  if (!solvedThroughIndex) {
    return `Start with ${problemIndex} from this contest`;
  }

  return `You solved through ${solvedThroughIndex}; next target is ${problemIndex}`;
}

function getSolveBucket(
  solvedAt: Date,
  contestStartTimeSeconds: number | null,
  contestEndTimeSeconds: number | null,
) {
  const solvedAtSeconds = Math.floor(solvedAt.getTime() / 1000);

  if (contestStartTimeSeconds == null || contestEndTimeSeconds == null) {
    return "unknown";
  }

  if (
    solvedAtSeconds >= contestStartTimeSeconds &&
    solvedAtSeconds <= contestEndTimeSeconds
  ) {
    return "during";
  }

  if (solvedAtSeconds > contestEndTimeSeconds) {
    return "after";
  }

  return "before";
}

export async function GET() {
  try {
    const session = await getAppSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.cfProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        handle: true,
        rating: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "No Codeforces handle connected yet. Connect your handle in Settings and sync first.",
        },
        { status: 404 },
      );
    }

    const [contestHistory, submissions] = await Promise.all([
      prisma.cfContest.findMany({
        where: { cfProfileId: profile.id },
        select: {
          contestId: true,
          contestName: true,
        },
      }),
      prisma.cfSubmission.findMany({
        where: {
          cfProfileId: profile.id,
          contestId: { not: null },
          problemIndex: { not: null },
          verdict: "OK",
        },
        select: {
          contestId: true,
          problemIndex: true,
          creationTime: true,
        },
      }),
    ]);

    if (contestHistory.length === 0) {
      return NextResponse.json({
        profile: {
          handle: profile.handle,
          rating: profile.rating,
        },
        latestContest: null,
        contests: [],
        pool: [],
        stats: {
          contestsParticipated: 0,
          contestsWithUpsolves: 0,
          totalUpsolveProblems: 0,
        },
      });
    }

    const [catalog, contests] = await Promise.all([
      fetchProblemsFromCF([], 0, 4000),
      fetchContests(),
    ]);

    if (catalog.length === 0) {
      return NextResponse.json(
        { error: "Could not load the Codeforces problem catalog right now." },
        { status: 503 },
      );
    }

    const contestIds = new Set(contestHistory.map((contest) => contest.contestId));
    const contestMeta = new Map(
      contests.map((contest) => [
        contest.id,
        {
          name: contest.name ?? null,
          startTimeSeconds: contest.startTimeSeconds ?? null,
          durationSeconds: contest.durationSeconds ?? null,
        },
      ]),
    );

    const solvedDuringContestByContest = new Map<number, Set<string>>();
    const solvedAfterContestByContest = new Map<number, Set<string>>();
    for (const submission of submissions) {
      if (submission.contestId == null || !submission.problemIndex) continue;

      const contestTiming = contestMeta.get(submission.contestId);
      const contestStartTimeSeconds = contestTiming?.startTimeSeconds ?? null;
      const contestEndTimeSeconds =
        contestStartTimeSeconds != null && contestTiming?.durationSeconds != null
          ? contestStartTimeSeconds + contestTiming.durationSeconds
          : null;
      const bucket = getSolveBucket(
        submission.creationTime,
        contestStartTimeSeconds,
        contestEndTimeSeconds,
      );

      if (bucket === "during" || bucket === "unknown") {
        const solved =
          solvedDuringContestByContest.get(submission.contestId) ?? new Set<string>();
        solved.add(submission.problemIndex);
        solvedDuringContestByContest.set(submission.contestId, solved);
      }

      if (bucket === "after" || bucket === "unknown") {
        const upsolved =
          solvedAfterContestByContest.get(submission.contestId) ?? new Set<string>();
        upsolved.add(submission.problemIndex);
        solvedAfterContestByContest.set(submission.contestId, upsolved);
      }
    }

    const problemsByContest = new Map<number, CatalogProblem[]>();
    for (const problem of catalog) {
      if (!contestIds.has(problem.contestId)) continue;

      const existing = problemsByContest.get(problem.contestId) ?? [];
      existing.push(problem);
      problemsByContest.set(problem.contestId, existing);
    }

    const contestSummaries: ContestUpsolveSummary[] = contestHistory
      .map((contest) => {
        const sortedProblems = [...(problemsByContest.get(contest.contestId) ?? [])].sort(
          (a, b) => compareProblemIndex(a.index, b.index),
        );
        const contestTiming = contestMeta.get(contest.contestId);
        const contestStartTimeSeconds = contestTiming?.startTimeSeconds ?? null;
        const contestEndTimeSeconds =
          contestStartTimeSeconds != null && contestTiming?.durationSeconds != null
            ? contestStartTimeSeconds + contestTiming.durationSeconds
            : null;
        const solvedDuringContest =
          solvedDuringContestByContest.get(contest.contestId) ?? new Set<string>();
        const solvedAfterContest =
          solvedAfterContestByContest.get(contest.contestId) ?? new Set<string>();

        let solvedPrefixLength = 0;
        while (
          solvedPrefixLength < sortedProblems.length &&
          solvedDuringContest.has(sortedProblems[solvedPrefixLength].index)
        ) {
          solvedPrefixLength += 1;
        }

        const solvedThroughIndex =
          solvedPrefixLength > 0
            ? sortedProblems[solvedPrefixLength - 1].index
            : null;

        const recommended = sortedProblems
          .slice(solvedPrefixLength)
          .filter(
            (problem) =>
              !solvedDuringContest.has(problem.index) &&
              !solvedAfterContest.has(problem.index),
          )
          .slice(0, 2)
          .map((problem) => ({
            ...problem,
            contestName:
              contestMeta.get(contest.contestId)?.name ??
              contest.contestName ??
              `Contest ${contest.contestId}`,
            contestStartTimeSeconds,
            reason: buildReason(solvedThroughIndex, problem.index),
          }));

        return {
          contestId: contest.contestId,
          contestName:
            contestMeta.get(contest.contestId)?.name ??
            contest.contestName ??
            `Contest ${contest.contestId}`,
          contestStartTimeSeconds,
          contestEndTimeSeconds,
          solvedThroughIndex,
          solvedCountDuringContest: solvedDuringContest.size,
          alreadyUpsolvedCount: solvedAfterContest.size,
          totalProblems: sortedProblems.length,
          recommended,
        };
      })
      .filter((contest) => contest.totalProblems > 0)
      .sort((a, b) => {
        const left = a.contestStartTimeSeconds ?? 0;
        const right = b.contestStartTimeSeconds ?? 0;
        if (left !== right) return right - left;
        return b.contestId - a.contestId;
      });

    const latestContest = contestSummaries[0] ?? null;
    const contestsWithUpsolves = contestSummaries.filter(
      (contest) => contest.recommended.length > 0,
    );
    const pool = contestsWithUpsolves.flatMap((contest) => contest.recommended);

    return NextResponse.json({
      profile: {
        handle: profile.handle,
        rating: profile.rating,
      },
      latestContest,
      contests: contestsWithUpsolves,
      pool,
      stats: {
        contestsParticipated: contestSummaries.length,
        contestsWithUpsolves: contestsWithUpsolves.length,
        totalUpsolveProblems: pool.length,
      },
    });
  } catch (error: any) {
    console.error("Upsolve error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to build upsolve pool" },
      { status: 500 },
    );
  }
}
