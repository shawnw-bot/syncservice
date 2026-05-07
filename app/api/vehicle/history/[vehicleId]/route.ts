import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

// ✅ Force Node.js runtime (AWS SDK requires this)
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;

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

  if (!vehicleId || vehicleId.trim() === "") {
    return NextResponse.json(
      { success: false, message: "Missing vehicleId in route" },
      { status: 400 }
    );
  }

  const doc = getDdb(region);

  try {
    // ✅ Read-only: list all SYNC records for this vehicle_id
    // Note: This uses Scan + FilterExpression for now (optimize later with an index).
    const result = await doc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "PK = :pk AND vehicle_id = :vid",
        ExpressionAttributeValues: {
          ":pk": "SYNC",
          ":vid": vehicleId,
        },
      })
    );

    const items = result.Items ?? [];

    // ✅ Sort newest-first by received_at when present
    items.sort((a: any, b: any) => {
      const aTime = a?.received_at ? Date.parse(a.received_at) : 0;
      const bTime = b?.received_at ? Date.parse(b.received_at) : 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      vehicle_id: vehicleId,
      count: items.length,
      items,
    });
  } catch (error: any) {
    console.error("VEHICLE HISTORY FAILED:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch vehicle history",
        errorName: error?.name ?? "UnknownError",
        errorMessage: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}