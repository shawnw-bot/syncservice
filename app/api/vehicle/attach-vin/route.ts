import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

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

function normalizeVin(input: any): string | null {
  if (input === null || input === undefined) return null;
  const v = String(input).trim().toUpperCase();
  if (v.length === 0) return null;
  // Keep minimal validation; VIN format enforcement can be tightened later.
  return v;
}

export async function POST(request: Request) {
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

  const vehicleId = body.vehicle_id ? String(body.vehicle_id).trim() : "";
  const vin = normalizeVin(body.vin);

  if (!vehicleId) {
    return NextResponse.json(
      { success: false, message: "Missing vehicle_id" },
      { status: 400 }
    );
  }

  if (!vin) {
    return NextResponse.json(
      { success: false, message: "Missing vin" },
      { status: 400 }
    );
  }

  const doc = getDdb(region);
  const now = new Date().toISOString();

  const sourceVehicleKey = {
    PK: "VEHICLE",
    SK: `VEHICLE#${vehicleId}`,
  };

  try {
    // 1) Load the source vehicle (the one we are attaching a VIN to)
    const sourceVehicleRes = await doc.send(
      new GetCommand({
        TableName: tableName,
        Key: sourceVehicleKey,
      })
    );

    if (!sourceVehicleRes?.Item) {
      return NextResponse.json(
        { success: false, message: "Vehicle not found for provided vehicle_id" },
        { status: 404 }
      );
    }

    const sourceVehicle = sourceVehicleRes.Item as any;

    // If the vehicle already has this same VIN, nothing to do.
    const existingVinOnSource = normalizeVin(sourceVehicle.vin);
    if (existingVinOnSource && existingVinOnSource === vin) {
      return NextResponse.json({
        success: true,
        message: "VIN already attached to this vehicle",
        vehicle_id: vehicleId,
        vin,
        merged: false,
      });
    }

    // 2) Find if ANY other vehicle already has this VIN (canonical)
    // (Scan + filter for now; optimize later with an index.)
    const existingVinVehicleScan = await doc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "PK = :pk AND vin = :vin",
        ExpressionAttributeValues: {
          ":pk": "VEHICLE",
          ":vin": vin,
        },
      })
    );

    const matchingVehicles = existingVinVehicleScan.Items ?? [];
    const canonical = matchingVehicles.find(
      (v: any) => String(v.vehicle_id) !== vehicleId
    );

    // 3) If no canonical vehicle exists, just attach VIN to source vehicle
    if (!canonical) {
      const updated = await doc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: sourceVehicleKey,
          UpdateExpression:
            "SET vin = :vin, updated_at = :now",
          ExpressionAttributeValues: {
            ":vin": vin,
            ":now": now,
          },
          ReturnValues: "ALL_NEW",
        })
      );

      return NextResponse.json({
        success: true,
        message: "VIN attached to vehicle",
        vehicle_id: vehicleId,
        vin,
        merged: false,
        vehicle: updated.Attributes,
      });
    }

    // 4) Canonical vehicle exists for this VIN — we will MERGE source → canonical
    const canonicalVehicleId = String(canonical.vehicle_id);
    const canonicalVehicleKey = {
      PK: "VEHICLE",
      SK: `VEHICLE#${canonicalVehicleId}`,
    };

    // 4a) Update canonical updated_at (VIN already present)
    await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: canonicalVehicleKey,
        UpdateExpression: "SET updated_at = :now",
        ExpressionAttributeValues: { ":now": now },
      })
    );

    // 4b) Repoint all SYNC records from source vehicle_id → canonical vehicle_id
    const syncScan = await doc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "PK = :pk AND vehicle_id = :vid",
        ExpressionAttributeValues: {
          ":pk": "SYNC",
          ":vid": vehicleId,
        },
      })
    );

    const syncItems = syncScan.Items ?? [];
    let repointed = 0;

    for (const s of syncItems) {
      await doc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: s.PK, SK: s.SK },
          UpdateExpression: "SET vehicle_id = :newVid",
          ExpressionAttributeValues: {
            ":newVid": canonicalVehicleId,
          },
        })
      );
      repointed += 1;
    }

    // 4c) Mark source vehicle as merged (audit-safe)
    await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: sourceVehicleKey,
        UpdateExpression:
          "SET merge_status = :merged, merged_into_vehicle_id = :into, updated_at = :now",
        ExpressionAttributeValues: {
          ":merged": "MERGED",
          ":into": canonicalVehicleId,
          ":now": now,
        },
      })
    );

    return NextResponse.json({
      success: true,
      message: "VIN already existed — source vehicle merged into canonical vehicle",
      vin,
      merged: true,
      source_vehicle_id: vehicleId,
      canonical_vehicle_id: canonicalVehicleId,
      repointed_sync_count: repointed,
    });
  } catch (error: any) {
    console.error("ATTACH VIN FAILED:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to attach VIN / merge vehicles",
        errorName: error?.name ?? "UnknownError",
        errorMessage: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}