/**
 * DataRoom Preview API route
 * Proxies preview requests to delve backend using data room's description as query
 *
 * Uses bonfire_id directly for graph scoping. The backend uses bonfire_id
 * to build group_ids for graph queries.
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { DataRoomInfo, DataRoomPreviewResponse, DelveResponse } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * POST /api/datarooms/[dataroomId]/preview
 *
 * Fetches preview entities for a data room by using its description as the query
 * Returns 3-5 entities as a preview of what's available in the data room
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ dataroomId: string }> }) {
  try {
    const { dataroomId } = await params;

    // Validate dataroomId
    if (!dataroomId || typeof dataroomId !== "string" || dataroomId.trim() === "") {
      return NextResponse.json({ error: "Invalid dataroomId parameter" }, { status: 400 });
    }

    // First, fetch the data room to get its description
    const dataRoomUrl = `${config.delve.apiUrl}/datarooms/${dataroomId}`;
    console.log("Fetching DataRoom for preview:", dataRoomUrl);

    const dataRoomResponse = await fetch(dataRoomUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    if (!dataRoomResponse.ok) {
      const error = await createErrorFromResponse(dataRoomResponse);
      console.error("Failed to fetch data room:", error);
      return NextResponse.json(
        {
          error: error.message || "Failed to fetch data room",
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    const dataRoom: DataRoomInfo = await dataRoomResponse.json();

    // Fetch preview using the /delve endpoint with bonfire_id
    const previewUrl = `${config.delve.apiUrl}/delve`;

    const previewPayload: any = {
      query: dataRoom.description,
      bonfire_id: dataRoom.bonfire_id,
      num_results: 5, // Fetch 5 entities for preview
    };

    // Include center_node_uuid if available for focused search
    if (dataRoom.center_node_uuid) {
      previewPayload.center_node_uuid = dataRoom.center_node_uuid;
    }

    console.log("Fetching preview entities:", previewUrl, previewPayload);

    const previewResponse = await fetch(previewUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(previewPayload),
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    if (!previewResponse.ok) {
      const error = await createErrorFromResponse(previewResponse);
      console.error("Failed to fetch preview:", error);

      // Provide more helpful error messages
      if (previewResponse.status === 404) {
        return NextResponse.json(
          {
            error: `No knowledge graph data found for bonfire ${dataRoom.bonfire_id}`,
            details: "The bonfire's agent has no knowledge graph data or the graph is empty.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          error: error.message || "Failed to fetch preview",
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    const previewData: DelveResponse = await previewResponse.json();

    // Format as DataRoomPreviewResponse
    const response: DataRoomPreviewResponse = {
      entities: previewData.entities || [],
      episodes: previewData.episodes || [],
      edges: previewData.edges || [],
      dataroom_id: dataroomId,
      description: dataRoom.description,
      num_results: previewData.entities?.length || 0,
    };

    console.log("Preview fetched successfully:", {
      dataroom_id: dataroomId,
      entity_count: response.entities.length,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error in POST /api/datarooms/[dataroomId]/preview:", error);

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
 * OPTIONS /api/datarooms/[dataroomId]/preview
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  );
}
