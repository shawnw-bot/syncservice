import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// ✅ Access guard (billing enforcement)
import { checkAccessByCustomerId } from "../../../../src/lib/accessGuard";

// ✅ Force Node.js runtime (AWS SDK requires this)
export const runtime = "nodejs";

// ✅ Canonical Sync States (authoritative)
const SyncStates = {
  CREATED: "CREATED",
  INGESTED: "INGESTED",
  PROCESSING: "PROCESSING",
  AWAITING_AI: "AWAITING_AI",
  AI_COMPLETED: "AI_COMPLETED",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

type SyncState = (typeof SyncStates)[keyof typeof SyncStates];

// ✅ Allowed State Transitions (authoritative)
const AllowedTransitions: Record<SyncState, SyncState[]> = {
  [SyncStates.CREATED]: [SyncStates.INGESTED, SyncStates.FAILED],
  [SyncStates.INGESTED]: [SyncStates.PROCESSING, SyncStates.FAILED],
  [SyncStates.PROCESSING]: [
    SyncStates.AWAITING_AI,
    SyncStates.AI_COMPLETED,
    SyncStates.FAILED,
  ],
  [SyncStates.AWAITING_AI]: [SyncStates.AI_COMPLETED, SyncStates.FAILED],
  [SyncStates.AI_COMPLETED]: [
    SyncStates.ACTION_REQUIRED,
    SyncStates.COMPLETED,
    SyncStates.FAILED,
  ],
  [SyncStates.ACTION_REQUIRED]: [
    SyncStates.PROCESSING,
    SyncStates.COMPLETED,
    SyncStates.FAILED,
  ],
  [SyncStates.COMPLETED]: [],
  [SyncStates.FAILED]: [],
};

// ✅ Guard: any transition not explicitly allowed is invalid
function assertValidTransition(from: SyncState, to: SyncState) {
  const allowed = AllowedTransitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid Sync state transition: ${from} → ${to}`);
  }
}

// ✅ Lazy DynamoDB client (env-safe)
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

export async function POST(request: Request) {
  console.log("SYNC DECISION HIT");

  const region = process.env.AWS_REGION;
  const tableName = process.env.DDB_TABLE_SYNC;

  if (!region) {
    return NextResponse.json(
      { success: false, message: "Missing AWS_REGION in .env.local" },
      { status: 500 }
    );
  }

  if (!tableName) {
    return NextResponse.json(
      { success: false, message: "Missing DDB_TABLE_SYNC in .env.local" },
      { status: 500 }
    );
  }

  // ============================================================
  // ✅ STEP 3 ACCESS GATE (Billing Required)
  // ============================================================
  const customerId = request.headers.get("x-stripe-customer-id");

  if (!customerId) {
    return NextResponse.json(
      { success: false, message: "Missing x-stripe-customer-id header" },
      { status: 401 }
    );
  }

  const decision = await checkAccessByCustomerId(customerId);

  if (!decision.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Subscription required",
        reason: decision.reason ?? "blocked",
        tier: decision.tier,
        status: decision.status,
      },
      { status: 403 }
    );
  }

  // ============================================================
  // ✅ Existing logic (unchanged below)
  // ============================================================

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

  const externalId = body.external_id ?? null;
  const reason = body.reason ?? "AI completed; operator decision required.";

  if (!externalId) {
    return NextResponse.json(
      { success: false, message: "Missing external_id" },
      { status: 400 }
    );
  }

  const key = {
    PK: "SYNC",
    SK: `EXT#${externalId}`,
  };

  const doc = getDdb(region);

  try {
    // ✅ Enforce AI_COMPLETED → ACTION_REQUIRED
    assertValidTransition(SyncStates.AI_COMPLETED, SyncStates.ACTION_REQUIRED);

    const updated = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression:
          "SET #status = :nextStatus, action_required_at = :actionAt, action_required_reason = :reason",
        ConditionExpression: "#status = :currentStatus",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":currentStatus": SyncStates.AI_COMPLETED,
          ":nextStatus": SyncStates.ACTION_REQUIRED,
          ":actionAt": new Date().toISOString(),
          ":reason": reason,
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return NextResponse.json({
      success: true,
      message: "SyncService action required",
      item: updated.Attributes,
    });
  } catch (error: any) {
    console.error("SYNC DECISION FAILED:", error);
    return NextResponse.json(
      {
        success: false,
        message: "SyncService decision failed",
        errorName: error?.name ?? "UnknownError",
        errorMessage: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}