import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id?: string } }
) {
  try {
    const baseUrl = process.env.AWS_CALLS_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "AWS_CALLS_URL is not set" },
        { status: 500 }
      );
    }

    if (!params?.id) {
      return NextResponse.json(
        { error: "Missing call id" },
        { status: 400 }
      );
    }

    const url = `${baseUrl}/${params.id}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "Upstream error", detail: text },
        { status: response.status }
      );
    }

    const item = await response.json();
    return NextResponse.json(item);
  } catch (error) {
    console.error("GET /api/calls/[id] failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
``