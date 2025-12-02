/**
 * Payment-gated HyperBlog purchase API route
 * Forwards requests to delve's /hyperblogs/purchase endpoint
 *
 * Delve backend handles payment verification, settlement, and blog generation.
 * This route acts as a simple proxy.
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { PurchaseHyperBlogRequest, PurchaseHyperBlogResponse } from "@/lib/types/delve-api";
import { createErrorFromResponse } from "@/lib/types/errors";

/**
 * POST /api/hyperblogs/purchase
 *
 * Forwards payment-gated HyperBlog purchase requests to delve backend
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // Validate required fields
    if (!body.payment_header || typeof body.payment_header !== "string") {
      return NextResponse.json({ error: "Missing required field: payment_header" }, { status: 400 });
    }

    if (!body.dataroom_id || typeof body.dataroom_id !== "string") {
      return NextResponse.json({ error: "Missing required field: dataroom_id" }, { status: 400 });
    }

    if (!body.user_query || typeof body.user_query !== "string") {
      return NextResponse.json({ error: "Missing required field: user_query" }, { status: 400 });
    }

    // Construct purchase request
    const purchaseRequest: PurchaseHyperBlogRequest = {
      payment_header: body.payment_header,
      dataroom_id: body.dataroom_id,
      user_query: body.user_query,
      is_public: body.is_public ?? true,
      blog_length: body.blog_length,
      expected_amount: body.expected_amount,
    };

    // Forward to delve backend
    const delveUrl = `${config.delve.apiUrl}/hyperblogs/purchase`;

    // Debug: Decode and log payment header structure
    if (process.env.NODE_ENV !== "development") {
      try {
        const decodedHeader = JSON.parse(atob(body.payment_header));
        console.log(`Payment header structure:`, {
          x402Version: decodedHeader.x402Version,
          scheme: decodedHeader.scheme,
          network: decodedHeader.network,
          configNetwork: config.payment.network,
          configChainId: config.payment.chainId,
          hasAuthorization: !!decodedHeader.payload?.authorization,
          hasSignature: !!decodedHeader.payload?.signature,
          authorization: decodedHeader.payload?.authorization
            ? {
                from: decodedHeader.payload.authorization.from,
                to: decodedHeader.payload.authorization.to,
                value: decodedHeader.payload.authorization.value,
              }
            : null,
        });
      } catch (e) {
        console.warn("Could not decode payment header for debugging:", e);
      }
    }

    console.log(`Forwarding HyperBlog purchase request to: ${delveUrl}`);

    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(purchaseRequest),
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
    const responseData: PurchaseHyperBlogResponse = await delveResponse.json();

    console.log("HyperBlog purchase successful:", {
      hyperblog_id: responseData.hyperblog.id,
      payment_verified: responseData.payment?.verified,
      payment_settled: responseData.payment?.settled,
      generation_status: responseData.hyperblog.generation_status,
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error in HyperBlog purchase API route:", error);

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
 * OPTIONS /api/hyperblogs/purchase
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-payment",
    },
  });
}
