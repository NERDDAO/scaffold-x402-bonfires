/**
 * HyperBlog polling API route
 * Forwards requests to delve's /hyperblogs/{hyperblogId} endpoint for status checking
 *
 * Used for polling blog generation status during async generation.
 * This route acts as a simple proxy.
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { HyperBlogInfo } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/hyperblogs/[hyperblogId]
 *
 * Forwards HyperBlog status requests to delve backend
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ hyperblogId: string }> }) {
  try {
    // Extract hyperblogId from route params (await required in Next.js 15+)
    const { hyperblogId } = await params;

    // Validate hyperblogId
    if (!hyperblogId || typeof hyperblogId !== "string" || hyperblogId.trim() === "") {
      return NextResponse.json({ error: "Invalid hyperblogId parameter" }, { status: 400 });
    }

    // Forward to delve backend
    // Updated to use the new /datarooms/hyperblogs/{id} path
    const delveUrl = `${config.delve.apiUrl}/datarooms/hyperblogs/${hyperblogId}`;

    console.log(`Fetching HyperBlog status from: ${delveUrl}`);

    const delveResponse = await fetch(delveUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    // Handle non-OK responses
    if (!delveResponse.ok) {
      const error = await createErrorFromResponse(delveResponse);

      // Special handling for 404
      if (delveResponse.status === 404) {
        return NextResponse.json({ error: "HyperBlog not found" }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    // Parse and return successful response
    const responseData: HyperBlogInfo = await delveResponse.json();

    console.log("HyperBlog status fetched successfully:", {
      hyperblog_id: responseData.id,
      generation_status: responseData.generation_status,
      word_count: responseData.word_count,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error in HyperBlog status API route:", error);

    // Handle timeout errors
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timeout. Delve backend did not respond in time." }, { status: 503 });
    }

    // Handle network errors
    if (error instanceof Error && error.message.includes("fetch")) {
      return NextResponse.json(
        { error: "Failed to connect to Delve backend. Please check the backend is running." },
        { status: 503 },
      );
    }

    // Generic error response
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS /api/hyperblogs/[hyperblogId]
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
