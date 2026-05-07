import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const doc = DynamoDBDocumentClient.from(client);

export async function GET(
  request: Request,
  context: { params: Promise<{ externalId: string }> }
) {
  // ✅ FIX: properly await params
  const { externalId } = await context.params;

  const tableName = process.env.DDB_TABLE_SYNC;

  if (!tableName) {
    return NextResponse.json(
      { success: false, message: "Missing table" },
      { status: 500 }
    );
  }

  try {
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
        { success: false, message: "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: match,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Error fetching record",
        error: error?.message,
      },
      { status: 500 }
    );
  }
}
