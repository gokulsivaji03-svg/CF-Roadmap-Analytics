function normalizeProblemIndex(index: string) {
  return String(index).trim().toUpperCase();
}

export function getProblemWorkspaceHref(contestId: number | string, index: string) {
  return `/problems/${contestId}/${encodeURIComponent(normalizeProblemIndex(index))}`;
}

export function getCodeforcesProblemHref(
  contestId: number | string,
  index: string,
) {
  return `https://codeforces.com/problemset/problem/${contestId}/${normalizeProblemIndex(index)}`;
}

export function getCodeforcesSubmitHref(contestId?: number | null) {
  if (contestId == null) {
    return "https://codeforces.com/problemset/submit";
  }

  return `https://codeforces.com/contest/${contestId}/submit`;
}

export function getCodeforcesSubmissionHref(
  contestId: number | string,
  submissionId: number | string,
) {
  return `https://codeforces.com/contest/${contestId}/submission/${submissionId}`;
}
