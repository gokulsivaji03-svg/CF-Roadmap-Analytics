import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeDailyPlan } from "@/lib/serialization";
import { getAppSession } from "@/lib/session";

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

  return NextResponse.json({ plan: plan ? normalizeDailyPlan(plan) : null });
}

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = (data.items || []).map((item: any, i: number) => ({
    problemId: item.problemId || null,
    problemContestId: item.contestId || null,
    problemIndex: item.index || null,
    problemName: item.name || null,
    problemRating: item.rating ? Number(item.rating) : null,
    problemTags: JSON.stringify(item.tags || []),
    problemUrl: item.cfUrl || null,
    itemType: item.itemType || "practice",
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
        create: items,
      },
    },
    update: {
      isCompleted: false,
      items: {
        deleteMany: {},
        create: items,
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ plan: normalizeDailyPlan(plan) });
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
