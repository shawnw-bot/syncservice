import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const doc = DynamoDBDocumentClient.from(client);

export async function POST(request: Request) {
  console.log("SYNC COMPLETE HIT ✅");

  const tableName = process.env.DDB_TABLE_SYNC;

  if (!tableName) {
    return NextResponse.json(
      { success: false, message: "Missing table" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const externalId = body.external_id;
    const resolvedReason = body.resolved_reason;

    if (!externalId) {
      return NextResponse.json(
        { success: false, message: "Missing external_id" },
        { status: 400 }
      );
    }

    // ✅ Step 1: find the record
    const result = await doc.send(
      new ScanCommand({
        TableName: tableName,
      })
    );

    const items = result.Items ?? [];

    const match = items.find(
      (item: any) => item.external_id === externalId
    );

    if (!match) {
      return NextResponse.json(
        { success: false, message: "Sync not found" },
        { status: 404 }
      );
    }

    // ✅ Step 2: update to COMPLETED
    const updated = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: match.PK,
          SK: match.SK,
        },
        UpdateExpression:
          "SET #status = :status, completed_at = :completedAt, resolution_reason = :reason",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": "COMPLETED",
          ":completedAt": new Date().toISOString(),
          ":reason": resolvedReason ?? "Completed by operator",
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return NextResponse.json({
      success: true,
      item: updated.Attributes,
    });
  } catch (error: any) {
    console.error("COMPLETE FAILED:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to complete ticket",
        error: error?.message,
      },
      { status: 500 }
    );
  }
}