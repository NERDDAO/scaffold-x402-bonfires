import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createErrorFromResponse } from "@/lib/types/errors";

export async function GET(request: NextRequest, { params }: { params: Promise<{ hyperblogId: string }> }) {
  try {
    const { hyperblogId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "50";
    const offset = searchParams.get("offset") || "0";

    const delveUrl = `${config.delve.apiUrl}/datarooms/hyperblogs/${hyperblogId}/comments?limit=${limit}&offset=${offset}`;

    const delveResponse = await fetch(delveUrl, {
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    if (!delveResponse.ok) {
      if (delveResponse.status === 404) {
        return NextResponse.json({ error: "HyperBlog not found" }, { status: 404 });
      }
      const error = await createErrorFromResponse(delveResponse);
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.statusCode });
    }

    const comments = await delveResponse.json();
    return NextResponse.json(comments, { status: 200 });
  } catch (error) {
    console.error("Error in HyperBlog comments GET API route:", error);

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ hyperblogId: string }> }) {
  try {
    const { hyperblogId } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { comment_text, user_wallet } = body;

    if (!comment_text || typeof comment_text !== "string" || comment_text.trim().length === 0) {
      return NextResponse.json({ error: "Invalid comment_text" }, { status: 400 });
    }

    // Sanitize and validate
    const sanitizedComment = comment_text.trim();
    if (sanitizedComment.length > 1000) {
      return NextResponse.json({ error: "Comment too long (max 1000 chars)" }, { status: 413 });
    }

    if (!user_wallet || typeof user_wallet !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(user_wallet)) {
      return NextResponse.json({ error: "Invalid user_wallet" }, { status: 400 });
    }

    const delveUrl = `${config.delve.apiUrl}/datarooms/hyperblogs/${hyperblogId}/comments`;

    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: sanitizedComment, user_wallet }),
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    if (!delveResponse.ok) {
      if (delveResponse.status === 404) {
        return NextResponse.json({ error: "HyperBlog not found" }, { status: 404 });
      }
      const error = await createErrorFromResponse(delveResponse);
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.statusCode });
    }

    const newComment = await delveResponse.json();

    console.log("Comment added:", {
      hyperblog_id: hyperblogId,
      user_wallet,
      comment_length: sanitizedComment.length,
    });

    return NextResponse.json(newComment, { status: 200 });
  } catch (error) {
    console.error("Error in HyperBlog comments POST API route:", error);

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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
