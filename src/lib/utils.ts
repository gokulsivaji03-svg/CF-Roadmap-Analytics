import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCfRankColor(rank: string): string {
  const colors: Record<string, string> = {
    newbie: "text-cf-newbie",
    pupil: "text-cf-pupil",
    specialist: "text-cf-specialist",
    expert: "text-cf-expert",
    "candidate-master": "text-cf-candidate-master",
    master: "text-cf-master",
    "international-master": "text-cf-international-master",
    grandmaster: "text-cf-grandmaster",
    legendarygrandmaster: "text-cf-grandmaster",
  }
  return colors[rank.toLowerCase()] || "text-gray-500"
}

export function getRatingColor(rating: number): string {
  if (rating < 1200) return "text-cf-newbie"
  if (rating < 1400) return "text-cf-pupil"
  if (rating < 1600) return "text-cf-specialist"
  if (rating < 1900) return "text-cf-expert"
  if (rating < 2200) return "text-cf-candidate-master"
  if (rating < 2500) return "text-cf-master"
  return "text-cf-grandmaster"
}

export function getRatingBgColor(rating: number): string {
  if (rating < 1200) return "bg-gray-500"
  if (rating < 1400) return "bg-green-600"
  if (rating < 1600) return "bg-teal-500"
  if (rating < 1900) return "bg-blue-600"
  if (rating < 2200) return "bg-purple-600"
  if (rating < 2500) return "bg-orange-500"
  return "bg-red-600"
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function timeAgo(date: Date | string): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return formatDate(date)
}

export function getMistakeCategoryOptions(): string[] {
  return [
    "Misread statement",
    "Missed observation",
    "Wrong greedy",
    "Wrong math formula",
    "Implementation bug",
    "Edge case",
    "Complexity issue",
    "Data structure knowledge gap",
    "Pattern not recognized",
    "Could not start",
    "Invariant not spotted",
    "Off-by-one / indexing error",
    "Modulo / overflow mistake",
    "Graph not recognized",
    "Other",
  ]
}

export function getReviewModeOptions(): string[] {
  return [
    "Solved Easily",
    "Solved With Effort",
    "Needed Hint",
    "Needed Editorial",
    "Still Stuck",
  ]
}

export const MISTAKE_PATTERNS_MAP: Record<string, string[]> = {
  "Reading error": [
    "The operation sets the value instead of adding",
    "You missed a constraint that simplifies the solution",
    "You assumed input was sorted when it wasn't",
  ],
  "Overcomplicated": [
    "You used a hash map when only existence was needed",
    "You implemented a full search when the answer was just min/max",
    "You wrote 50 lines when 5 would do",
  ],
  "Math intuition": [
    "You struggle with modulo and LCM reasoning",
    "You couldn't derive the inequality constraints",
    "You missed parity or divisibility patterns",
  ],
}
