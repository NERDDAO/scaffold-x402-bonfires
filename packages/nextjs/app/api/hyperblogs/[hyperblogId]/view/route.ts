import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createErrorFromResponse } from "@/lib/types/errors";

export async function POST(request: NextRequest, { params }: { params: Promise<{ hyperblogId: string }> }) {
  try {
    const { hyperblogId } = await params;

    let body = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Body is optional for view tracking, ignore JSON parse errors on empty body
    }

    const { user_address, session_id } = body as any;

    if (!hyperblogId) {
      return NextResponse.json({ error: "Invalid hyperblogId" }, { status: 400 });
    }

    const delveUrl = `${config.delve.apiUrl}/hyperblogs/${hyperblogId}/view`;

    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_address, session_id }),
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    if (!delveResponse.ok) {
      // If it's a 404, it might mean the blog doesn't exist, which is a client error.
      // But we treat backend errors similarly.
      const error = await createErrorFromResponse(delveResponse);
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    const updatedHyperBlog = await delveResponse.json();

    console.log("View incremented:", {
      hyperblog_id: hyperblogId,
      user_address,
    });

    return NextResponse.json(updatedHyperBlog, { status: 200 });
  } catch (error) {
    console.error("Error in HyperBlog view API route:", error);

    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timeout. Delve backend did not respond in time." }, { status: 503 });
    }

    if (error instanceof Error && error.message.includes("fetch")) {
      return NextResponse.json(
        { error: "Failed to connect to Delve backend. Please check the backend is running." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
