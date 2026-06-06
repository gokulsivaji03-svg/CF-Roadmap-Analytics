import { NextRequest, NextResponse } from "next/server"
import { findJianglySolutions } from "@/lib/cf-api"

export async function GET(req: NextRequest) {
  try {
    const problem = req.nextUrl.searchParams.get("problem")
    const scan = Math.min(
      Number(req.nextUrl.searchParams.get("scan")) || 20000,
      50000
    )

    if (!problem) {
      return NextResponse.json({ error: "Problem parameter is required" }, { status: 400 })
    }

    const result = await findJianglySolutions(problem, scan)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch jiangly solutions" },
      { status: 400 }
    )
  }
}
