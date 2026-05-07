import { NextResponse } from "next/server";
import Stripe from "stripe";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";

/* ======================== Helpers ======================== */

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const stripe = new Stripe(mustEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-03-25.dahlia",
});

const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: mustEnv("AWS_REGION") })
);

function resolveTierFromPriceId(priceId: string | null): string {
  if (!priceId) return "unknown";
  if (priceId === process.env.STRIPE_PRICE_STARTER_ID) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO_ID) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE_ID) return "enterprise";
  return "unknown";
}

async function hydrateFromSubscription(subId: string) {
  const sub = (await stripe.subscriptions.retrieve(...)) as any;
    expand: ["items.data.price"],
  });

  return {
    stripe_customer_id: String(sub.customer),
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: sub.items.data[0]?.price?.id ?? null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? null,
  };
}

/* ======================== Webhook ======================== */

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  const rawBody = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      mustEnv("STRIPE_WEBHOOK_SECRET")
    );
  } catch (err: any) {
    return new NextResponse(err.message, { status: 400 });
  }

  const now = new Date().toISOString();
  const table = mustEnv("DDB_TABLE_SYNC");

  // ----------- Dedup -----------
  const dedupeKey = { PK: "STRIPE_EVENT", SK: `EVT#${event.id}` };

  const seen = await doc.send(
    new GetCommand({ TableName: table, Key: dedupeKey })
  );

  if (seen.Item) {
    return NextResponse.json({ received: true });
  }

  await doc.send(
    new PutCommand({
      TableName: table,
      Item: {
        ...dedupeKey,
        event_id: event.id,
        type: event.type,
        processed_at: now,
      },
    })
  );

  // ----------- Billing Resolution -----------

  let billingData: any = null;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.subscription) {
      billingData = await hydrateFromSubscription(
        String(session.subscription)
      );
    }
  }

  if (
    event.type === "invoice_payment.paid" ||
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_succeeded"
  ) {
    const payload: any = event.data.object;
    const invoiceId = payload.invoice;
    if (invoiceId) {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      if (invoice.subscription) {
        billingData = await hydrateFromSubscription(
          String(invoice.subscription)
        );
      }
    }
  }

  if (!billingData) {
    return NextResponse.json({ received: true });
  }

  const tier = resolveTierFromPriceId(billingData.price_id);

  await doc.send(
    new PutCommand({
      TableName: table,
      Item: {
        PK: "BILLING",
        SK: `CUST#${billingData.stripe_customer_id}`,
        ...billingData,
        tier,
        updated_at: now,
      },
    })
  );

  return NextResponse.json({ received: true });
}
``