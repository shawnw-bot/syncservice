import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const baseCallsUrl = process.env.AWS_CALLS_URL;

    if (!baseCallsUrl) {
      console.error("AWS_CALLS_URL missing");
      return NextResponse.json(
        { error: "AWS_CALLS_URL is not set" },
        { status: 500 }
      );
    }

    // Convert ".../calls" → ".../call"
    const callUrl = baseCallsUrl.replace(/\/calls\/?$/, "/call");

    const body = await req.json();
    console.log("POST /api/call → forwarding to:", callUrl);
    console.log("Payload:", body);

    const upstream = await fetch(callUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    console.log("AWS response status:", upstream.status);
    console.log("AWS response body:", text);

    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error("POST /api/call crashed:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: String(error) },
      { status: 500 }
    );
  }
}
``