import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Missing externalId. Use /api/sync/by-external/{externalId} (example: /api/sync/by-external/GOLDEN-RO-001).",
    },
    { status: 400 }
  );
}