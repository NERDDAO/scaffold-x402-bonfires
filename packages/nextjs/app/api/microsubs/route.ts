/**
 * Microsubs API route
 * Proxies requests to delve's /microsubs endpoint for subscription management
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { MicrosubInfo } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * GET /api/microsubs
 *
 * List microsub subscriptions for a wallet
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet_address") || searchParams.get("address");
    const onlyDataRooms = searchParams.get("only_data_rooms") === "true";
    const dataroomId = searchParams.get("dataroom_id");

    if (!walletAddress) {
      return NextResponse.json({ error: "wallet_address query parameter is required" }, { status: 400 });
    }

    // Build backend request URL
    const params = new URLSearchParams({
      wallet_address: walletAddress,
    });
    if (onlyDataRooms) {
      params.append("only_data_rooms", "true");
    }
    if (dataroomId) {
      params.append("dataroom_id", dataroomId);
    }

    const delveUrl = `${config.delve.apiUrl}/microsubs?${params.toString()}`;

    console.log(`Fetching microsubs for wallet: ${walletAddress}`);

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
    const responseData = await delveResponse.json();

    console.log("Microsubs fetched:", {
      total_count: responseData.total_count || 0,
      active_count: responseData.active_count || 0,
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error in microsubs GET API route:", error);

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
 * POST /api/microsubs
 *
 * Create new microsub subscription
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.payment_header) {
      return NextResponse.json({ error: "payment_header is required" }, { status: 400 });
    }
    // Comment 2: Relax validation to not require agent_id when dataroom_id is provided
    if (!body.agent_id && !body.dataroom_id) {
      return NextResponse.json({ error: "agent_id or dataroom_id is required" }, { status: 400 });
    }

    console.log(`Creating microsub for agent: ${body.agent_id || "inferred from dataroom"}`);

    // Build backend request with default fallbacks (Comment 7)
    const backendBody: any = {
      payment_header: body.payment_header,
      expected_amount: body.expected_amount || config.payment.amount,
      query_limit: body.query_limit || config.payment.queryLimit,
      expiration_days: body.expiration_days || config.payment.expirationDays,
    };

    // Only include agent_id if provided (Comment 2)
    if (body.agent_id) {
      backendBody.agent_id = body.agent_id;
    }

    // Include dataroom_id when present
    if (body.dataroom_id) {
      backendBody.dataroom_id = body.dataroom_id;
    }

    const delveUrl = `${config.delve.apiUrl}/microsubs`;

    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendBody),
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
    const responseData: MicrosubInfo = await delveResponse.json();

    console.log("Microsub created:", {
      tx_hash: responseData.tx_hash,
      queries_remaining: responseData.queries_remaining,
    });

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error("Error in microsubs POST API route:", error);

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
 * OPTIONS /api/microsubs
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
