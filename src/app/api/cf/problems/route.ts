import { NextRequest, NextResponse } from "next/server"
import { fetchContests, fetchProblemsFromCF } from "@/lib/cf-api"

export async function GET(req: NextRequest) {
  try {
    const tags = req.nextUrl.searchParams.get("tags")?.split(",").filter(Boolean) || []
    const minRating = Number(req.nextUrl.searchParams.get("minRating")) || 800
    const maxRating = Number(req.nextUrl.searchParams.get("maxRating")) || 1100

    const [problems, contests] = await Promise.all([
      fetchProblemsFromCF(tags, minRating, maxRating),
      fetchContests(),
    ])
    const contestStartTimes = new Map(
      contests
        .filter((contest) => contest.startTimeSeconds != null)
        .map((contest) => [contest.id, contest.startTimeSeconds as number]),
    )

    return NextResponse.json({
      problems: problems.map((problem) => ({
        ...problem,
        contestStartTimeSeconds:
          contestStartTimes.get(problem.contestId) ?? null,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch problems" },
      { status: 500 }
    )
  }
}
