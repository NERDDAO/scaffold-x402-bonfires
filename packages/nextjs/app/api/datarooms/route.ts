/**
 * DataRooms marketplace API route
 * Proxies requests to delve's /datarooms endpoint
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { CreateDataRoomRequest, DataRoomInfo, DataRoomListResponse } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/datarooms
 *
 * Fetches all active DataRooms from backend marketplace
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
    const include_inactive = url.searchParams.get("include_inactive") === "true";
    const bonfire_id = url.searchParams.get("bonfire_id");
    const creator_id = url.searchParams.get("creator_id");

    // Validate parameters
    if (limit < 1 || limit > 100) {
      return NextResponse.json({ error: "limit must be between 1 and 100" }, { status: 400 });
    }
    if (offset < 0) {
      return NextResponse.json({ error: "offset must be non-negative" }, { status: 400 });
    }

    // Build backend URL
    let delveUrl = `${config.delve.apiUrl}/datarooms?limit=${limit}&offset=${offset}&include_inactive=${include_inactive}`;
    if (bonfire_id) {
      delveUrl += `&bonfire_id=${encodeURIComponent(bonfire_id)}`;
    }
    if (creator_id) {
      delveUrl += `&creator_id=${encodeURIComponent(creator_id)}`;
    }

    console.log(`Fetching data rooms: limit=${limit}, offset=${offset}`);

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
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    // Parse and return successful response
    const responseData: DataRoomListResponse = await delveResponse.json();

    console.log("DataRooms fetched:", { count: responseData.count, limit, offset });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error in datarooms GET API route:", error);

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
 * POST /api/datarooms
 *
 * Create new DataRoom marketplace listing
 */
export async function POST(request: Request) {
  try {
    const body: CreateDataRoomRequest = await request.json();

    // Validate required fields
    if (!body.agent_id) {
      return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
    }
    if (!body.bonfire_id) {
      return NextResponse.json({ error: "bonfire_id is required" }, { status: 400 });
    }
    if (!body.description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (body.price_usd === undefined || body.price_usd === null) {
      return NextResponse.json({ error: "price_usd is required" }, { status: 400 });
    }

    // Validate field constraints
    if (body.description.length < 10 || body.description.length > 1000) {
      return NextResponse.json({ error: "description must be between 10 and 1000 characters" }, { status: 400 });
    }
    if (body.system_prompt === undefined || body.system_prompt === null) {
      return NextResponse.json({ error: "system_prompt is required (can be empty string)" }, { status: 400 });
    }
    if (body.system_prompt.length > 2000) {
      return NextResponse.json({ error: "system_prompt must be at most 2000 characters" }, { status: 400 });
    }
    if (body.price_usd <= 0) {
      return NextResponse.json({ error: "price_usd must be greater than 0" }, { status: 400 });
    }
    if (body.query_limit !== undefined && (body.query_limit < 1 || body.query_limit > 1000)) {
      return NextResponse.json({ error: "query_limit must be between 1 and 1000" }, { status: 400 });
    }
    if (body.expiration_days !== undefined && (body.expiration_days < 1 || body.expiration_days > 365)) {
      return NextResponse.json({ error: "expiration_days must be between 1 and 365" }, { status: 400 });
    }

    console.log(`Creating data room for agent: ${body.agent_id}, bonfire: ${body.bonfire_id}`);

    const delveUrl = `${config.delve.apiUrl}/datarooms`;

    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    // Handle non-OK responses
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

    // Parse and return successful response
    const responseData: DataRoomInfo = await delveResponse.json();

    console.log("DataRoom created:", { id: responseData.id, creator_id: responseData.creator_id });

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error("Error in datarooms POST API route:", error);

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

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // Generic error response
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS /api/datarooms
 *
 * Handle CORS preflight requests
 */
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
