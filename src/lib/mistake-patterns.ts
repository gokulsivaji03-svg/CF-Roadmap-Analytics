import { prisma } from "@/lib/db";
import { parseStringArray, stringifyStringArray } from "@/lib/serialization";

export async function recordMistakePatterns(input: {
  userId: string;
  categories: string[];
  example?: string | null;
}) {
  const uniqueCategories = Array.from(
    new Set(input.categories.filter((category) => category.trim().length > 0)),
  );

  for (const category of uniqueCategories) {
    const existing = await prisma.mistakePattern.findFirst({
      where: {
        userId: input.userId,
        pattern: category,
      },
    });

    if (!existing) {
      await prisma.mistakePattern.create({
        data: {
          userId: input.userId,
          pattern: category,
          count: 1,
          examples: stringifyStringArray(input.example ? [input.example] : []),
        },
      });
      continue;
    }

    const examples = parseStringArray(existing.examples);
    const nextExamples =
      input.example && !examples.includes(input.example)
        ? [input.example, ...examples].slice(0, 5)
        : examples;

    await prisma.mistakePattern.update({
      where: { id: existing.id },
      data: {
        count: { increment: 1 },
        examples: stringifyStringArray(nextExamples),
      },
    });
  }
}
