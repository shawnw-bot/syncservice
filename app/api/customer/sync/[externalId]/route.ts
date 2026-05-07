import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

// Internal helper: mint tokens only for paid/internal users
import { checkAccessByCustomerId } from "../../../../../src/lib/accessGuard";

export const runtime = "nodejs";

// ✅ Lazy DynamoDB client
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

// ✅ Safe subset of fields for customers
function toCustomerSafeView(item: any) {
  return {
    external_id: item.external_id ?? null,
    status: item.status ?? null,
    received_at: item.received_at ?? null,

    action_required_at: item.action_required_at ?? null,
    action_required_reason: item.action_required_reason ?? null,

    follow_up_required: item.follow_up_required ?? null,
    follow_up_reason: item.follow_up_reason ?? null,

    resolved_at: item.resolved_at ?? null,
    resolved_reason: item.resolved_reason ?? null,

    vehicle_id: item.vehicle_id ?? null,
  };
}

function mintToken() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      // @ts-ignore
      return crypto.randomUUID();
    }
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

// ------------------------------------------------------------
// GET /api/customer/sync/[externalId]?token=...
// Customer-safe read: requires token, returns filtered sync view.
// ------------------------------------------------------------
export async function GET(
  request: Request,
  context: { params?: Promise<{ externalId?: string }> }
) {
  const region = process.env.AWS_REGION;
  const tableName = process.env.DDB_TABLE_SYNC;

  if (!region || !tableName) {
    return NextResponse.json(
      { success: false, message: "Missing env configuration" },
      { status: 500 }
    );
  }

  const resolvedParams = context?.params ? await context.params : undefined;
  let externalId = resolvedParams?.externalId ?? null;

  if (!externalId) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    externalId = parts[parts.length - 1] || null;
  }

  if (!externalId) {
    return NextResponse.json(
      { success: false, message: "Missing externalId" },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Missing token" },
      { status: 401 }
    );
  }

  const key = { PK: "SYNC", SK: `EXT#${externalId}` };
  const doc = getDdb(region);

  try {
    const result = await doc.send(
      new GetCommand({
        TableName: tableName,
        Key: key,
      })
    );

    if (!result?.Item) {
      return NextResponse.json(
        { success: false, message: "Sync not found", external_id: externalId },
        { status: 404 }
      );
    }

    const stored = (result.Item as any).customer_view_token ?? null;

    if (!stored || stored !== token) {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer sync fetched",
      item: toCustomerSafeView(result.Item),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "Fetch failed", error: String(err) },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------------
// POST /api/customer/sync/[externalId]
// Internal helper: mint a token and return a customer link.
// Requires billing access guard (x-stripe-customer-id).
// ------------------------------------------------------------------
export async function POST(
  request: Request,
  context: { params?: Promise<{ externalId?: string }> }
) {
  const region = process.env.AWS_REGION;
  const tableName = process.env.DDB_TABLE_SYNC;

  if (!region || !tableName) {
    return NextResponse.json(
      { success: false, message: "Missing env configuration" },
      { status: 500 }
    );
  }

  const internalCustomerId = request.headers.get("x-stripe-customer-id");
  if (!internalCustomerId) {
    return NextResponse.json(
      { success: false, message: "Missing x-stripe-customer-id header" },
      { status: 401 }
    );
  }

  const access = await checkAccessByCustomerId(internalCustomerId);
  if (!access.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Subscription required",
        reason: access.reason ?? "blocked",
        tier: access.tier,
        status: access.status,
      },
      { status: 403 }
    );
  }

  const resolvedParams = context?.params ? await context.params : undefined;
  let externalId = resolvedParams?.externalId ?? null;

  if (!externalId) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    externalId = parts[parts.length - 1] || null;
  }

  if (!externalId) {
    return NextResponse.json(
      { success: false, message: "Missing externalId" },
      { status: 400 }
    );
  }

  const key = { PK: "SYNC", SK: `EXT#${externalId}` };
  const doc = getDdb(region);

  const now = new Date().toISOString();
  const token = mintToken();

  try {
    const updated = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression:
          "SET customer_view_token = if_not_exists(customer_view_token, :t), customer_view_token_created_at = if_not_exists(customer_view_token_created_at, :now)",
        ExpressionAttributeValues: {
          ":t": token,
          ":now": now,
        },
        ReturnValues: "ALL_NEW",
      })
    );

    const stored = (updated.Attributes as any)?.customer_view_token;

    const customerLink = `http://localhost:3000/customer/sync/${externalId}?token=${encodeURIComponent(
      stored
    )}`;

    return NextResponse.json({
      success: true,
      message: "Customer token ready",
      external_id: externalId,
      token: stored,
      customer_link: customerLink,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "Token mint failed", error: String(err) },
      { status: 500 }
    );
  }
}
