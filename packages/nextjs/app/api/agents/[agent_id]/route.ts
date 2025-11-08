/**
 * Agent by ID API route
 * Proxies requests to delve's /agents/{agent_id} endpoint
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/agents/{agent_id}
 *
 * Get agent by ID or username
 */
export async function GET(request: Request, { params }: { params: Promise<{ agent_id: string }> }) {
  try {
    const { agent_id: agentId } = await params;

    if (!agentId) {
      return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
    }

    const delveUrl = `${config.delve.apiUrl}/agents/${encodeURIComponent(agentId)}`;

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
    console.error("Error in agent GET API route:", error);

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
