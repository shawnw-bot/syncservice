import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

export type AccessDecision = {
  allowed: boolean;
  tier: "starter" | "pro" | "enterprise" | null;
  status: string | null;
  reason?: string;
};

// ✅ DEV MODE — FORCE FULL ACCESS EVERYWHERE
const DEV_OVERRIDE_ALLOW_ALL = true;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
  })
);

export async function checkAccessByCustomerId(
  stripeCustomerId: string
): Promise<AccessDecision> {
  // ✅ HARD BYPASS — THIS MUST BE FIRST
  if (DEV_OVERRIDE_ALLOW_ALL) {
    return {
      allowed: true,
      tier: "pro",
      status: "active",
    };
  }

  const table = mustEnv("DDB_TABLE_SYNC");

  const result = await doc.send(
    new GetCommand({
      TableName: table,
      Key: {
        PK: "BILLING",
        SK: `CUST#${stripeCustomerId}`,
      },
    })
  );

  if (!result.Item) {
    return {
      allowed: false,
      tier: null,
      status: null,
      reason: "no_billing_record",
    };
  }

  const { status, tier } = result.Item as {
    status?: string;
    tier?: "starter" | "pro" | "enterprise";
  };

  if (status === "active") {
    return {
      allowed: true,
      tier: tier ?? null,
      status,
    };
  }

  return {
    allowed: false,
    tier: tier ?? null,
    status: status ?? null,
    reason: "subscription_inactive",
  };
}