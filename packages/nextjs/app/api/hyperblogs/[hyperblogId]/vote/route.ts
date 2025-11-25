import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createErrorFromResponse } from "@/lib/types/errors";

export async function POST(request: NextRequest, { params }: { params: Promise<{ hyperblogId: string }> }) {
  try {
    const { hyperblogId } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { vote_type, user_address } = body;

    if (vote_type !== "upvote" && vote_type !== "downvote") {
      return NextResponse.json({ error: "Invalid vote_type. Must be 'upvote' or 'downvote'" }, { status: 400 });
    }

    // Basic validation for Ethereum address
    if (!user_address || typeof user_address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(user_address)) {
      return NextResponse.json({ error: "Invalid user_address" }, { status: 400 });
    }

    const delveUrl = `${config.delve.apiUrl}/hyperblogs/${hyperblogId}/vote`;

    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vote_type, user_address }),
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    if (!delveResponse.ok) {
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

    console.log("Vote recorded:", {
      hyperblog_id: hyperblogId,
      vote_type,
      user_address,
    });

    return NextResponse.json(updatedHyperBlog, { status: 200 });
  } catch (error) {
    console.error("Error in HyperBlog vote API route:", error);

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
