import { NextRequest, NextResponse } from "next/server";
import { checkAccessByCustomerId } from "../../../src/lib/accessGuard";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // ----------------------------
    // Access Gate (Billing)
    // ----------------------------
    const customerId = req.headers.get("x-stripe-customer-id");

    if (!customerId) {
      return NextResponse.json(
        { error: "Missing x-stripe-customer-id header" },
        { status: 401 }
      );
    }

    const decision = await checkAccessByCustomerId(customerId);

    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: "Subscription required",
          status: decision.status,
          tier: decision.tier,
          reason: decision.reason ?? "blocked",
        },
        { status: 403 }
      );
    }

    // ----------------------------
    // Calls List Logic
    // ----------------------------
    const baseUrl = process.env.AWS_CALLS_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "AWS_CALLS_URL is not set" },
        { status: 500 }
      );
    }

    // List endpoint (no id here)
    const response = await fetch(baseUrl, { method: "GET" });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream error", detail: text || "Upstream request failed" },
        { status: response.status }
      );
    }

    const data = await response.json().catch(() => ({}));

    return NextResponse.json({
      ...data,
      access: { allowed: true, tier: decision.tier, status: decision.status },
    });
  } catch (error) {
    console.error("GET /api/calls failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}