import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const doc = DynamoDBDocumentClient.from(client);

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_BASE_URL || request.headers.get("origin") || "http://localhost:3000";
}

function extractCustomerContact(ticket: any) {
  const payload = ticket?.payload ?? {};
  const phone =
    payload.customer_phone ??
    payload.phone ??
    payload.customerPhone ??
    payload.customer?.phone ??
    null;

  const email =
    payload.customer_email ??
    payload.email ??
    payload.customerEmail ??
    payload.customer?.email ??
    null;

  return { phone, email };
}

async function sendEmailResend(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!key || !from) {
    return { ok: false, provider: "resend", error: "Missing RESEND_API_KEY or RESEND_FROM" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    return { ok: false, provider: "resend", error: `Resend failed: ${res.status} ${msg}` };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true, provider: "resend", data };
}

async function sendSmsTwilio(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { ok: false, provider: "twilio", error: "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN or TWILIO_FROM_NUMBER" };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", from);
  form.set("Body", body);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    return { ok: false, provider: "twilio", error: `Twilio failed: ${res.status} ${msg}` };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true, provider: "twilio", data };
}

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
    const channel = body?.channel ?? "both"; // sms | email | both

    if (!externalId || typeof externalId !== "string") {
      return NextResponse.json({ success: false, message: "Missing external_id" }, { status: 400 });
    }
    if (!note || typeof note !== "string" || !note.trim()) {
      return NextResponse.json({ success: false, message: "Missing note" }, { status: 400 });
    }

    const scan = await doc.send(new ScanCommand({ TableName: tableName }));
    const items = scan.Items ?? [];
    const match = items.find((it: any) => it?.external_id === externalId);

    if (!match) {
      return NextResponse.json({ success: false, message: "Ticket not found" }, { status: 404 });
    }

    const baseUrl = getBaseUrl(request);
    const trackingLink = `${baseUrl}/track/${encodeURIComponent(externalId)}`;

    const { phone, email } = extractCustomerContact(match);

    const willSendSms = (channel === "sms" || channel === "both") && !!phone;
    const willSendEmail = (channel === "email" || channel === "both") && !!email;

    const outboundMessage = `Update on your repair: ${note.trim()}\nTrack here: ${trackingLink}`;
    const subject = `Update on your repair (${externalId})`;

    // ✅ Attempt real sends (safe fallback if not configured or fails)
    const smsResult = willSendSms ? await sendSmsTwilio(phone, outboundMessage) : null;
    const emailResult = willSendEmail ? await sendEmailResend(email, subject, outboundMessage) : null;

    const now = new Date().toISOString();

    const logEntry = {
      created_at: now,
      channel,
      delivered_to: {
        phone: willSendSms ? phone : null,
        email: willSendEmail ? email : null,
      },
      tracking_link: trackingLink,
      message: outboundMessage,
      provider_results: {
        sms: smsResult,
        email: emailResult,
      },
      status:
        (smsResult?.ok || emailResult?.ok)
          ? "sent"
          : (willSendSms || willSendEmail)
            ? "failed_but_logged"
            : "no_contact_on_ticket",
    };

    const updated = await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: match.PK, SK: match.SK },
        UpdateExpression:
          "SET last_notification = :log, customer_notifications = list_append(if_not_exists(customer_notifications, :empty), :one)",
        ExpressionAttributeValues: {
          ":log": logEntry,
          ":empty": [],
          ":one": [logEntry],
        },
        ReturnValues: "ALL_NEW",
      })
    );

    // Keep UI smooth: always return success true (but with status)
    return NextResponse.json({
      success: true,
      notification: logEntry,
      item: updated.Attributes,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: "Failed to send update", errorMessage: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
