/**
 * Bonfire preview API route
 * Proxies preview requests to delve's /delve endpoint for entity preview
 *
 * Uses bonfire_id directly for graph scoping. The backend uses bonfire_id
 * to build group_ids for graph queries, eliminating the need to fetch agents.
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { DelveResponse } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * POST /api/bonfires/[bonfire_id]/preview
 *
 * Fetches preview entities from a bonfire using a search query
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ bonfire_id: string }> }) {
  try {
    // Extract bonfire_id from route params (Next.js 15 requires awaiting params)
    const { bonfire_id } = await params;

    if (!bonfire_id || typeof bonfire_id !== "string") {
      return NextResponse.json({ error: "Invalid bonfire_id parameter" }, { status: 400 });
    }

    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // Validate required fields
    if (!body.query || typeof body.query !== "string" || body.query.trim() === "") {
      return NextResponse.json({ error: "Missing or empty required field: query" }, { status: 400 });
    }

    // Construct delve request using bonfire_id directly
    const delveRequest = {
      bonfire_id: bonfire_id,
      query: body.query,
      num_results: body.num_results || 10,
    };

    // Forward to delve backend
    const delveUrl = `${config.delve.apiUrl}/delve`;

    console.log(`Forwarding preview request to: ${delveUrl}`, {
      bonfire_id: bonfire_id,
      query: body.query,
      num_results: delveRequest.num_results,
    });

    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(delveRequest),
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
    const responseData: DelveResponse = await delveResponse.json();

    console.log("Preview fetch successful:", {
      bonfire_id: bonfire_id,
      query: body.query,
      entity_count: responseData.metrics?.entity_count || 0,
      episode_count: responseData.metrics?.episode_count || 0,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error in preview API route:", error);

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
 * OPTIONS /api/bonfires/[bonfire_id]/preview
 *
 * Handle CORS preflight requests
 */
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
