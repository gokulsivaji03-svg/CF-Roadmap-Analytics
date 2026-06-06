import { fetchProblemsFromCF } from "./cf-api"

interface PlanProblem {
  contestId: number
  index: string
  name: string
  rating: number
  tags: string[]
  cfUrl: string
}

interface DailyPlanConfig {
  rating: number
  weakTags: string[]
  failedProblems: { contestId: number; index: string; name?: string; rating?: number; tags?: string[]; url?: string }[]
  date: Date
}

export async function generateDailyPlan(config: DailyPlanConfig) {
  const { rating, weakTags, failedProblems, date } = config
  const baseRating = Math.max(800, Math.floor(rating / 100) * 100 - 200)

  // Mix of tags: prioritize weak tags + core tags
  const tagPriority = [
    ...weakTags.slice(0, 3),
    "implementation",
    "math",
    "greedy",
  ].filter(Boolean)

  // Fetch problems in the right rating range
  const [newProblems] = await Promise.all([
    fetchProblemsFromCF([], baseRating, baseRating + 300),
  ])

  const planProblems: PlanProblem[] = []

  // 1. Add failed problems for review (spaced repetition)
  const reviewProblems = failedProblems
    .filter((p) => p.rating && p.rating <= rating + 200)
    .slice(0, 2)
  for (const p of reviewProblems) {
    if (p.contestId && p.index) {
      planProblems.push({
        contestId: p.contestId,
        index: p.index,
        name: p.name || `Problem ${p.contestId}${p.index}`,
        rating: p.rating || baseRating,
        tags: p.tags || [],
        cfUrl: p.url || `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
      })
    }
  }

  // 2. Add new problems by tag priority
  const shuffled = [...newProblems].sort(() => Math.random() - 0.5)
  const used = new Set<string>()
  const needed = Math.max(3, 5 - planProblems.length)

  for (const tag of tagPriority) {
    if (planProblems.length >= 5) break
    const match = shuffled.find(
      (p: any) =>
        p.tags?.includes(tag) &&
        !used.has(`${p.contestId}-${p.index}`) &&
        p.rating &&
        p.rating >= baseRating &&
        p.rating <= baseRating + 300
    )
    if (match) {
      const key = `${match.contestId}-${match.index}`
      used.add(key)
      planProblems.push({
        contestId: match.contestId,
        index: match.index,
        name: match.name,
        rating: match.rating,
        tags: match.tags,
        cfUrl: `https://codeforces.com/problemset/problem/${match.contestId}/${match.index}`,
      })
    }
  }

  // Fill remaining with any problems in range
  for (const prob of shuffled) {
    if (planProblems.length >= 5) break
    const key = `${prob.contestId}-${prob.index}`
    if (!used.has(key) && prob.rating && prob.rating >= baseRating && prob.rating <= baseRating + 300) {
      used.add(key)
      planProblems.push({
        contestId: prob.contestId,
        index: prob.index,
        name: prob.name,
        rating: prob.rating,
        tags: prob.tags,
        cfUrl: `https://codeforces.com/problemset/problem/${prob.contestId}/${prob.index}`,
      })
    }
  }

  return {
    date,
    items: planProblems.map((p, i) => ({
      ...p,
      itemType: i < reviewProblems.length ? "review" : "practice",
      sortOrder: i,
    })),
  }
}

export async function generateContestSimulation(
  rating: number,
  count = 5,
  weakTags: string[] = []
) {
  const minRating = Math.max(800, rating - 200)
  const maxRating = rating + 200

  const problems = await fetchProblemsFromCF([], minRating, maxRating)

  const shuffled = problems.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, count).map((p: any, i: number) => ({
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    rating: p.rating,
    tags: p.tags,
    cfUrl: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
    sortOrder: i,
    status: "pending" as const,
  }))

  return {
    problems: selected,
    durationMins: count * 24, // ~24 min per problem
    difficulty: `${minRating}-${maxRating}`,
  }
}
