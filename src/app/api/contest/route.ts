import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContestSimulation } from "@/lib/daily-plan-generator";
import { normalizeContestProblem } from "@/lib/serialization";
import { getAppSession } from "@/lib/session";

export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sims = await prisma.contestSimulation.findMany({
    where: { userId: session.user.id },
    include: { problems: { orderBy: { problemRating: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    simulations: sims.map((sim) => ({
      ...sim,
      problems: sim.problems.map(normalizeContestProblem),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const { count = 5, difficulty } = data;

  // Get user's rating to generate appropriate problems
  const profile = await prisma.cfProfile.findUnique({
    where: { userId: session.user.id },
  });

  const rating = profile?.rating || 800;
  const sim = await generateContestSimulation(rating, count);
  if (sim.problems.length < count) {
    return NextResponse.json(
      {
        error:
          "Not enough problems were available to generate a full contest right now. Try again in a moment.",
      },
      { status: 503 },
    );
  }

  const contest = await prisma.contestSimulation.create({
    data: {
      userId: session.user.id,
      name: `Practice Contest ${new Date().toLocaleDateString()}`,
      difficulty: sim.difficulty,
      problemCount: sim.problems.length,
      durationMins: sim.durationMins,
      problems: {
        create: sim.problems.map((p: any) => ({
          problemContestId: p.contestId,
          problemIndex: p.index,
          problemName: p.name,
          problemRating: p.rating,
          problemTags: JSON.stringify(p.tags || []),
          problemUrl: p.cfUrl,
          status: "pending",
        })),
      },
    },
    include: { problems: true },
  });

  return NextResponse.json({
    contest: {
      ...contest,
      problems: contest.problems.map(normalizeContestProblem),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const {
    contestId,
    problemId,
    status,
    timeSpent,
    hintsUsed,
    solvedIndependently,
    finalize,
  } = data;

  const contest = contestId
    ? await prisma.contestSimulation.findFirst({
        where: {
          id: contestId,
          userId: session.user.id,
        },
      })
    : null;

  if (contestId && !contest) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  if (problemId) {
    const updated = await prisma.contestProblem.updateMany({
      where: {
        id: problemId,
        ...(contestId ? { contestSimId: contestId } : {}),
      },
      data: {
        ...(status && { status }),
        ...(timeSpent !== undefined && { timeSpent }),
        ...(hintsUsed !== undefined && { hintsUsed }),
        ...(solvedIndependently !== undefined && { solvedIndependently }),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }
  }

  if (contestId) {
    const problems = await prisma.contestProblem.findMany({
      where: { contestSimId: contestId },
    });
    const allDone = problems.every((p) => p.status !== "pending");
    const shouldFinalize = Boolean(finalize) || allDone;
    const score = problems.filter((p) => p.status === "solved").length;

    if (shouldFinalize) {
      await prisma.contestSimulation.update({
        where: { id: contestId },
        data: { isActive: false, completedAt: new Date(), score },
      });
    } else {
      await prisma.contestSimulation.update({
        where: { id: contestId },
        data: { score },
      });
    }
  }

  return NextResponse.json({ success: true });
}
