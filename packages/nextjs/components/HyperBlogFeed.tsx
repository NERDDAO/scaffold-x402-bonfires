"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HyperBlogInfo, HyperBlogListResponse } from "@/lib/types/delve-api";
import { notification } from "@/utils/scaffold-eth/notification";

interface HyperBlogFeedProps {
  dataroomId: string; // Required: DataRoom to fetch blogs from
  autoRefreshInterval?: number; // Optional: Auto-refresh interval in ms (default 30000)
  initialLimit?: number; // Optional: Initial number of blogs to load (default 10)
  className?: string; // Optional: Additional CSS classes
}

/**
 * HyperBlogFeed Component
 *
 * Displays a paginated, auto-refreshing list of hyperblogs for a dataroom.
 * Features:
 * - Chat-style card layout using DaisyUI components
 * - Pagination with "Load More" button
 * - Auto-refresh every 30 seconds (configurable)
 * - Modal view for full blog content
 * - Status badges (generating/completed/failed)
 * - Error handling with retry functionality
 *
 * Future Enhancements:
 * - Full blog content display (requires backend endpoint or include_content param)
 * - Markdown rendering for blog sections
 * - Share/export functionality
 * - Filter by status (generating/completed/failed)
 * - Sort options (newest/oldest/most words)
 * - Search within blogs
 * - Author profile links (when wallet→agent mapping available)
 */
export const HyperBlogFeed = ({
  dataroomId,
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
  const [fullBlogContent, setFullBlogContent] = useState<HyperBlogInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLoadingFullContent, setIsLoadingFullContent] = useState<boolean>(false);

  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blogsRef = useRef<HyperBlogInfo[]>([]);

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

        // Fetch from API
        const response = await fetch(`/api/datarooms/${dataroomId}/hyperblogs?limit=${limit}&offset=${offset}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: HyperBlogListResponse = await response.json();

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
          errorMessage = "DataRoom not found";
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
    [dataroomId],
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
   * Handler: Open blog in modal and fetch full content
   */
  const handleOpenBlog = useCallback(async (blog: HyperBlogInfo) => {
    setSelectedBlog(blog);
    setIsModalOpen(true);
    setIsLoadingFullContent(true);
    setFullBlogContent(null);

    try {
      // Fetch full blog content from individual endpoint
      const response = await fetch(`/api/hyperblogs/${blog.id}`);

      if (!response.ok) {
        throw new Error(`Failed to load full content: ${response.statusText}`);
      }

      const fullBlog: HyperBlogInfo = await response.json();
      setFullBlogContent(fullBlog);
    } catch (err: any) {
      console.error("Error loading full blog content:", err);
      notification.error("Failed to load full blog content");
      // Still show the modal with preview data
      setFullBlogContent(blog);
    } finally {
      setIsLoadingFullContent(false);
    }
  }, []);

  /**
   * Handler: Close modal
   */
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    // Clear state after animation
    setTimeout(() => {
      setSelectedBlog(null);
      setFullBlogContent(null);
    }, 300);
  }, []);

  /**
   * Computed values
   */
  const hasMore = useMemo(() => blogs.length < totalCount, [blogs.length, totalCount]);
  const isEmpty = useMemo(() => !isLoading && blogs.length === 0 && !error, [isLoading, blogs.length, error]);

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
   * Utility: Get status badge
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "generating":
        return (
          <span className="badge badge-warning gap-1">
            <span className="loading loading-spinner loading-xs"></span>
            Generating
          </span>
        );
      case "completed":
        return <span className="badge badge-success gap-1">✓ Completed</span>;
      case "failed":
        return <span className="badge badge-error gap-1">✗ Failed</span>;
      default:
        return <span className="badge badge-ghost gap-1">{status}</span>;
    }
  };

  /**
   * Utility: Truncate preview text to max length
   */
  const truncatePreview = (preview: string | null, maxLength: number = 200): string => {
    if (!preview) return "No preview available";
    if (preview.length <= maxLength) return preview;
    return preview.slice(0, maxLength) + "...";
  };

  return (
    <div className={`space-y-4 ${className}`} aria-label="HyperBlog Feed">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          Recent Blogs
          {totalCount > 0 && <span className="badge badge-neutral">{totalCount}</span>}
        </h3>
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
          <span>{error}</span>
          <button className="btn btn-sm btn-ghost" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="text-center py-12 opacity-70">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-lg">No blogs yet. Be the first to create one!</p>
        </div>
      )}

      {/* Blog List */}
      {blogs.length > 0 && (
        <div className="space-y-4">
          {blogs.map(blog => (
            <div
              key={blog.id}
              className="chat chat-start cursor-pointer hover:bg-base-200 transition-colors rounded-lg"
              onClick={() => handleOpenBlog(blog)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === "Enter") handleOpenBlog(blog);
              }}
            >
              <div className="chat-bubble chat-bubble-secondary max-w-full sm:max-w-2xl relative">
                {/* Status Badge */}
                <div className="absolute top-2 right-2">{getStatusBadge(blog.generation_status)}</div>

                {/* Title */}
                <h4 className="font-semibold text-base mb-2 pr-24">{blog.user_query}</h4>

                {/* Preview Text */}
                <p className="text-sm opacity-80 mb-2 line-clamp-3">{truncatePreview(blog.preview)}</p>

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-2 text-xs opacity-70 mt-2">
                  <span>by {truncateAddress(blog.author_wallet, 6)}</span>
                  <span>•</span>
                  <span>{formatTimestamp(blog.created_at)}</span>
                  {blog.generation_status === "completed" && blog.word_count && (
                    <>
                      <span>•</span>
                      <span>{blog.word_count} words</span>
                    </>
                  )}
                </div>

                {/* Action Link */}
                {blog.generation_status === "completed" && (
                  <div className="mt-2">
                    <span className="text-xs text-primary hover:underline">Read Full →</span>
                  </div>
                )}
              </div>
            </div>
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

      {/* Modal Component (Full Blog View) */}
      <div
        className={`modal ${isModalOpen ? "modal-open" : ""}`}
        onClick={handleCloseModal}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-box max-w-full sm:max-w-4xl" onClick={e => e.stopPropagation()}>
          {/* Close Button */}
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
            onClick={handleCloseModal}
            aria-label="Close modal"
          >
            ✕
          </button>

          {selectedBlog && (
            <>
              {/* Modal Header */}
              <div className="mb-4">
                <h3 className="font-bold text-2xl mb-2">{selectedBlog.user_query}</h3>
                <div className="flex items-center gap-2">{getStatusBadge(selectedBlog.generation_status)}</div>
              </div>

              {/* Loading Full Content */}
              {isLoadingFullContent && (
                <div className="flex items-center justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              )}

              {/* Modal Content */}
              {!isLoadingFullContent && (
                <div className="prose max-w-none">
                  {fullBlogContent?.blog_content && fullBlogContent.blog_content.sections ? (
                    // Render full blog sections
                    <div className="space-y-6">
                      {fullBlogContent.blog_content.sections
                        .sort((a, b) => a.order - b.order)
                        .map(section => (
                          <div key={section.htn_node_id} className="mb-6">
                            <h3 className="text-xl font-semibold mb-3">{section.title}</h3>
                            <div className="text-base leading-relaxed whitespace-pre-wrap">{section.content}</div>
                            {section.word_count && (
                              <div className="text-xs opacity-50 mt-2">{section.word_count} words</div>
                            )}
                          </div>
                        ))}

                      {fullBlogContent.blog_content.metadata && (
                        <div className="mt-8 pt-4 border-t border-base-300 text-sm opacity-70">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <strong>Total Words:</strong> {fullBlogContent.blog_content.metadata.total_words}
                            </div>
                            <div>
                              <strong>Generation Time:</strong>{" "}
                              {fullBlogContent.blog_content.metadata.generation_time_seconds}s
                            </div>
                            <div>
                              <strong>Model:</strong> {fullBlogContent.blog_content.metadata.model}
                            </div>
                            <div>
                              <strong>Sections:</strong> {fullBlogContent.blog_content.metadata.sections_generated}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Fallback to preview if no full content
                    <>
                      <p className="text-base leading-relaxed whitespace-pre-wrap">
                        {fullBlogContent?.preview || selectedBlog.preview}
                      </p>
                      {selectedBlog.generation_status === "completed" && (
                        <div className="alert alert-warning mt-4">
                          <span className="text-sm">Failed to load full content. Showing preview only.</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {/* Modal Metadata */}
              <div className="mt-6 pt-4 border-t border-base-300">
                <div className="flex flex-wrap items-center gap-3 text-sm opacity-70">
                  <span>
                    <strong>Author:</strong> {truncateAddress(selectedBlog.author_wallet, 8)}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Created:</strong> {formatTimestamp(selectedBlog.created_at)}
                  </span>
                  {selectedBlog.word_count && (
                    <>
                      <span>•</span>
                      <span>
                        <strong>Words:</strong> {selectedBlog.word_count}
                      </span>
                    </>
                  )}
                </div>
                {selectedBlog.tx_hash && (
                  <div className="mt-2 text-sm opacity-70">
                    <strong>Transaction:</strong>{" "}
                    <a
                      href={`https://etherscan.io/tx/${selectedBlog.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary"
                    >
                      {truncateAddress(selectedBlog.tx_hash, 10)}
                    </a>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="modal-action">
                <button className="btn" onClick={handleCloseModal}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
