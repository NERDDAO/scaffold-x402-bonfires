import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { DataRoomInfo } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/datarooms/[dataroomId]
 * Fetch a single DataRoom by ID from the backend
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ dataroomId: string }> }) {
  try {
    const { dataroomId } = await params;

    // Validate dataroomId
    if (!dataroomId || typeof dataroomId !== "string" || dataroomId.trim() === "") {
      return NextResponse.json({ error: "Invalid dataroomId parameter" }, { status: 400 });
    }

    // Build backend URL
    const backendUrl = `${config.delve.apiUrl}/datarooms/${dataroomId}`;
    console.log("Fetching DataRoom from backend:", backendUrl);

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
      console.error("Backend error fetching DataRoom:", apiError);

      if (response.status === 404) {
        return NextResponse.json({ error: "DataRoom not found" }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: apiError.message || "Failed to fetch DataRoom",
          details: apiError.details,
        },
        { status: apiError.statusCode },
      );
    }

    // Parse successful response
    const responseData: DataRoomInfo = await response.json();
    console.log("DataRoom fetched successfully:", {
      id: responseData.id,
      creator_wallet: responseData.creator_wallet,
      bonfire_id: responseData.bonfire_id,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    console.error("Error in GET /api/datarooms/[dataroomId]:", error);

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
 * OPTIONS /api/datarooms/[dataroomId]
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
