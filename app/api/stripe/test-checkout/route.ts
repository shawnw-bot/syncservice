import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) {
    console.error(`ENV MISSING: ${name}`);
    throw new Error(`Missing ${name}`);
  }
  return v;
}

function priceIdForTier(tier: string) {
  if (tier === "starter") return mustEnv("STRIPE_PRICE_STARTER_ID");
  if (tier === "pro") return mustEnv("STRIPE_PRICE_PRO_ID");
  if (tier === "enterprise") return mustEnv("STRIPE_PRICE_ENTERPRISE_ID");
  throw new Error(`Invalid tier: ${tier}`);
}

export async function GET(req: Request) {
  try {
    const tier =
      new URL(req.url).searchParams.get("tier") ?? "starter";

    const secretKey = mustEnv("STRIPE_SECRET_KEY");
    console.log("Stripe key prefix:", secretKey.slice(0, 10));

    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-03-25.dahlia",
    });

    const priceId = priceIdForTier(tier);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        "http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:3000/billing/cancel",
      metadata: { tier },
    });

    return NextResponse.json({
      ok: true,
      tier,
      price_id: priceId,
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (err: any) {
    console.error("TEST CHECKOUT ERROR FULL:", err);
    return NextResponse.json(
      { ok: false, message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}