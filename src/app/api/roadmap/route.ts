import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ROADMAP_MILESTONES, nextMilestone, milestoneForRating } from "@/lib/roadmap"
import { getAppSession } from "@/lib/session"

function getSolvedProblemKey(problem: {
  contestId: number | null
  problemIndex: string | null
  problemName: string | null
}) {
  if (problem.contestId != null && problem.problemIndex) {
    return `${problem.contestId}-${problem.problemIndex}`
  }

  if (problem.problemName) {
    return `name:${problem.problemName}`
  }

  return null
}

export async function GET() {
  try {
    const session = await getAppSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await prisma.cfProfile.findUnique({
      where: { userId: session.user.id },
    })

    const currentRating = profile?.rating || 0
    const current = milestoneForRating(currentRating)
    const next = nextMilestone(currentRating)

    const solvedSubmissions = profile
      ? await prisma.cfSubmission.findMany({
          where: { cfProfileId: profile.id, verdict: "OK" },
          select: {
            contestId: true,
            problemIndex: true,
            problemName: true,
            problemRating: true,
          },
        })
      : []

    // Count unique solved problems rather than accepted submissions.
    const solvedProblems = new Map<
      string,
      { rating: number | null; name: string | null }
    >()

    for (const submission of solvedSubmissions) {
      const key = getSolvedProblemKey(submission)
      if (!key || solvedProblems.has(key)) continue

      solvedProblems.set(key, {
        rating: submission.problemRating,
        name: submission.problemName,
      })
    }

    const solvedCount = solvedProblems.size
    const milestoneRatings = Array.from(
      new Set(ROADMAP_MILESTONES.map((milestone) => milestone.targetRating)),
    ).sort((a, b) => a - b)

    const milestones = ROADMAP_MILESTONES.map((m) => {
      const isReached = currentRating >= m.targetRating
      const isCurrent = next?.id === m.id || (isReached && current?.id === m.id)
      const currentRatingIndex = milestoneRatings.indexOf(m.targetRating)
      const nextRatingThreshold =
        currentRatingIndex >= 0
          ? milestoneRatings[currentRatingIndex + 1] ?? Number.POSITIVE_INFINITY
          : Number.POSITIVE_INFINITY

      const solvedInRange = Array.from(solvedProblems.values()).filter(
        (problem) =>
          problem.rating != null &&
          problem.rating >= m.targetRating &&
          problem.rating < nextRatingThreshold,
      ).length

      const progress = Math.min(
        100,
        Math.round((solvedInRange / m.problemCountTarget) * 100),
      )

      return {
        ...m,
        isReached,
        isCurrent,
        progress,
        userProblemCount: solvedInRange,
        userRating: currentRating,
      }
    })

    return NextResponse.json({
      milestones,
      currentRating,
      totalSolved: solvedCount,
      currentMilestone: current,
      nextMilestone: next,
    })
  } catch (error: any) {
    console.error("Roadmap error:", error)
    return NextResponse.json({ error: "Failed to get roadmap" }, { status: 500 })
  }
}
