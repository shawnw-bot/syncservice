import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

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

// ✅ Golden Record constants (single source of truth)
const GOLDEN_EXTERNAL_ID = "GOLDEN-RO-001";

// ✅ Helper: detect “golden mode” request (explicit, opt-in)
function isGoldenRequest(body: any): boolean {
  // Only true when caller explicitly sets golden: true
  return body?.golden === true;
}

export async function POST(request: Request) {
  console.log("SYNC INGEST HIT");

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

  // ✅ SAFELY read raw body first
  const rawBody = await request.text();

  if (!rawBody || rawBody.trim() === "") {
    console.warn("Empty POST body received — ignoring");
    return NextResponse.json(
      { success: false, message: "Empty request body" },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch (e: any) {
    console.error("Invalid JSON:", rawBody);
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

  console.log("REQUEST BODY:", body);

  const goldenMode = isGoldenRequest(body);

  // ✅ externalId selection:
  // - normal: external_id or call_id
  // - golden: allow external_id override, default to GOLDEN_EXTERNAL_ID if missing
  const externalId =
    (body.external_id ?? body.call_id ?? null) ??
    (goldenMode ? GOLDEN_EXTERNAL_ID : null);

  if (!externalId) {
    return NextResponse.json(
      {
        success: false,
        message: "Missing external_id or call_id for idempotency",
      },
      { status: 400 }
    );
  }

  const key = {
    PK: "SYNC",
    SK: `EXT#${externalId}`,
  };

  const doc = getDdb(region);

  try {
    // ✅ Idempotent read-first
    const existing = await doc.send(
      new GetCommand({
        TableName: tableName,
        Key: key,
      })
    );

    if (existing?.Item) {
      return NextResponse.json({
        success: true,
        message: goldenMode
          ? "Golden Sync already exists (idempotent response)"
          : "SyncService event already exists (idempotent response)",
        item: existing.Item,
      });
    }

    // ============================================================
    // ✅ 3B.2A: CREATE VEHICLE AT INGEST (VIN-FIRST, VIN OPTIONAL)
    // ============================================================
    // For now, we always create a new Vehicle with vin = null.
    // Later, we can resolve existing Vehicles by VIN when available.
    const vehicleId = uuidv4();
    const now = new Date().toISOString();

    const vehicleItem = {
      PK: "VEHICLE",
      SK: `VEHICLE#${vehicleId}`,
      vehicle_id: vehicleId,
      vin: body?.vin ?? null,
      year: body?.year ?? null,
      make: body?.make ?? null,
      model: body?.model ?? null,
      created_at: now,
      updated_at: now,
    };

    await doc.send(
      new PutCommand({
        TableName: tableName,
        Item: vehicleItem,
        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );

    const syncId = uuidv4();

    // ✅ Step 1: create the Sync in CREATED (now includes vehicle_id)
    const item = {
      ...key,
      external_id: externalId,
      sync_id: syncId,
      vehicle_id: vehicleId,
      status: SyncStates.CREATED,
      source: goldenMode ? "golden_seed" : "manual_test",
      event_type: goldenMode ? "sync.golden_seed" : "sync.ingest",
      payload: body,
      received_at: now,
      version: "v1",
    };

    await doc.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );

    // ✅ Step 2: enforce CREATED → INGESTED
    assertValidTransition(SyncStates.CREATED, SyncStates.INGESTED);

    const ingested = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression:
          "SET #status = :nextStatus, ingested_at = :ingestedAt",
        ConditionExpression: "#status = :currentStatus",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":currentStatus": SyncStates.CREATED,
          ":nextStatus": SyncStates.INGESTED,
          ":ingestedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    // ✅ Step 3: enforce INGESTED → PROCESSING
    assertValidTransition(SyncStates.INGESTED, SyncStates.PROCESSING);

    const processing = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression:
          "SET #status = :nextStatus, processing_at = :processingAt",
        ConditionExpression: "#status = :currentStatus",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":currentStatus": SyncStates.INGESTED,
          ":nextStatus": SyncStates.PROCESSING,
          ":processingAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    // ✅ Step 4: enforce PROCESSING → AWAITING_AI
    assertValidTransition(SyncStates.PROCESSING, SyncStates.AWAITING_AI);

    const awaiting = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression:
          "SET #status = :nextStatus, awaiting_ai_at = :awaitingAiAt",
        ConditionExpression: "#status = :currentStatus",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":currentStatus": SyncStates.PROCESSING,
          ":nextStatus": SyncStates.AWAITING_AI,
          ":awaitingAiAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    // ✅ Step 5: enforce AWAITING_AI → AI_COMPLETED (stub AI result for now)
    assertValidTransition(SyncStates.AWAITING_AI, SyncStates.AI_COMPLETED);

    const aiResultStub = {
      kind: "stub",
      model: "not_connected_yet",
      summary:
        "AI processing not yet connected. This is a placeholder result for state-machine validation.",
      confidence: null,
      derived: {},
      created_at: new Date().toISOString(),
    };

    const aiCompleted = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression:
          "SET #status = :nextStatus, ai_completed_at = :aiCompletedAt, ai_result = :aiResult",
        ConditionExpression: "#status = :currentStatus",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":currentStatus": SyncStates.AWAITING_AI,
          ":nextStatus": SyncStates.AI_COMPLETED,
          ":aiCompletedAt": new Date().toISOString(),
          ":aiResult": aiResultStub,
        },
        ReturnValues: "ALL_NEW",
      })
    );

    // ✅ Golden Mode: finalize into ACTION_REQUIRED so the Sync Detail page is viewable & actionable
    if (goldenMode) {
      assertValidTransition(SyncStates.AI_COMPLETED, SyncStates.ACTION_REQUIRED);

      const actionRequired = await doc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          UpdateExpression:
            "SET #status = :nextStatus, action_required_reason = :reason, action_required_at = :at",
          ConditionExpression: "#status = :currentStatus",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":currentStatus": SyncStates.AI_COMPLETED,
            ":nextStatus": SyncStates.ACTION_REQUIRED,
            ":reason":
              body?.action_required_reason ??
              "Golden Record seed: ACTION_REQUIRED for UI verification.",
            ":at": new Date().toISOString(),
          },
          ReturnValues: "ALL_NEW",
        })
      );

      return NextResponse.json({
        success: true,
        message: `Golden Sync created and set to ACTION_REQUIRED`,
        golden_external_id: externalId,
        vehicle_id: vehicleId,
        vehicle: vehicleItem,
        item: actionRequired.Attributes,
        previous: {
          ingested: ingested.Attributes,
          processing: processing.Attributes,
          awaiting: awaiting.Attributes,
          aiCompleted: aiCompleted.Attributes,
        },
      });
    }

    // ✅ Normal behavior (non-golden)
    return NextResponse.json({
      success: true,
      message: "SyncService AI completed (stub)",
      vehicle_id: vehicleId,
      vehicle: vehicleItem,
      item: aiCompleted.Attributes,
      previous: {
        ingested: ingested.Attributes,
        processing: processing.Attributes,
        awaiting: awaiting.Attributes,
      },
    });
  } catch (error: any) {
    console.error("SYNC INGEST FAILED:", error);
    return NextResponse.json(
      {
        success: false,
        message: "SyncService ingest failed",
        errorName: error?.name ?? "UnknownError",
        errorMessage: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}