import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

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

function customerSafeResponse(item: any) {
  // Minimal fields for customer confirmation screen
  return {
    external_id: item.external_id ?? null,
    status: item.status ?? null,
    customer_decision: item.customer_decision ?? null,
    customer_decision_at: item.customer_decision_at ?? null,
    customer_decision_note: item.customer_decision_note ?? null,
  };
}

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

  // Resolve externalId from params (Next.js provides params as a Promise in your project)
  const resolvedParams = context?.params ? await context.params : undefined;
  let externalId = resolvedParams?.externalId ?? null;

  // Fallback: parse from URL path
  if (!externalId) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    externalId = parts[parts.length - 2] || null; // .../[externalId]/decision
  }

  if (!externalId) {
    return NextResponse.json(
      { success: false, message: "Missing externalId" },
      { status: 400 }
    );
  }

  // Token comes from query string: ?token=...
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Missing token" },
      { status: 401 }
    );
  }

  // Read body
  const rawBody = await request.text();
  if (!rawBody || rawBody.trim() === "") {
    return NextResponse.json(
      { success: false, message: "Empty request body" },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid JSON body",
        errorName: e?.name ?? "SyntaxError",
        errorMessage: e?.message ?? String(e),
      },
      { status: 400 }
    );
  }

  const decision = String(body.decision ?? "").toLowerCase();
  const note = body.note ?? null;

  if (decision !== "approve" && decision !== "decline") {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid decision. Allowed: approve | decline",
      },
      { status: 400 }
    );
  }

  // Transition mapping using your existing allowed transitions:
  // ACTION_REQUIRED → PROCESSING (approve)
  // ACTION_REQUIRED → COMPLETED (decline)
  const nextStatus = decision === "approve" ? "PROCESSING" : "COMPLETED";
  const now = new Date().toISOString();

  const key = { PK: "SYNC", SK: `EXT#${externalId}` };
  const doc = getDdb(region);

  try {
    // 1) Fetch the Sync record to validate token and idempotency
    const existing = await doc.send(
      new GetCommand({
        TableName: tableName,
        Key: key,
      })
    );

    if (!existing?.Item) {
      return NextResponse.json(
        { success: false, message: "Sync not found", external_id: externalId },
        { status: 404 }
      );
    }

    const item: any = existing.Item;

    // Validate token against stored customer_view_token
    const storedToken = item.customer_view_token ?? null;
    if (!storedToken || storedToken !== token) {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 403 }
      );
    }

    // If decision already recorded, return idempotent success
    if (item.customer_decision) {
      return NextResponse.json({
        success: true,
        message: "Customer decision already recorded (idempotent)",
        item: customerSafeResponse(item),
      });
    }

    // 2) Write decision + transition (must be ACTION_REQUIRED)
    const updated = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression:
          "SET customer_decision = :d, customer_decision_at = :at, customer_decision_note = :note, #status = :nextStatus",
        ConditionExpression:
          "#status = :requiredStatus AND customer_view_token = :token AND attribute_not_exists(customer_decision)",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":requiredStatus": "ACTION_REQUIRED",
          ":nextStatus": nextStatus,
          ":d": decision,
          ":at": now,
          ":note": note ? String(note) : null,
          ":token": token,
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return NextResponse.json({
      success: true,
      message:
        decision === "approve"
          ? "Work approved. Your service team has been notified."
          : "Work declined. Your service team has been notified.",
      item: customerSafeResponse(updated.Attributes),
    });
  } catch (error: any) {
    // If the conditional failed, it's usually because status isn't ACTION_REQUIRED anymore
    // or a decision was already recorded (race), or token mismatch.
    return NextResponse.json(
      {
        success: false,
        message: "Customer decision failed",
        errorName: error?.name ?? "UnknownError",
        errorMessage: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}