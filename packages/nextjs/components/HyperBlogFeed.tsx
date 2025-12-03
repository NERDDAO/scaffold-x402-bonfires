"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { HyperBlogDetail } from "./HyperBlogDetail";
import { AggregatedHyperBlogListResponse, HyperBlogInfo, HyperBlogListResponse } from "@/lib/types/delve-api";
import { calculateReadingTime } from "@/lib/utils";
import { notification } from "@/utils/scaffold-eth/notification";
import { AlertCircle, Clock, Eye, Maximize2, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";

interface HyperBlogFeedProps {
  dataroomId?: string; // Optional: DataRoom to fetch blogs from (omit for aggregated mode)
  showFilters?: boolean; // Optional: Show/hide filter controls (default: false)
  title?: string; // Optional: Section title (default: "HyperBlogs")
  autoRefreshInterval?: number; // Optional: Auto-refresh interval in ms (default 30000)
  initialLimit?: number; // Optional: Initial number of blogs to load (default 10)
  className?: string; // Optional: Additional CSS classes
}

/**
 * HyperBlogFeed Component
 *
 * Displays a paginated, auto-refreshing list of hyperblogs.
 * Supports two modes:
 * 1. DataRoom-specific mode (when dataroomId is provided): Shows blogs from single dataroom
 * 2. Aggregated mode (when dataroomId is omitted): Shows blogs from all datarooms with filters
 */
export const HyperBlogFeed = ({
  dataroomId,
  showFilters = false,
  title = "HyperBlogs",
  autoRefreshInterval = 30000,
  initialLimit = 10,
  className = "",
}: HyperBlogFeedProps) => {
  // Data State
  const [blogs, setBlogs] = useState<HyperBlogInfo[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentOffset, setCurrentOffset] = useState<number>(0);
  const [currentLimit, setCurrentLimit] = useState<number>(initialLimit);

  // Loading/Error State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [selectedBlog, setSelectedBlog] = useState<HyperBlogInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Filter State (for aggregated mode)
  const [selectedDataroomFilter, setSelectedDataroomFilter] = useState<string | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);

  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blogsRef = useRef<HyperBlogInfo[]>([]);
  const isInitialMountRef = useRef<boolean>(true);

  // Keep blogsRef in sync with blogs state
  useEffect(() => {
    blogsRef.current = blogs;
  }, [blogs]);

  /**
   * Main fetch function to load blogs from API
   */
  const fetchBlogs = useCallback(
    async (offset: number, limit: number, append: boolean) => {
      try {
        // Cancel any pending request
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        // Set loading state
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        // Build API URL based on mode
        let apiUrl: string;
        if (dataroomId) {
          // DataRoom-specific mode
          apiUrl = `/api/datarooms/${dataroomId}/hyperblogs?limit=${limit}&offset=${offset}`;
        } else {
          // Aggregated mode
          apiUrl = `/api/hyperblogs?limit=${limit}&offset=${offset}`;
          // Add filters for aggregated mode
          if (selectedDataroomFilter) {
            apiUrl += `&dataroom_id=${selectedDataroomFilter}`;
          }
          if (selectedStatusFilter) {
            apiUrl += `&status=${selectedStatusFilter}`;
          }
        }

        // Fetch from API
        const response = await fetch(apiUrl, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: HyperBlogListResponse | AggregatedHyperBlogListResponse = await response.json();

        // Handle success
        if (append) {
          // Deduplicate and append new blogs using ref
          const existingIds = new Set(blogsRef.current.map(b => b.id));
          const newBlogs = data.hyperblogs.filter(b => !existingIds.has(b.id));
          setBlogs(prev => [...prev, ...newBlogs]);
        } else {
          // Replace blogs array
          setBlogs(data.hyperblogs);
        }

        setTotalCount(data.count);
        setCurrentOffset(offset);
        setCurrentLimit(limit);
      } catch (err: any) {
        // Handle abort gracefully
        if (err.name === "AbortError") {
          return;
        }

        // Parse error message
        let errorMessage = "Unable to load blogs. Please check your connection.";
        if (err.message.includes("404")) {
          errorMessage = dataroomId ? "DataRoom not found" : "Endpoint not found";
        } else if (err.message.includes("500")) {
          errorMessage = "Server error. Please try again later.";
        } else if (err.message.includes("timeout")) {
          errorMessage = "Request timed out. Please try again.";
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        notification.error(errorMessage);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        abortControllerRef.current = null;
      }
    },
    [dataroomId, selectedDataroomFilter, selectedStatusFilter],
  );

  /**
   * Initial load effect
   */
  useEffect(() => {
    fetchBlogs(0, initialLimit, false);

    // Cleanup: abort pending requests
    return () => {
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Filter change effect - triggers immediate refetch when filters change
   */
  useEffect(() => {
    // Skip on initial mount - the initial load effect handles that
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // Clear any existing error state
    setError(null);

    // Abort any in-flight request
    abortControllerRef.current?.abort();

    // Trigger immediate refetch with reset pagination
    fetchBlogs(0, initialLimit, false);
  }, [selectedDataroomFilter, selectedStatusFilter, dataroomId, fetchBlogs, initialLimit]);

  /**
   * Auto-refresh effect
   */
  useEffect(() => {
    // Only start if autoRefreshInterval > 0
    if (autoRefreshInterval <= 0) {
      return;
    }

    // Setup interval
    refreshIntervalRef.current = setInterval(() => {
      // Fetch first page to get latest blogs
      fetchBlogs(0, currentLimit, false);
    }, autoRefreshInterval);

    // Cleanup: clear interval
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [dataroomId, autoRefreshInterval, currentLimit, fetchBlogs]);

  /**
   * Handler: Load next page
   */
  const handleLoadMore = useCallback(() => {
    // Debounce to prevent double-fetches
    if (debounceTimeoutRef.current) {
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
    }, 300);

    const nextOffset = currentOffset + currentLimit;
    fetchBlogs(nextOffset, currentLimit, true);
  }, [currentOffset, currentLimit, fetchBlogs]);

  /**
   * Handler: Retry after error
   */
  const handleRetry = useCallback(() => {
    setError(null);
    fetchBlogs(0, initialLimit, false);
  }, [initialLimit, fetchBlogs]);

  /**
   * Handler: Close modal
   */
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedBlog(null);
    }, 300);
  }, []);

  /**
   * Handler: Open blog in modal
   * Note: Primary interaction is now via Link, this is fallback
   */
  const handleOpenBlog = useCallback((blog: HyperBlogInfo, e?: React.MouseEvent) => {
    // Prevent navigation and propagation when opening modal
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setSelectedBlog(blog);
    setIsModalOpen(true);
  }, []);

  /**
   * Computed values
   */
  const hasMore = useMemo(() => blogs.length < totalCount, [blogs.length, totalCount]);
  const isEmpty = useMemo(() => !isLoading && blogs.length === 0 && !error, [isLoading, blogs.length, error]);

  /**
   * Get unique dataroom IDs from loaded blogs (for filter dropdown)
   */
  const uniqueDataroomIds = useMemo(() => {
    const ids = new Set(blogs.map(b => b.dataroom_id));
    return Array.from(ids);
  }, [blogs]);

  /**
   * Build a mapping from dataroom_id to description for filter dropdown display
   */
  const dataroomDescriptions = useMemo(() => {
    const descriptions = new Map<string, string>();
    for (const blog of blogs) {
      if (!descriptions.has(blog.dataroom_id)) {
        // Use description if available, otherwise fallback to truncated ID
        descriptions.set(blog.dataroom_id, blog.dataroom_description || blog.dataroom_id.substring(0, 8) + "...");
      }
    }
    return descriptions;
  }, [blogs]);

  /**
   * Handler: Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setSelectedDataroomFilter(null);
    setSelectedStatusFilter(null);
  }, []);

  /**
   * Utility: Format timestamp
   */
  const formatTimestamp = (timestamp: string | number): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown date";
    }
  };

  /**
   * Utility: Truncate address
   */
  const truncateAddress = (address: string, chars: number = 6): string => {
    if (!address) return "Unknown";
    if (address.length <= chars * 2) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  };

  /**
   * Utility: Truncate dataroom description for filter dropdown
   */
  const truncateDescription = (description: string | null | undefined, maxLength: number = 50): string => {
    if (!description || description.trim() === "") return "Unknown DataRoom";
    if (description.length <= maxLength) return description;
    return description.slice(0, maxLength) + "...";
  };

  /**
   * Utility: Get status badge
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "generating":
        return (
          <span className="badge badge-warning gap-1" aria-label="Status: Generating">
            <span className="loading loading-spinner loading-xs" aria-hidden="true"></span>
            Generating
          </span>
        );
      case "completed":
        return (
          <span className="badge badge-success gap-1" aria-label="Status: Completed">
            ✓ Completed
          </span>
        );
      case "failed":
        return (
          <span className="badge badge-error gap-1" aria-label="Status: Failed">
            ✗ Failed
          </span>
        );
      default:
        return (
          <span className="badge badge-ghost gap-1" aria-label={`Status: ${status}`}>
            {status}
          </span>
        );
    }
  };

  /**
   * Utility: Smart truncate preview text at sentence boundaries
   */
  const truncatePreviewSmart = (preview: string | null, maxLength: number = 280): string => {
    if (!preview) return "No preview available";
    if (preview.length <= maxLength) return preview;

    // Look for sentence boundary within the last 20% of the allowed length
    const truncationZoneStart = Math.floor(maxLength * 0.8);
    const truncationZone = preview.slice(truncationZoneStart, maxLength);

    // Find the last sentence terminator in the zone
    const regex = /[.!?](?=\s|$)/g;
    let lastSentenceEnd = -1;
    let match;
    while ((match = regex.exec(truncationZone)) !== null) {
      lastSentenceEnd = match.index;
    }

    if (lastSentenceEnd !== -1) {
      // Found a sentence boundary
      const truncated = preview.slice(0, truncationZoneStart + lastSentenceEnd + 1);
      if (truncated.length < preview.length) {
        return truncated + " ...";
      }
      return truncated;
    }

    // Fallback to word boundary
    const lastSpace = preview.lastIndexOf(" ", maxLength);
    if (lastSpace > truncationZoneStart) {
      return preview.slice(0, lastSpace) + "...";
    }

    // Hard fallback
    return preview.slice(0, maxLength) + "...";
  };

  return (
    <div className={`space-y-4 ${className}`} aria-label="HyperBlog Feed">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            {title || "Recent Blogs"}
            {totalCount > 0 && <span className="badge badge-neutral">{totalCount}</span>}
          </h3>
          {!dataroomId && <p className="text-sm opacity-70 mt-1">Latest from all DataRooms</p>}
          {dataroomId && <p className="text-sm opacity-70 mt-1">From this DataRoom</p>}
        </div>
        {!isLoading && blogs.length > 0 && (
          <div className="text-xs opacity-70 flex items-center gap-1">
            {autoRefreshInterval > 0 && (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                Auto-refreshing
              </>
            )}
          </div>
        )}
      </div>

      {/* Filters Section (only show if showFilters is true and not in dataroom-specific mode) */}
      {showFilters && !dataroomId && (
        <div className="bg-base-200 p-4 rounded-lg mb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="text-sm font-semibold opacity-70 flex-shrink-0">Filter by:</div>

            {/* DataRoom Filter */}
            <div className="flex-1">
              <select
                className="select select-sm select-bordered w-full"
                value={selectedDataroomFilter || ""}
                onChange={e => setSelectedDataroomFilter(e.target.value || null)}
                aria-label="Filter by DataRoom"
              >
                <option value="">All DataRooms</option>
                {uniqueDataroomIds.map(id => (
                  <option key={id} value={id}>
                    {truncateDescription(dataroomDescriptions.get(id), 50)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex-1">
              <select
                className="select select-sm select-bordered w-full"
                value={selectedStatusFilter || ""}
                onChange={e => setSelectedStatusFilter(e.target.value || null)}
                aria-label="Filter by Status"
              >
                <option value="">All Statuses</option>
                <option value="generating">Generating</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(selectedDataroomFilter || selectedStatusFilter) && (
              <button
                className="btn btn-sm btn-ghost flex-shrink-0"
                onClick={handleClearFilters}
                aria-label="Clear all filters"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading State (Initial) */}
      {isLoading && blogs.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-32 w-full"></div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && blogs.length === 0 && (
        <div className="alert alert-error">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button className="btn btn-sm btn-primary" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="text-center py-12 opacity-70">
          <div className="text-6xl mb-4">📝</div>
          {dataroomId ? (
            <p className="text-lg">No blogs yet for this DataRoom. Create the first one!</p>
          ) : (
            <p className="text-lg">No public blogs available yet. Visit a DataRoom to create one!</p>
          )}
        </div>
      )}

      {/* Blog List */}
      {blogs.length > 0 && (
        <div className="space-y-4">
          {blogs.map(blog => (
            <Link
              key={blog.id}
              href={`/hyperblogs/${blog.id}`}
              passHref
              className="block no-underline group animate-slide-up"
            >
              <div
                className="card-minimal group-hover:translate-y-[-2px]"
                role="button"
                tabIndex={0}
                aria-label={`Blog post: ${blog.user_query}`}
              >
                <div className="relative w-full">
                  {/* Status Badge */}
                  <div className="absolute top-0 right-0">{getStatusBadge(blog.generation_status)}</div>

                  {/* Title */}
                  <h4 className="text-xl sm:text-2xl font-bold font-serif mb-3 pr-24 line-clamp-2 text-base-content group-hover:text-primary transition-colors">
                    {blog.user_query}
                  </h4>

                  {/* Preview Text - prefer summary over truncated preview */}
                  <div className="relative mb-6">
                    <p className="text-base text-base-content/80 leading-relaxed line-clamp-4">
                      {blog.summary || truncatePreviewSmart(blog.preview, 280)}
                    </p>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-base-content/60">
                    {/* DataRoom badge (only in aggregated mode) */}
                    {!dataroomId && (
                      <>
                        <span className="badge badge-outline badge-sm">
                          DataRoom: {blog.dataroom_id.substring(0, 8)}...
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span className="font-medium text-base-content/80">
                      by {truncateAddress(blog.author_wallet, 6)}
                    </span>
                    <span>•</span>
                    <span>{formatTimestamp(blog.created_at)}</span>
                    {blog.blog_length && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{blog.blog_length}</span>
                      </>
                    )}
                    {blog.generation_status === "completed" && blog.word_count && (
                      <>
                        <span>•</span>
                        <span>{blog.word_count} words</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {calculateReadingTime(blog.word_count)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Taxonomy Keywords Badges */}
                  {blog.taxonomy_keywords && blog.taxonomy_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3" aria-label="Taxonomy keywords">
                      <span className="text-xs opacity-60 mr-1">🏷️</span>
                      {blog.taxonomy_keywords.slice(0, 5).map((keyword, idx) => (
                        <span key={idx} className="badge badge-primary badge-sm">
                          {keyword}
                        </span>
                      ))}
                      {blog.taxonomy_keywords.length > 5 && (
                        <span className="badge badge-ghost badge-sm">+{blog.taxonomy_keywords.length - 5} more</span>
                      )}
                    </div>
                  )}

                  {/* Interaction Row Preview (Non-interactive in card, just visual) */}
                  {blog.generation_status === "completed" && (
                    <div className="flex items-center gap-6 mt-6 pt-4 border-t border-base-content/5 text-base-content/60">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm hover:text-primary transition-colors">
                        <ThumbsUp className="w-4 h-4" />
                        <span>{blog.upvotes || 0}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs sm:text-sm hover:text-primary transition-colors">
                        <ThumbsDown className="w-4 h-4" />
                        <span>{blog.downvotes || 0}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs sm:text-sm hover:text-primary transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        <span>{blog.comment_count || 0}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs sm:text-sm px-2 ml-auto">
                        <Eye className="w-4 h-4 opacity-70" />
                        <span>{blog.view_count || 0}</span>
                      </div>

                      <button
                        className="btn btn-ghost btn-xs gap-1 z-10 relative hover:bg-base-200 ml-2"
                        onClick={e => handleOpenBlog(blog, e)}
                        aria-label="Quick View"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Quick View</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Load More Section */}
      {hasMore && !isLoading && (
        <div className="space-y-2">
          <button className="btn btn-outline btn-block" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </button>
          <div className="text-center text-sm opacity-70">
            Showing {blogs.length} of {totalCount}
          </div>
        </div>
      )}

      {/* All Loaded Message */}
      {!hasMore && blogs.length > 0 && (
        <div className="text-center text-sm opacity-70 py-4">All blogs loaded ({totalCount} total)</div>
      )}

      {/* Modal Component (Full Blog View) - Reusing HyperBlogDetail */}
      {isModalOpen && selectedBlog && (
        <div className="modal modal-open backdrop-blur-sm" onClick={handleCloseModal} role="dialog" aria-modal="true">
          <div
            className="modal-box max-w-full sm:max-w-5xl lg:max-w-6xl max-h-[90vh] p-8 sm:p-10 overflow-hidden flex flex-col bg-base-100 rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <HyperBlogDetail blog={selectedBlog} onBack={handleCloseModal} showBackButton={true} />
          </div>
        </div>
      )}
    </div>
  );
};
