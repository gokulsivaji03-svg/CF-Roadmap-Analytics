import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAppSession } from "@/lib/session"
import { parseStringArray } from "@/lib/serialization"

const ATTEMPT_DIFFICULTY_BRACKETS = [
  { label: "800-1000", min: 800, max: 1000 },
  { label: "1100-1300", min: 1100, max: 1300 },
  { label: "1400-1600", min: 1400, max: 1600 },
  { label: "1700-1900", min: 1700, max: 1900 },
  { label: "2000+", min: 2000, max: Number.POSITIVE_INFINITY },
]
const RECENT_CONTEST_WINDOW_DAYS = 14

type StoredSubmission = {
  contestId: number | null
  problemIndex: string | null
  problemName: string | null
  problemRating: number | null
  problemTags: string
  verdict: string
  creationTime: Date
}

function getProblemKey(submission: StoredSubmission) {
  if (submission.contestId != null && submission.problemIndex) {
    return `${submission.contestId}-${submission.problemIndex}`
  }

  if (submission.problemName) {
    return `name:${submission.problemName}`
  }

  return null
}

function buildAttemptAnalysis(submissions: StoredSubmission[]) {
  const sortedSubmissions = [...submissions].sort(
    (a, b) => a.creationTime.getTime() - b.creationTime.getTime(),
  )
  const groupedProblems = new Map<string, StoredSubmission[]>()

  for (const submission of sortedSubmissions) {
    const key = getProblemKey(submission)
    if (!key) continue

    const attempts = groupedProblems.get(key) || []
    attempts.push(submission)
    groupedProblems.set(key, attempts)
  }

  const tagMap = new Map<
    string,
    {
      totalProblems: number
      solvedProblems: number
      oneAttemptSolvedCount: number
      multipleWrongProblemsCount: number
      totalRating: number
      ratedProblems: number
    }
  >()
  const difficultyMap = new Map(
    ATTEMPT_DIFFICULTY_BRACKETS.map((bracket) => [
      bracket.label,
      {
        bracket: bracket.label,
        totalProblems: 0,
        solvedProblems: 0,
        oneAttemptSolvedCount: 0,
        multipleWrongProblemsCount: 0,
      },
    ]),
  )

  let oneAttemptSolvedProblems = 0
  let multipleWrongProblems = 0

  for (const attempts of groupedProblems.values()) {
    const relevantAttempts = attempts.filter(
      (submission) => submission.verdict !== "TESTING",
    )
    if (relevantAttempts.length === 0) continue

    const tags = Array.from(
      new Set(
        relevantAttempts.flatMap((submission) =>
          parseStringArray(submission.problemTags),
        ),
      ),
    )
    const rating =
      relevantAttempts.find((submission) => submission.problemRating != null)
        ?.problemRating ?? null
    const firstAcceptedIndex = relevantAttempts.findIndex(
      (submission) => submission.verdict === "OK",
    )
    const solved = firstAcceptedIndex !== -1
    const wrongSubmissionCount = relevantAttempts.filter(
      (submission) => submission.verdict !== "OK",
    ).length
    const oneAttemptSolved = solved && firstAcceptedIndex === 0
    const hasMultipleWrongs = wrongSubmissionCount >= 2

    if (oneAttemptSolved) oneAttemptSolvedProblems++
    if (hasMultipleWrongs) multipleWrongProblems++

    if (rating != null) {
      const bracket = ATTEMPT_DIFFICULTY_BRACKETS.find(
        (candidate) => rating >= candidate.min && rating <= candidate.max,
      )

      if (bracket) {
        const existing = difficultyMap.get(bracket.label)
        if (existing) {
          existing.totalProblems++
          if (solved) existing.solvedProblems++
          if (oneAttemptSolved) existing.oneAttemptSolvedCount++
          if (hasMultipleWrongs) existing.multipleWrongProblemsCount++
        }
      }
    }

    for (const tag of tags) {
      const existing = tagMap.get(tag) || {
        totalProblems: 0,
        solvedProblems: 0,
        oneAttemptSolvedCount: 0,
        multipleWrongProblemsCount: 0,
        totalRating: 0,
        ratedProblems: 0,
      }

      existing.totalProblems++
      if (solved) existing.solvedProblems++
      if (oneAttemptSolved) existing.oneAttemptSolvedCount++
      if (hasMultipleWrongs) existing.multipleWrongProblemsCount++
      if (rating != null) {
        existing.totalRating += rating
        existing.ratedProblems++
      }

      tagMap.set(tag, existing)
    }
  }

  return {
    attemptTagStats: Array.from(tagMap.entries())
      .map(([tag, stats]) => ({
        tag,
        totalProblems: stats.totalProblems,
        solvedProblems: stats.solvedProblems,
        oneAttemptSolvedCount: stats.oneAttemptSolvedCount,
        multipleWrongProblemsCount: stats.multipleWrongProblemsCount,
        oneAttemptSolveRate:
          stats.solvedProblems > 0
            ? stats.oneAttemptSolvedCount / stats.solvedProblems
            : 0,
        multipleWrongProblemRate:
          stats.totalProblems > 0
            ? stats.multipleWrongProblemsCount / stats.totalProblems
            : 0,
        avgRating:
          stats.ratedProblems > 0 ? stats.totalRating / stats.ratedProblems : 0,
      }))
      .sort((a, b) => a.tag.localeCompare(b.tag)),
    attemptDifficultyBreakdown: ATTEMPT_DIFFICULTY_BRACKETS.map((bracket) =>
      difficultyMap.get(bracket.label),
    ).filter(Boolean),
    attemptSummary: {
      totalProblemsAnalyzed: groupedProblems.size,
      oneAttemptSolvedProblems,
      multipleWrongProblems,
    },
  }
}

export async function GET() {
  try {
    const session = await getAppSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await prisma.cfProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        submissions: {
          orderBy: { creationTime: "desc" },
          take: 2000,
        },
        contests: {
          orderBy: { creationTime: "desc" },
        },
        tagStats: true,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: "No CF profile found. Sync first." }, { status: 404 })
    }

    const recentContestWindowStart = new Date()
    recentContestWindowStart.setDate(
      recentContestWindowStart.getDate() - RECENT_CONTEST_WINDOW_DAYS,
    )
    const recentDailyPlans = await prisma.dailyPlan.findMany({
      where: {
        userId: session.user.id,
        date: { gte: recentContestWindowStart },
      },
      select: {
        items: {
          select: {
            problemContestId: true,
          },
        },
      },
    })

    // Generate patterns from journal entries
    const journals = await prisma.journalEntry.findMany({
      where: { userId: session.user.id },
      select: { mistakeCategory: true, takeaway: true },
    })

    const mistakeCounts: Record<string, number> = {}
    for (const j of journals) {
      if (j.mistakeCategory) {
        mistakeCounts[j.mistakeCategory] = (mistakeCounts[j.mistakeCategory] || 0) + 1
      }
    }

    const dominantMistakes = Object.entries(mistakeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }))

    // Calculate solve speed stats
    const solvedSubmissions = profile.submissions.filter((s) => s.verdict === "OK")
    const solvedProblemKeys = Array.from(
      new Set(
        solvedSubmissions
          .filter(
            (submission) =>
              submission.contestId != null && submission.problemIndex != null,
          )
          .map((submission) => `${submission.contestId}-${submission.problemIndex}`),
      ),
    )
    const avgSolveTime = solvedSubmissions.length > 0
      ? Math.round(
          solvedSubmissions.reduce((sum, s) => sum + s.timeConsumed, 0) /
            solvedSubmissions.length
        )
      : 0
    const recentContestIds = Array.from(
      new Set(
        [
          ...profile.submissions
            .filter(
              (submission) =>
                submission.contestId != null &&
                submission.creationTime >= recentContestWindowStart,
            )
            .map((submission) => submission.contestId as number),
          ...recentDailyPlans.flatMap((plan) =>
            plan.items
              .map((item) => item.problemContestId)
              .filter((contestId): contestId is number => contestId != null),
          ),
        ],
      ),
    )

    // Rating progression
    const ratingProgression = profile.contests.map((c) => ({
      contestId: c.contestId,
      contestName: c.contestName,
      oldRating: c.oldRating,
      newRating: c.newRating,
      ratingChange: c.ratingChange,
      date: c.creationTime,
    }))
    const attemptAnalysis = buildAttemptAnalysis(profile.submissions)

    return NextResponse.json({
      profile: {
        handle: profile.handle,
        rating: profile.rating,
        maxRating: profile.maxRating,
        rank: profile.rank,
        maxRank: profile.maxRank,
        avatar: profile.avatar,
      },
      stats: {
        totalSubmissions: profile.submissions.length,
        solvedCount: solvedSubmissions.length,
        avgSolveTimeMs: avgSolveTime,
        contestsParticipated: profile.contests.length,
      },
      tagStats: profile.tagStats.map((t) => ({
        tag: t.tag,
        solvedCount: t.solvedCount,
        attemptedCount: t.attemptedCount,
        avgRating: t.avgRating,
        accuracy: t.accuracy,
      })),
      attemptTagStats: attemptAnalysis.attemptTagStats,
      attemptDifficultyBreakdown: attemptAnalysis.attemptDifficultyBreakdown,
      attemptSummary: attemptAnalysis.attemptSummary,
      ratingProgression,
      mistakes: dominantMistakes,
      selectionContext: {
        solvedProblemKeys,
        recentContestIds,
        recentContestWindowDays: RECENT_CONTEST_WINDOW_DAYS,
      },
    })
  } catch (error: any) {
    console.error("Analysis error:", error)
    return NextResponse.json({ error: "Failed to get analysis" }, { status: 500 })
  }
}
