import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const doc = DynamoDBDocumentClient.from(client);

export async function POST(request: Request) {
  const tableName = process.env.DDB_TABLE_SYNC;

  if (!tableName) {
    return NextResponse.json(
      { success: false, message: "Missing DDB_TABLE_SYNC" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const externalId = body?.external_id;
    const note = body?.note;

    if (!externalId || typeof externalId !== "string") {
      return NextResponse.json(
        { success: false, message: "Missing external_id" },
        { status: 400 }
      );
    }

    if (!note || typeof note !== "string" || !note.trim()) {
      return NextResponse.json(
        { success: false, message: "Missing note" },
        { status: 400 }
      );
    }

    // Find record by external_id (consistent with your by-external scan approach)
    const scan = await doc.send(new ScanCommand({ TableName: tableName }));
    const items = scan.Items ?? [];

    const match = items.find((it: any) => it?.external_id === externalId);

    if (!match) {
      return NextResponse.json(
        { success: false, message: "Ticket not found" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const updateItem = {
      note: note.trim(),
      created_at: now,
      author: "advisor",
    };

    const updated = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: match.PK, SK: match.SK },
        UpdateExpression:
          "SET latest_customer_update = :latest, customer_updates = list_append(if_not_exists(customer_updates, :emptyList), :newItem)",
        ExpressionAttributeValues: {
          ":latest": updateItem,
          ":emptyList": [],
          ":newItem": [updateItem],
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return NextResponse.json({
      success: true,
      item: updated.Attributes,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to post customer update",
        errorMessage: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}