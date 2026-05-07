import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

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

export async function POST() {
  const region = process.env.AWS_REGION;
  const tableName = process.env.DDB_TABLE_SYNC;

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFY_FROM_EMAIL;
  const managerEmail = process.env.NOTIFY_MANAGER_EMAIL;

  if (!region || !tableName || !resendKey || !fromEmail || !managerEmail) {
    return NextResponse.json(
      { success: false, message: "Missing required environment variables" },
      { status: 500 }
    );
  }

  const doc = getDdb(region);

  // ✅ Scan WITHOUT Limit – filter in code
  const scan = await doc.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression:
        "PK = :pk AND #status = :pending AND channel = :email",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":pk": "NOTIFICATION",
        ":pending": "pending",
        ":email": "email",
      },
    })
  );

  const notif = scan.Items?.[0];

  if (!notif) {
    return NextResponse.json({
      success: true,
      message: "No pending notification to send",
    });
  }

  const subject = `SyncService: RO Completed (${notif.external_id})`;

  const html = `
    <h2>Repair Order Completed</h2>
    <p><strong>RO:</strong> ${notif.external_id}</p>
    <p><strong>Reason:</strong> ${
      notif.payload?.resolved_reason ?? "N/A"
    }</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: managerEmail,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: notif.PK, SK: notif.SK },
        UpdateExpression: "SET #status = :failed",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":failed": "failed" },
      })
    );

    return NextResponse.json(
      { success: false, message: "Email send failed" },
      { status: 500 }
    );
  }

  await doc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: notif.PK, SK: notif.SK },
      UpdateExpression: "SET #status = :sent",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":sent": "sent" },
    })
  );

  return NextResponse.json({
    success: true,
    message: "Email sent successfully",
  });
}