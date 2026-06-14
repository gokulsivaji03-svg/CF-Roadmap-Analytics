import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeDailyPlan } from "@/lib/serialization";
import { getAppSession } from "@/lib/session";
import { generateDailyPlan } from "@/lib/daily-plan-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_CONTEST_WINDOW_DAYS = 14;

function serializeDailyPlan<
  T extends { items: Array<{ problemTags: unknown; notes?: string | null }> },
>(plan: T) {
  const normalized = normalizeDailyPlan(plan);

  return {
    ...normalized,
    items: normalized.items.map((item) => ({
      ...item,
      reasonLabels: (() => {
        if (typeof item.notes !== "string" || item.notes.trim() === "") return [];

        try {
          const parsed = JSON.parse(item.notes);
          return Array.isArray(parsed)
            ? parsed.filter((reason): reason is string => typeof reason === "string")
            : [];
        } catch {
          return [];
        }
      })(),
    })),
  };
}

export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const plan = await prisma.dailyPlan.findFirst({
    where: {
      userId: session.user.id,
      date: {
        gte: today,
        lt: new Date(today.getTime() + 86400000),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ plan: plan ? serializeDailyPlan(plan) : null });
}

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json().catch(() => ({}));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let items = Array.isArray(data.items) ? data.items : null;

  if (!items && data.generate) {
    const profile = await prisma.cfProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        submissions: {
          orderBy: { creationTime: "desc" },
          take: 2000,
        },
        tagStats: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "No CF profile found. Sync first." },
        { status: 404 },
      );
    }

    const recentContestWindowStart = new Date();
    recentContestWindowStart.setDate(
      recentContestWindowStart.getDate() - RECENT_CONTEST_WINDOW_DAYS,
    );
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
    });

    const solvedProblemKeys = Array.from(
      new Set(
        profile.submissions
          .filter(
            (submission) =>
              submission.verdict === "OK" &&
              submission.contestId != null &&
              submission.problemIndex != null,
          )
          .map((submission) => `${submission.contestId}-${submission.problemIndex}`),
      ),
    );
    const excludedContestIds = Array.from(
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
    );
    const weakTags = profile.tagStats
      .filter((tag) => tag.attemptedCount > 0 && tag.accuracy < 0.5)
      .sort((a, b) => a.accuracy - b.accuracy)
      .map((tag) => tag.tag);

    const generatedPlan = await generateDailyPlan({
      rating: profile.rating ?? 1200,
      weakTags,
      failedProblems: [],
      date: today,
      solvedProblemKeys,
      excludedContestIds,
      aggressive: Boolean(data.aggressiveMode),
    });

    if (generatedPlan.items.length === 0) {
      return NextResponse.json(
        { error: "No unsolved problems were available for your current range." },
        { status: 400 },
      );
    }

    items = generatedPlan.items;
  }

  if (!items) {
    return NextResponse.json(
      { error: "Provide items or request server-side generation." },
      { status: 400 },
    );
  }

  const persistedItems = items.map((item: any, i: number) => ({
    problemId: item.problemId || null,
    problemContestId: item.contestId || null,
    problemIndex: item.index || null,
    problemName: item.name || null,
    problemRating: item.rating ? Number(item.rating) : null,
    problemTags: JSON.stringify(item.tags || []),
    problemUrl: item.cfUrl || null,
    itemType: item.itemType || "practice",
    notes:
      Array.isArray(item.reasonLabels) && item.reasonLabels.length > 0
        ? JSON.stringify(item.reasonLabels)
        : null,
    sortOrder: i,
  }));

  // Upsert plan for today
  const plan = await prisma.dailyPlan.upsert({
    where: {
      userId_date: { userId: session.user.id, date: today },
    },
    create: {
      userId: session.user.id,
      date: today,
      items: {
        create: persistedItems,
      },
    },
    update: {
      isCompleted: false,
      items: {
        deleteMany: {},
        create: persistedItems,
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ plan: serializeDailyPlan(plan) });
}

export async function PATCH(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const { itemId, isCompleted, timeSpent, notes } = data;

  if (itemId) {
    await prisma.dailyPlanItem.update({
      where: { id: itemId },
      data: {
        ...(isCompleted !== undefined && { isCompleted }),
        ...(timeSpent !== undefined && { timeSpent }),
        ...(notes !== undefined && { notes }),
      },
    });
  }

  return NextResponse.json({ success: true });
}
