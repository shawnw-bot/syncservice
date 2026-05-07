import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

// ✅ Billing access guard
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
  console.log("SYNC OPERATOR HIT");

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
  // ✅ ACCESS GATE — Billing Required
  // ============================================================
  const customerId = request.headers.get("x-stripe-customer-id");

  if (!customerId) {
    return NextResponse.json(
      { success: false, message: "Missing x-stripe-customer-id header" },
      { status: 401 }
    );
  }

  const access = await checkAccessByCustomerId(customerId);

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

  // ============================================================
  // ✅ Existing operator logic (unchanged)
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
  const action = body.action ?? null;

  if (!externalId) {
    return NextResponse.json(
      { success: false, message: "Missing external_id" },
      { status: 400 }
    );
  }

  if (!action) {
    return NextResponse.json(
      { success: false, message: "Missing action" },
      { status: 400 }
    );
  }

  const key = {
    PK: "SYNC",
    SK: `EXT#${externalId}`,
  };

  const doc = getDdb(region);

  try {
    const now = new Date().toISOString();

    // -----------------------------
    // Action: add_note
    // -----------------------------
    if (action === "add_note") {
      const note = body.note ?? null;
      if (!note || String(note).trim() === "") {
        return NextResponse.json(
          { success: false, message: "Missing note" },
          { status: 400 }
        );
      }

      const noteObj = { note: String(note), created_at: now };

      const updated = await doc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          UpdateExpression:
            "SET operator_notes = list_append(if_not_exists(operator_notes, :empty), :note), last_operator_action_at = :now",
          ConditionExpression: "#status = :required",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":required": SyncStates.ACTION_REQUIRED,
            ":empty": [],
            ":note": [noteObj],
            ":now": now,
          },
          ReturnValues: "ALL_NEW",
        })
      );

      return NextResponse.json({
        success: true,
        message: "Operator note added",
        item: updated.Attributes,
      });
    }

    // -----------------------------
    // Action: flag_followup
    // -----------------------------
    if (action === "flag_followup") {
      const followupReason =
        body.reason ?? "Follow-up required (operator flagged).";

      const updated = await doc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          UpdateExpression:
            "SET follow_up_required = :true, follow_up_at = :now, follow_up_reason = :reason, last_operator_action_at = :now",
          ConditionExpression: "#status = :required",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":required": SyncStates.ACTION_REQUIRED,
            ":true": true,
            ":now": now,
            ":reason": String(followupReason),
          },
          ReturnValues: "ALL_NEW",
        })
      );

      return NextResponse.json({
        success: true,
        message: "Follow-up flagged",
        item: updated.Attributes,
      });
    }

    // -----------------------------
    // Action: resolve
    // -----------------------------
    if (action === "resolve") {
      const resolvedReason = body.reason ?? "Resolved by operator.";

      assertValidTransition(SyncStates.ACTION_REQUIRED, SyncStates.COMPLETED);

      const updated = await doc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          UpdateExpression:
            "SET #status = :next, resolved_at = :now, resolved_reason = :reason, last_operator_action_at = :now",
          ConditionExpression: "#status = :current",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":current": SyncStates.ACTION_REQUIRED,
            ":next": SyncStates.COMPLETED,
            ":now": now,
            ":reason": String(resolvedReason),
          },
          ReturnValues: "ALL_NEW",
        })
      );

      // Non‑blocking notification persist
      try {
        const notifId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        await doc.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              PK: "NOTIFICATION",
              SK: `NOTIF#${notifId}`,
              event: "ro_completed",
              external_id: externalId,
              audience: "manager",
              channel: "email",
              status: "pending",
              created_at: now,
              payload: {
                resolved_at: now,
                resolved_reason: String(resolvedReason),
              },
            },
          })
        );
      } catch (e) {
        console.error("NOTIFICATION PERSIST FAILED (non-blocking):", e);
      }

      return NextResponse.json({
        success: true,
        message: "Sync resolved",
        item: updated.Attributes,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Invalid action. Allowed: add_note | flag_followup | resolve",
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("SYNC OPERATOR FAILED:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Sync operator action failed",
        errorName: error?.name ?? "UnknownError",
        errorMessage: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}