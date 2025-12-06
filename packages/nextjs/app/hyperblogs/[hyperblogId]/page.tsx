import { headers } from "next/headers";
import HyperBlogDetailClient from "./HyperBlogDetailClient";
import type { HyperBlogInfo } from "@/lib/types/delve-api";
import type { Metadata } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

const FALLBACK_TITLE = "HyperBlogs - AI-Generated Knowledge Blogs";
const FALLBACK_DESCRIPTION = "Create AI-generated blog posts from knowledge graphs with blockchain-verified payments";
const FALLBACK_IMAGE = "/thumbnail.jpg";

export async function generateMetadata({ params }: { params: Promise<{ hyperblogId: string }> }): Promise<Metadata> {
  const { hyperblogId } = await params;

  try {
    // Construct absolute URL for server-side fetch using request headers
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/hyperblogs/${hyperblogId}`, {
      method: "GET",
    });

    if (!response.ok) {
      return getMetadata({
        title: FALLBACK_TITLE,
        description: FALLBACK_DESCRIPTION,
        imageRelativePath: FALLBACK_IMAGE,
      });
    }

    const card: HyperBlogInfo = await response.json();

    const title = card.user_query || FALLBACK_TITLE;
    const description = card.summary || card.preview || FALLBACK_DESCRIPTION;
    const bannerUrl = card.banner_url;

    // Handle banner_url with three cases:
    // 1. Absolute URL (http:// or https://) - use directly
    // 2. Relative path - pass to getMetadata
    // 3. Null/undefined - use fallback
    if (bannerUrl && (bannerUrl.startsWith("http://") || bannerUrl.startsWith("https://"))) {
      // For absolute URLs, we need to construct metadata manually to bypass getMetadata's URL construction
      const baseMetadata = getMetadata({
        title,
        description,
        imageRelativePath: FALLBACK_IMAGE, // This will be overridden
      });

      return {
        ...baseMetadata,
        openGraph: {
          ...baseMetadata.openGraph,
          images: [{ url: bannerUrl }],
        },
        twitter: {
          ...baseMetadata.twitter,
          images: [bannerUrl],
        },
      };
    }

    // Relative path or fallback
    const imageRelativePath = bannerUrl || FALLBACK_IMAGE;

    return getMetadata({
      title,
      description,
      imageRelativePath,
    });
  } catch {
    return getMetadata({
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      imageRelativePath: FALLBACK_IMAGE,
    });
  }
}

export default function HyperBlogDetailPage() {
  return <HyperBlogDetailClient />;
}
