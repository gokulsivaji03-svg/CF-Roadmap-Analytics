export interface Milestone {
  id: string
  title: string
  targetRating: number
  description: string
  requiredTags: string[]
  requiredSkills: string[]
  problemCountTarget: number
  contestTargets: string[]
  color: string
}

export const ROADMAP_MILESTONES: Milestone[] = [
  {
    id: "800-consistency",
    title: "800 Consistency",
    targetRating: 800,
    description:
      "Solve any 800-rated problem in under 15 minutes. Focus on implementation without bugs.",
    requiredTags: ["implementation", "math"],
    requiredSkills: [
      "Basic input/output handling",
      "Simple loops and conditionals",
      "Reading problem statements carefully",
      "Avoiding silly bugs",
    ],
    problemCountTarget: 30,
    contestTargets: ["Solve at least 1 problem per contest"],
    color: "#808080",
  },
  {
    id: "900-comfort",
    title: "900 Comfort",
    targetRating: 900,
    description:
      "Handle 900-rated problems with confidence. Core focus: greedy and brute force patterns.",
    requiredTags: ["greedy", "brute force", "sortings"],
    requiredSkills: [
      "Recognizing greedy vs non-greedy",
      "Sorting-based solutions",
      "Brute force with pruning",
      "Using arrays/hash maps effectively",
    ],
    problemCountTarget: 50,
    contestTargets: ["Solve first 2 problems in Div. 2", "Rating above 900"],
    color: "#008000",
  },
  {
    id: "1000-comfort",
    title: "1000 Comfort",
    targetRating: 1000,
    description:
      "Confidently solve 1000-rated problems. Master constructive algorithms and basic DP.",
    requiredTags: ["constructive algorithms", "dp", "two pointers"],
    requiredSkills: [
      "Building constructive solutions step by step",
      "Basic DP (knapsack, LIS, LCS)",
      "Two-pointer technique",
      "Prefix sums and difference arrays",
    ],
    problemCountTarget: 80,
    contestTargets: ["Solve first 2 problems fast (< 30 min total)", "Rating above 1000"],
    color: "#03a89e",
  },
  {
    id: "1200-target",
    title: "1200 Rating - Specialist",
    targetRating: 1200,
    description:
      "Reach 1200 rating. Solid foundation in all Div. 2 A/B problems. Start on C problems.",
    requiredTags: [
      "data structures",
      "number theory",
      "combinatorics",
      "binary search",
    ],
    requiredSkills: [
      "Binary search on answer",
      "Basic number theory (gcd, mod, prime)",
      "Combinatorics (combinations, permutations)",
      "Using standard data structures (stack, queue, set, map)",
      "Reading editorial effectively",
    ],
    problemCountTarget: 150,
    contestTargets: ["Rating at 1200+", "Consistently Div. 2 A+B solved"],
    color: "#0000ff",
  },
  {
    id: "pupil",
    title: "Pupil Level",
    targetRating: 1400,
    description:
      "Consistent pupil. Start solving Div. 2 C problems and improve speed on A and B.",
    requiredTags: [
      "graphs",
      "dfs and similar",
      "math",
      "implementation",
      "constructive algorithms",
    ],
    requiredSkills: [
      "DFS/BFS on grids and graphs",
      "Understanding time complexity deeply",
      "Solving in under 1 hour for A+B+C",
      "Pattern recognition in constructive problems",
    ],
    problemCountTarget: 250,
    contestTargets: ["Rating at 1400+", "Solve Div. 2 C > 30% of the time"],
    color: "#aa00aa",
  },
  {
    id: "1400-target",
    title: "1400 Comfort",
    targetRating: 1400,
    description: "Comfortable with 1400-rated problems. Efficient problem-solving habits.",
    requiredTags: [
      "trees",
      "bitmasks",
      "probabilities",
      "divide and conquer",
    ],
    requiredSkills: [
      "Tree DP and tree traversals",
      "Bitmask techniques",
      "Divide and conquer approaches",
      "Efficient debugging",
    ],
    problemCountTarget: 400,
    contestTargets: ["Solve Div. 2 C > 60%", "Occasionally solve Div. 2 D"],
    color: "#ff8c00",
  },
  {
    id: "1600-target",
    title: "1600 Rating - Expert",
    targetRating: 1600,
    description:
      "Expert level. Consistently solve Div. 2 C and D. Strong algorithmic thinking.",
    requiredTags: [
      "advanced dp",
      "segment trees",
      "shortest paths",
      "combinatorics",
      "string algorithms",
    ],
    requiredSkills: [
      "Segment trees and Fenwick trees",
      "Dijkstra, Floyd-Warshall, Bellman-Ford",
      "Advanced DP with state compression",
      "String hashing and Z-algorithm",
      "Proof-based problem solving",
    ],
    problemCountTarget: 600,
    contestTargets: ["Rating at 1600+", "Solve Div. 2 A+B+C+D regularly"],
    color: "#ff0000",
  },
]

export function milestoneForRating(rating: number): Milestone | null {
  for (let i = ROADMAP_MILESTONES.length - 1; i >= 0; i--) {
    if (rating >= ROADMAP_MILESTONES[i].targetRating) {
      return ROADMAP_MILESTONES[i]
    }
  }
  return ROADMAP_MILESTONES[0]
}

export function nextMilestone(rating: number): Milestone | undefined {
  return ROADMAP_MILESTONES.find((m) => m.targetRating > rating)
}
