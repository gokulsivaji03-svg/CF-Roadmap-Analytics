import { notFound } from "next/navigation";
import { fetchProblemByContestAndIndex } from "@/lib/cf-api";
import { getCodeforcesProblemHref } from "@/lib/problem-links";
import { ProblemWorkspace } from "./problem-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProblemPageProps {
  params: {
    contestId: string;
    index: string;
  };
}

export default async function ProblemPage({ params }: ProblemPageProps) {
  const contestId = Number(params.contestId);
  const index = decodeURIComponent(params.index ?? "").trim().toUpperCase();

  if (!Number.isFinite(contestId) || !index) {
    notFound();
  }

  const problem = await fetchProblemByContestAndIndex(contestId, index);

  return (
    <ProblemWorkspace
      problem={{
        contestId,
        index,
        name: problem?.name ?? `Problem ${contestId}${index}`,
        rating: problem?.rating ?? null,
        tags: problem?.tags ?? [],
        solvedCount: problem?.solvedCount ?? null,
        cfUrl: problem?.cfUrl ?? getCodeforcesProblemHref(contestId, index),
      }}
    />
  );
}
