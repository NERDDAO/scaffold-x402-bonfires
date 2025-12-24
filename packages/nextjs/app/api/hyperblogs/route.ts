import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { AggregatedHyperBlogListResponse } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/hyperblogs
 *
 * Retrieves aggregated public HyperBlogs across all datarooms.
 *
 * Query Parameters:
 * - limit: number (1-100, default: 10) - Number of results per page
 * - offset: number (>=0, default: 0) - Pagination offset
 * - dataroom_id: string (optional) - Filter by specific dataroom
 * - status: string (optional) - Filter by status: generating, completed, failed
 * - generation_mode: string (optional) - Filter by generation mode: blog, card
 *
 * Returns:
 * - 200: AggregatedHyperBlogListResponse with public HyperBlogs
 * - 400: Invalid query parameters
 * - 404: No HyperBlogs found
 * - 503: Backend timeout or connection error
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Query Parameter Parsing and Validation
    const searchParams = request.nextUrl.searchParams;

    // Parse and validate limit
    const limitParam = searchParams.get("limit");
    let limit = 10; // default
    if (limitParam !== null) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return NextResponse.json({ error: "Invalid limit parameter. Must be between 1 and 100." }, { status: 400 });
      }
      limit = parsedLimit;
    }

    // Parse and validate offset
    const offsetParam = searchParams.get("offset");
    let offset = 0; // default
    if (offsetParam !== null) {
      const parsedOffset = parseInt(offsetParam, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return NextResponse.json({ error: "Invalid offset parameter. Must be 0 or greater." }, { status: 400 });
      }
      offset = parsedOffset;
    }

    // Parse and validate optional dataroom_id filter
    const dataroomId = searchParams.get("dataroom_id");
    if (dataroomId !== null && dataroomId.trim() === "") {
      return NextResponse.json({ error: "Invalid dataroom_id parameter. Cannot be empty." }, { status: 400 });
    }

    // Parse and validate optional status filter
    const status = searchParams.get("status");
    const validStatuses = ["generating", "completed", "failed"];
    if (status !== null && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status parameter. Must be one of: ${validStatuses.join(", ")}.` },
        { status: 400 },
      );
    }

    // Parse and validate optional generation_mode filter
    const generationMode = searchParams.get("generation_mode");
    const validModes = ["blog", "card"];
    if (generationMode !== null && !validModes.includes(generationMode)) {
      return NextResponse.json(
        { error: `Invalid generation_mode parameter. Must be one of: ${validModes.join(", ")}.` },
        { status: 400 },
      );
    }

    // 2. Backend URL Construction
    const backendUrl = new URL(`${config.delve.apiUrl}/datarooms/hyperblogs`);
    backendUrl.searchParams.append("limit", limit.toString());
    backendUrl.searchParams.append("offset", offset.toString());
    backendUrl.searchParams.append("is_public", "true");

    if (dataroomId) {
      backendUrl.searchParams.append("dataroom_id", dataroomId);
    }

    if (status) {
      backendUrl.searchParams.append("status", status);
    }

    if (generationMode) {
      backendUrl.searchParams.append("generation_mode", generationMode);
    }

    console.log(`[GET /api/hyperblogs] Fetching from backend: ${backendUrl.toString()}`);

    // 3. Backend Request
    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    // 4. Response Handling
    if (!response.ok) {
      const errorResult = await createErrorFromResponse(response);

      if (response.status === 404) {
        return NextResponse.json({ error: "No HyperBlogs found" }, { status: 404 });
      }

      return NextResponse.json(
        { error: errorResult.message, details: errorResult.details },
        { status: response.status },
      );
    }

    const responseData: AggregatedHyperBlogListResponse = await response.json();

    console.log(`[GET /api/hyperblogs] Success:`, {
      count: responseData.count,
      hyperblogs_count: responseData.hyperblogs.length,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error: unknown) {
    // 5. Error Handling
    console.error("[GET /api/hyperblogs] Error:", error);

    if (error instanceof Error) {
      // Handle TimeoutError
      if (error.name === "TimeoutError") {
        return NextResponse.json({ error: "Request timeout" }, { status: 503 });
      }

      // Handle network errors (fetch failed, ECONNREFUSED)
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        return NextResponse.json({ error: "Failed to connect to backend" }, { status: 503 });
      }

      // Generic error fallback
      return NextResponse.json(
        {
          error: error.message || "Internal server error",
          details: error.toString(),
        },
        { status: 500 },
      );
    }

    // Unknown error type fallback
    return NextResponse.json(
      {
        error: "Internal server error",
        details: String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS /api/hyperblogs
 *
 * CORS preflight handler
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
