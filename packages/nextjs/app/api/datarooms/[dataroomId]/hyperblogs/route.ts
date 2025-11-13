import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { HyperBlogListResponse } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/datarooms/[dataroomId]/hyperblogs
 * Fetch paginated list of HyperBlogs for a specific DataRoom
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ dataroomId: string }> }) {
  try {
    const { dataroomId } = await params;

    // Validate dataroomId
    if (!dataroomId || typeof dataroomId !== "string" || dataroomId.trim() === "") {
      return NextResponse.json({ error: "Invalid dataroomId parameter" }, { status: 400 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    // Validate and parse limit (default: 10, max: 100)
    let limit = 10;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return NextResponse.json({ error: "Invalid limit parameter (must be 1-100)" }, { status: 400 });
      }
      limit = parsedLimit;
    }

    // Validate and parse offset (default: 0, min: 0)
    let offset = 0;
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return NextResponse.json({ error: "Invalid offset parameter (must be >= 0)" }, { status: 400 });
      }
      offset = parsedOffset;
    }

    // Build backend URL with query params
    const backendUrl = `${config.delve.apiUrl}/datarooms/${dataroomId}/hyperblogs?limit=${limit}&offset=${offset}&include_private=false`;
    console.log("Fetching HyperBlogs from backend:", backendUrl);

    // Make GET request with timeout
    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    // Handle error responses
    if (!response.ok) {
      const apiError = await createErrorFromResponse(response);
      console.error("Backend error fetching HyperBlogs:", apiError);

      if (response.status === 404) {
        return NextResponse.json({ error: "DataRoom not found" }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: apiError.message || "Failed to fetch HyperBlogs",
          details: apiError.details,
        },
        { status: apiError.statusCode },
      );
    }

    // Parse successful response
    const responseData: HyperBlogListResponse = await response.json();
    console.log("HyperBlogs fetched successfully:", {
      dataroom_id: responseData.dataroom_id,
      count: responseData.count,
      hyperblogs_count: responseData.hyperblogs.length,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    console.error("Error in GET /api/datarooms/[dataroomId]/hyperblogs:", error);

    // Handle timeout errors
    if (error.name === "TimeoutError" || error.message?.includes("timeout")) {
      return NextResponse.json({ error: "Request timeout" }, { status: 503 });
    }

    // Handle network errors
    if (error.message?.includes("fetch failed") || error.code === "ECONNREFUSED") {
      return NextResponse.json({ error: "Failed to connect to backend" }, { status: 503 });
    }

    // Generic error
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        details: error.toString(),
      },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS /api/datarooms/[dataroomId]/hyperblogs
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  );
}
