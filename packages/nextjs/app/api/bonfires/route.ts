/**
 * Bonfires list API route
 * Proxies requests to delve's /bonfires endpoint to avoid CORS issues
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { BonfireListResponse } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/bonfires
 *
 * Fetches list of available bonfires from delve backend
 */
export async function GET() {
  try {
    const delveUrl = `${config.delve.apiUrl}/bonfires`;

    console.log(`Fetching bonfires from: ${delveUrl}`);

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
    const responseData: BonfireListResponse = await delveResponse.json();

    console.log("Bonfires fetched successfully:", {
      count: responseData.bonfires?.length || 0,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error in bonfires API route:", error);

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
 * OPTIONS /api/bonfires
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
