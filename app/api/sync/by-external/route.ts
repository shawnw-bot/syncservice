import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

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
  request: Request,
  { params }: { params: { externalId: string } }
) {
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

  const externalId = params?.externalId ?? null;
  if (!externalId) {
    return NextResponse.json(
      { success: false, message: "Missing externalId in route" },
      { status: 400 }
    );
  }

  const key = {
    PK: "SYNC",
    SK: `EXT#${externalId}`,
  };

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
        { success: false, message: "Sync record not found", external_id: externalId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Sync record fetched",
      item: result.Item,
    });
  } catch (error: any) {
    console.error("SYNC GET FAILED:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Sync fetch failed",
        errorName: error?.name ?? "UnknownError",
        errorMessage: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}