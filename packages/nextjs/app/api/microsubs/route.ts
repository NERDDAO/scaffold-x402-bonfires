/**
 * Microsubs list API route
 * Proxies requests to delve's /microsubs endpoint to avoid CORS issues
 */
import { NextResponse } from "next/server";
import { config, isValidAddress } from "@/lib/config";
import type { MicrosubListResponse } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/microsubs
 *
 * Fetches list of microsubs for a wallet address from delve backend
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const wallet_address = url.searchParams.get("wallet_address");

    // Validate wallet_address parameter
    if (!wallet_address) {
      return NextResponse.json({ error: "wallet_address query parameter is required" }, { status: 400 });
    }

    // Validate wallet_address format (0x + 40 hex characters)
    if (!isValidAddress(wallet_address)) {
      return NextResponse.json(
        { error: "Invalid wallet_address format. Expected 0x followed by 40 hexadecimal characters." },
        { status: 400 },
      );
    }

    const delveUrl = `${config.delve.apiUrl}/microsubs?wallet_address=${encodeURIComponent(wallet_address)}`;

    console.log(`Fetching microsubs for wallet: ${wallet_address}`);

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
    const responseData: MicrosubListResponse = await delveResponse.json();

    console.log("Microsubs fetched successfully:", {
      total: responseData.total_count,
      active: responseData.active_count,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error in microsubs API route:", error);

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
 * OPTIONS /api/microsubs
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
