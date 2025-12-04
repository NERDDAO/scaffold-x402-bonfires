/**
 * Entity lookup by UUID API route
 * Direct entity fetch without expensive delve queries
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/knowledge_graph/entity/[uuid]
 *
 * Fetches a single entity by UUID from the knowledge graph
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const { uuid } = await params;

    if (!uuid || typeof uuid !== "string") {
      return NextResponse.json({ error: "Invalid uuid parameter" }, { status: 400 });
    }

    // Get optional bonfire_id from query params
    const searchParams = request.nextUrl.searchParams;
    const bonfireId = searchParams.get("bonfire_id");

    // Build backend URL
    const backendUrl = new URL(`${config.delve.apiUrl}/knowledge_graph/entity/${uuid}`);
    if (bonfireId) {
      backendUrl.searchParams.append("bonfire_id", bonfireId);
    }

    console.log(`Fetching entity by UUID: ${backendUrl.toString()}`);

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    if (!response.ok) {
      const error = await createErrorFromResponse(response);
      return NextResponse.json({ error: error.message, details: error.details }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error fetching entity:", error);

    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timeout" }, { status: 503 });
    }

    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
