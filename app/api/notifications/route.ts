import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

// ✅ Node runtime
export const runtime = "nodejs";

// ✅ Notification contract (authoritative)
export type NotificationEvent =
  | "ro_completed"
  | "action_required_created";

type NotificationRecord = {
  PK: "NOTIFICATION";
  SK: string; // NOTIF#<uuid>
  event: NotificationEvent;
  external_id: string; // Sync external_id
  audience: "advisor" | "manager";
  channel: "email" | "sms" | "in_app";
  status: "pending" | "sent" | "failed";
  created_at: string;
  payload?: Record<string, any>;
};

// ✅ Lazy DDB
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
  const region = process.env.AWS_REGION;
  const tableName = process.env.DDB_TABLE_SYNC;

  if (!region || !tableName) {
    return NextResponse.json(
      { success: false, message: "Missing AWS_REGION or DDB_TABLE_SYNC" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const now = new Date().toISOString();

  const record: NotificationRecord = {
    PK: "NOTIFICATION",
    SK: `NOTIF#${crypto.randomUUID()}`,
    event: body.event,
    external_id: body.external_id,
    audience: body.audience,
    channel: body.channel,
    status: "pending",
    created_at: now,
    payload: body.payload ?? {},
  };

  try {
    const doc = getDdb(region);
    await doc.send(
      new PutCommand({
        TableName: tableName,
        Item: record,
      })
    );

    return NextResponse.json({ success: true, item: record });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to persist notification",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
``