/**
 * Agents API route
 * Proxies requests to delve's /agents endpoint
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/agents
 *
 * List agents, optionally filtered by bonfire, username, or active status
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bonfireId = url.searchParams.get("bonfire_id");
    const username = url.searchParams.get("username");
    const activeOnly = url.searchParams.get("active_only") === "true";

    // Build backend URL
    let delveUrl = `${config.delve.apiUrl}/agents?active_only=${activeOnly}`;
    if (bonfireId) {
      delveUrl += `&bonfire_id=${encodeURIComponent(bonfireId)}`;
    }
    if (username) {
      delveUrl += `&username=${encodeURIComponent(username)}`;
    }

    const delveResponse = await fetch(delveUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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

    const responseData = await delveResponse.json();
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error in agents GET API route:", error);

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

/**
 * POST /api/agents
 *
 * Create a new agent
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.username) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const delveUrl = `${config.delve.apiUrl}/agents`;

    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

    const responseData = await delveResponse.json();
    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error("Error in agents POST API route:", error);

    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timeout. Delve backend did not respond in time." }, { status: 503 });
    }

    if (error instanceof Error && error.message.includes("fetch")) {
      return NextResponse.json(
        { error: "Failed to connect to Delve backend. Please check the backend is running." },
        { status: 503 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
