"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HyperBlogDetail } from "@/components/HyperBlogDetail";
import type { HyperBlogInfo } from "@/lib/types/delve-api";
import { AlertCircle } from "lucide-react";

export default function HyperBlogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const hyperblogId = params.hyperblogId as string;

  // State
  const [blog, setBlog] = useState<HyperBlogInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch blog details
  const fetchBlog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/hyperblogs/${hyperblogId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      const data: HyperBlogInfo = await response.json();
      setBlog(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch blog";
      setError(errorMessage);
      console.error("Error fetching blog:", err);
    } finally {
      setIsLoading(false);
    }
  }, [hyperblogId]);

  useEffect(() => {
    if (hyperblogId) {
      fetchBlog();
    }
  }, [hyperblogId, fetchBlog]);

  // Handlers
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex justify-between items-start">
            <div className="space-y-2 w-2/3">
              <div className="skeleton h-8 w-3/4"></div>
              <div className="flex gap-2">
                <div className="skeleton h-5 w-20"></div>
                <div className="skeleton h-5 w-20"></div>
              </div>
            </div>
            <div className="skeleton h-8 w-8 rounded-full"></div>
          </div>

          {/* Content Skeleton */}
          <div className="space-y-4 mt-8">
            <div className="skeleton h-6 w-1/2"></div>
            <div className="skeleton h-32 w-full"></div>
            <div className="skeleton h-32 w-full"></div>
            <div className="skeleton h-6 w-1/3 mt-8"></div>
            <div className="skeleton h-32 w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !blog) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-xl text-center">
        <div className="alert alert-error shadow-lg mb-6 flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12" />
          <div>
            <h3 className="font-bold text-lg">Error loading blog</h3>
            <div className="text-sm opacity-80">{error || "Blog not found"}</div>
          </div>
          <div className="flex gap-2 w-full justify-center">
            <button onClick={fetchBlog} className="btn btn-sm btn-outline btn-error">
              Retry
            </button>
            <button onClick={handleBack} className="btn btn-sm btn-ghost">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Content
  // We pass the hash from window.location if available, but HyperBlogDetail reads from props.
  // Actually, Next.js doesn't expose hash in router props easily during SSR/hydration mismatch,
  // but inside useEffect we can read window.location.hash.
  // However, HyperBlogDetail can also handle this if we pass it, or just rely on its internal logic?
  // HyperBlogDetail implementation:
  // useEffect(() => { if (initialSectionId ... ) handleScrollToSection(initialSectionId) }, ...)
  // So we should pass it if we can.

  const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : undefined;

  return <HyperBlogDetail blog={blog} onBack={handleBack} showBackButton={true} initialSectionId={hash || null} />;
}
