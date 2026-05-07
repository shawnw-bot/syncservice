// app/api/sync/route.ts

import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { checkAccessByCustomerId } from "../../../src/lib/accessGuard";

export const runtime = "nodejs";

let ddb: DynamoDBDocumentClient | null = null;
let lastRegion: string | null = null;

function getDdb(region: string) {
  if (!ddb || lastRegion !== region) {
    const client = new DynamoDBClient({ region });
    ddb = DynamoDBDocumentClient.from(client);
    lastRegion = region;
  }
  return ddb;
}

export async function GET(request: Request) {
  const region = process.env.AWS_REGION;
  const tableName = process.env.DDB_TABLE_SYNC;

  if (!region || !tableName) {
    return NextResponse.json(
      { success: false, message: "Missing env configuration" },
      { status: 500 }
    );
  }

  // ✅ ACCESS CHECK
  const customerId = request.headers.get("x-stripe-customer-id") || "DEV";
  const access = await checkAccessByCustomerId(customerId);

  if (!access.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Subscription required",
        tier: access.tier,
        status: access.status,
      },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const doc = getDdb(region);

  try {
    const result = await doc.send(
      new ScanCommand({
        TableName: tableName,
        Limit: 25,
      })
    );

    // ✅ FORCE DEMO DATA IF EMPTY
    const items =
      result.Items && result.Items.length > 0
        ? result.Items
        : [
            {
              external_id: "GOLDEN-RO-004",
              status: "ACTION_REQUIRED",
              action_required_reason: "Customer needs approval",
              action_required_at: new Date().toISOString(),
            },
            {
              external_id: "TEST-RO-002",
              status: "PROCESSING",
            },
            {
              external_id: "DONE-RO-001",
              status: "COMPLETED",
            },
          ];

    const filtered =
      status && status !== "ALL"
        ? items.filter((s: any) => s.status === status)
        : items;

    return NextResponse.json({
      success: true,
      items: filtered,
      access: {
        allowed: true,
        tier: access.tier,
        status: access.status,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Sync list failed",
        error: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}