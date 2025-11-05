/**
 * Bonfire agents API route
 * Proxies requests to delve's /bonfires/{bonfire_id}/agents endpoint to avoid CORS issues
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { BonfireAgentsResponse } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/bonfires/[bonfire_id]/agents
 *
 * Fetches list of agents for a specific bonfire from delve backend
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ bonfire_id: string }> }) {
  try {
    // Extract bonfire_id from route params
    const { bonfire_id } = await params;

    if (!bonfire_id || typeof bonfire_id !== "string") {
      return NextResponse.json({ error: "Invalid bonfire_id parameter" }, { status: 400 });
    }

    const delveUrl = `${config.delve.apiUrl}/bonfires/${bonfire_id}/agents`;

    console.log(`Fetching agents from: ${delveUrl}`);

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
    const responseData: BonfireAgentsResponse = await delveResponse.json();

    console.log("Agents fetched successfully:", {
      bonfire_id,
      count: responseData.agents?.length || 0,
      total_agents: responseData.total_agents,
      active_agents: responseData.active_agents,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error in bonfire agents API route:", error);

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
 * OPTIONS /api/bonfires/[bonfire_id]/agents
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
