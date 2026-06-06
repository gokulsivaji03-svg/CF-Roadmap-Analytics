const CF_API_BASE = "https://codeforces.com/api"

export interface CfUserInfo {
  handle: string
  rating?: number
  maxRating?: number
  rank?: string
  maxRank?: string
  avatar?: string
  contribution?: number
  friendOfCount?: number
}

export interface CfSubmission {
  id: number
  contestId?: number
  problem?: {
    contestId?: number
    index?: string
    name?: string
    rating?: number
    tags?: string[]
  }
  verdict?: string
  programmingLanguage?: string
  timeConsumedMillis?: number
  memoryConsumedBytes?: number
  creationTimeSeconds?: number
  passedTestCount?: number
  author?: {
    participantType?: string
  }
}

export interface CfContest {
  id: number
  name?: string
  type?: string
  phase?: string
  startTimeSeconds?: number
}

export interface CfRatingChange {
  contestId: number
  contestName?: string
  rank?: number
  oldRating?: number
  newRating?: number
  ratingChange?: number
}

async function cfApi<T>(method: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${CF_API_BASE}/${method}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
  })

  if (!response.ok) {
    throw new Error(`Codeforces API HTTP ${response.status}`)
  }

  const payload = await response.json()
  if (payload.status !== "OK") {
    throw new Error(payload.comment || "Codeforces API error")
  }

  return payload.result as T
}

export async function fetchUserInfo(handle: string): Promise<CfUserInfo> {
  const users = await cfApi<CfUserInfo[]>("user.info", { handles: handle })
  return users[0]
}

export async function fetchUserSubmissions(
  handle: string,
  from = 1,
  count = 100
): Promise<CfSubmission[]> {
  return cfApi<CfSubmission[]>("user.status", {
    handle,
    from: String(from),
    count: String(count),
  })
}

export async function fetchUserRatingChanges(handle: string): Promise<CfRatingChange[]> {
  return cfApi<CfRatingChange[]>("user.rating", { handle })
}

export async function fetchContests(): Promise<CfContest[]> {
  return cfApi<CfContest[]>("contest.list", {})
}

// Jiangly solution finder - reused from original server.mjs
export async function findJianglySolutions(
  problemInput: string,
  scanLimit = 20000
) {
  const problemRef = parseProblemReference(problemInput)
  const accepted: CfSubmission[] = []

  for (let from = 1; from <= scanLimit; from += 1000) {
    const count = Math.min(1000, scanLimit - from + 1)
    const batch = await cfApi<CfSubmission[]>("user.status", {
      handle: "jiangly",
      from: String(from),
      count: String(count),
    })

    for (const submission of batch) {
      if (
        submission.verdict === "OK" &&
        submission.problem?.contestId === problemRef.contestId &&
        String(submission.problem?.index || "").toUpperCase() === problemRef.index
      ) {
        accepted.push(submission)
      }
    }

    if (batch.length < count) break
  }

  const user = await fetchUserInfo("jiangly")

  return {
    problem: {
      contestId: problemRef.contestId,
      index: problemRef.index,
      name: accepted[0]?.problem?.name || null,
      source: problemRef.source,
    },
    handle: "jiangly",
    stats: {
      scannedSubmissions: scanLimit,
      acceptedMatches: accepted.length,
      returned: accepted.length,
    },
    solutions: accepted.map((s) => ({
      submissionId: s.id,
      url: submissionUrl(problemRef, s.id),
      handle: "jiangly",
      rating: user.rating ?? null,
      maxRating: user.maxRating ?? null,
      rank: user.rank ?? null,
      maxRank: user.maxRank ?? null,
      language: s.programmingLanguage,
      participantType: s.author?.participantType,
      creationTimeSeconds: s.creationTimeSeconds,
      timeConsumedMillis: s.timeConsumedMillis,
      memoryConsumedBytes: s.memoryConsumedBytes,
    })),
  }
}

interface ProblemRef {
  raw: string
  source: string
  contestId: number
  index: string
}

function parseProblemReference(input: string): ProblemRef {
  const raw = String(input || "").trim()
  if (!raw) throw new Error("Provide a problem URL or shorthand like 1527/A")

  const urlMatch = raw.match(
    /^https?:\/\/codeforces\.com\/(?:(contest|gym)\/(\d+)\/problem\/([A-Z]\d*)|problemset\/problem\/(\d+)\/([A-Z]\d*))\/?$/i
  )
  if (urlMatch) {
    const source = urlMatch[1] || "problemset"
    const contestId = Number(urlMatch[2] || urlMatch[4])
    const index = (urlMatch[3] || urlMatch[5]).toUpperCase()
    return { raw, source, contestId, index }
  }

  const compactMatch =
    raw.match(/^(\d+)\s*[/]\s*([A-Z]\d*)$/i) || raw.match(/^(\d+)([A-Z]\d*)$/i)
  if (compactMatch) {
    return {
      raw,
      source: "contest",
      contestId: Number(compactMatch[1]),
      index: compactMatch[2].toUpperCase(),
    }
  }

  throw new Error("Unsupported problem format. Use URL or shorthand like 1527/A")
}

function submissionUrl(problemRef: ProblemRef, submissionId: number): string {
  if (problemRef.source === "gym") {
    return `https://codeforces.com/gym/${problemRef.contestId}/submission/${submissionId}`
  }
  return `https://codeforces.com/contest/${problemRef.contestId}/submission/${submissionId}`
}

// Analysis helpers
export interface WeaknessAnalysis {
  tags: { tag: string; accuracy: number; attempted: number; avgRating: number }[]
  patterns: string[]
  ratingBreakdown: { rating: number; solved: number; attempted: number }[]
}

export function analyzeWeaknesses(submissions: CfSubmission[]): WeaknessAnalysis {
  const tagMap = new Map<
    string,
    { solved: number; attempted: number; totalRating: number }
  >()
  const ratingMap = new Map<number, { solved: number; attempted: number }>()

  for (const sub of submissions) {
    if (!submissionIsRelevant(sub)) continue

    const rating = sub.problem?.rating ?? 0
    const tags = sub.problem?.tags ?? []
    const isSolved = sub.verdict === "OK"

    // Rating breakdown
    const rKey = Math.floor(rating / 100) * 100
    const rStats = ratingMap.get(rKey) || { solved: 0, attempted: 0 }
    rStats.attempted++
    if (isSolved) rStats.solved++
    ratingMap.set(rKey, rStats)

    // Tag breakdown
    for (const tag of tags) {
      const tStats = tagMap.get(tag) || { solved: 0, attempted: 0, totalRating: 0 }
      tStats.attempted++
      if (isSolved) tStats.solved++
      tStats.totalRating += rating
      tagMap.set(tag, tStats)
    }
  }

  const tags = Array.from(tagMap.entries())
    .map(([tag, stats]) => ({
      tag,
      accuracy: stats.attempted > 0 ? stats.solved / stats.attempted : 0,
      attempted: stats.attempted,
      avgRating: stats.attempted > 0 ? stats.totalRating / stats.attempted : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)

  const ratingBreakdown = Array.from(ratingMap.entries())
    .map(([rating, stats]) => ({ rating, ...stats }))
    .sort((a, b) => a.rating - b.rating)

  const patterns = detectPatterns(submissions)

  return { tags, patterns, ratingBreakdown }
}

function submissionIsRelevant(sub: CfSubmission): boolean {
  // Only consider problems, not hack or other
  return !!sub.problem?.index && sub.problem.index.match(/^[A-Z]\d*$/) !== null
}

function detectPatterns(submissions: CfSubmission[]): string[] {
  const patterns: string[] = []
  const wrongSubs = submissions.filter(
    (s) => s.verdict && s.verdict !== "OK" && s.verdict !== "TESTING"
  )

  // Check for overcomplicating: solved simple problems in complex ways (multiple wrong tries before AC)
  const problemAttempts = new Map<string, CfSubmission[]>()
  for (const sub of submissions) {
    if (!sub.problem) continue
    const key = `${sub.contestId}-${sub.problem.index}`
    const list = problemAttempts.get(key) || []
    list.push(sub)
    problemAttempts.set(key, list)
  }

  let overcomplicatedCount = 0
  for (const [, attempts] of problemAttempts) {
    const wrongCount = attempts.filter((a) => a.verdict !== "OK").length
    const hasAC = attempts.some((a) => a.verdict === "OK")
    if (wrongCount >= 3 && hasAC) overcomplicatedCount++
  }
  if (overcomplicatedCount >= 3) {
    patterns.push(
      `You tend to overcomplicate easy problems (${overcomplicatedCount} cases with 3+ wrong attempts before AC). Try stepping back and re-reading the problem statement when stuck.`
    )
  }

  // Check for implementation mistakes
  const compileErrors = wrongSubs.filter(
    (s) => s.verdict === "COMPILATION_ERROR"
  ).length
  if (compileErrors > 3) {
    patterns.push(
      `You have ${compileErrors} compilation errors. Practice writing correct syntax and check your code mentally before submitting.`
    )
  }

  // Check time limit issues
  const tlErrors = wrongSubs.filter((s) => s.verdict === "TIME_LIMIT_EXCEEDED").length
  if (tlErrors > 2) {
    patterns.push(
      `You hit ${tlErrors} time limit errors. Consider optimizing your algorithm - look for O(n²) solutions that could be O(n log n).`
    )
  }

  return patterns
}

// Problem fetching utilities
export async function fetchProblemsFromCF(
  tags: string[] = [],
  minRating = 800,
  maxRating = 1100
) {
  const params: Record<string, string> = {}
  if (tags.length > 0) params.tags = tags.join(";")

  try {
    const problems = await cfApi<{ problems: any[]; problemStatistics: any[] }>(
      "problemset.problems",
      params
    )

    return problems.problems
      .filter((p: any) => {
        const r = p.rating || 0
        return r >= minRating && r <= maxRating
      })
      .map((p: any) => ({
        contestId: p.contestId,
        index: p.index,
        name: p.name,
        rating: p.rating,
        tags: p.tags,
        cfUrl: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
      }))
  } catch {
    return []
  }
}
