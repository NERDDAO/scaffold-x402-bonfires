import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createErrorFromResponse } from "@/lib/types/errors";

interface BannerResponse {
  banner_url: string;
  cached: boolean;
  hyperblog_id: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ hyperblogId: string }> }) {
  try {
    const { hyperblogId } = await params;

    if (!hyperblogId) {
      return NextResponse.json({ error: "Invalid hyperblogId" }, { status: 400 });
    }

    const delveUrl = `${config.delve.apiUrl}/datarooms/hyperblogs/${hyperblogId}/banner`;

    // Longer timeout for image generation (30 seconds)
    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
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

    const bannerData: BannerResponse = await delveResponse.json();

    console.log("Banner generated:", {
      hyperblog_id: hyperblogId,
      cached: bannerData.cached,
    });

    return NextResponse.json(bannerData, { status: 200 });
  } catch (error) {
    console.error("Error in HyperBlog banner API route:", error);

    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timeout. Banner generation took too long." }, { status: 503 });
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
