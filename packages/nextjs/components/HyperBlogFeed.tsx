"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { HyperBlogInfo, HyperBlogListResponse } from "@/lib/types/delve-api";
import { calculateReadingTime } from "@/lib/utils";
import { notification } from "@/utils/scaffold-eth/notification";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Link,
  Menu,
  User,
  X,
} from "lucide-react";

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
  const [modalError, setModalError] = useState<string | null>(null);

  // TOC State
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Keyboard Navigation State
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);

  // Copy Link State
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);

  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blogsRef = useRef<HyperBlogInfo[]>([]);
  const tocRef = useRef<HTMLDivElement | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const clickedCardRef = useRef<HTMLElement | null>(null);

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
   * Scroll tracking effect for TOC active state
   */
  useEffect(() => {
    if (!isModalOpen || !fullBlogContent?.blog_content?.sections) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5, rootMargin: "-100px 0px -50% 0px" },
    );

    // Observe all section elements
    const sections = fullBlogContent.blog_content.sections.map(section => {
      const element = document.getElementById(section.htn_node_id);
      if (element) {
        observer.observe(element);
      }
      return element;
    });

    return () => {
      sections.forEach(element => {
        if (element) observer.unobserve(element);
      });
    };
  }, [isModalOpen, fullBlogContent]);

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
    setIsTocOpen(false);
    setActiveSection(null);
    setModalError(null);
    setCurrentSectionIndex(0);
    setCopiedSectionId(null);

    // Restore focus to clicked card
    if (clickedCardRef.current) {
      clickedCardRef.current.focus();
      clickedCardRef.current = null;
    }

    // Clear state after animation
    setTimeout(() => {
      setSelectedBlog(null);
      setFullBlogContent(null);
    }, 300);
  }, []);

  /**
   * Smooth scroll utility function
   */
  const handleScrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setIsTocOpen(false); // Close TOC on mobile after navigation
    }
  }, []);

  /**
   * Handler: Copy section link to clipboard
   */
  const handleCopyLink = useCallback((sectionId: string, sectionTitle: string, blogId: string) => {
    const url = `${window.location.origin}/hyperblogs/${blogId}#${sectionId}`;

    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedSectionId(sectionId);
        notification.success(`Link to "${sectionTitle}" copied to clipboard`);

        // Reset copied state after 2 seconds
        setTimeout(() => {
          setCopiedSectionId(null);
        }, 2000);
      })
      .catch(err => {
        console.error("Failed to copy link:", err);
        notification.error("Failed to copy link");
      });
  }, []);

  /**
   * Handler: Keyboard navigation for modal
   */
  const handleKeyboardNavigation = useCallback(
    (event: KeyboardEvent) => {
      if (!isModalOpen) return;

      // Handle Escape key
      if (event.key === "Escape") {
        handleCloseModal();
        return;
      }

      // Handle arrow keys for section navigation
      if (!fullBlogContent?.blog_content?.sections) return;

      const sections = fullBlogContent.blog_content.sections.sort((a, b) => a.order - b.order);
      const maxIndex = sections.length - 1;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        const nextIndex = Math.min(currentSectionIndex + 1, maxIndex);
        setCurrentSectionIndex(nextIndex);
        handleScrollToSection(sections[nextIndex].htn_node_id);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        const prevIndex = Math.max(currentSectionIndex - 1, 0);
        setCurrentSectionIndex(prevIndex);
        handleScrollToSection(sections[prevIndex].htn_node_id);
      }
    },
    [isModalOpen, fullBlogContent, currentSectionIndex, handleCloseModal, handleScrollToSection],
  );

  /**
   * Keyboard navigation effect
   */
  useEffect(() => {
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyboardNavigation);
      return () => {
        window.removeEventListener("keydown", handleKeyboardNavigation);
      };
    }
  }, [isModalOpen, handleKeyboardNavigation]);

  /**
   * Handler: Open blog in modal and fetch full content
   */
  const handleOpenBlog = useCallback(async (blog: HyperBlogInfo, cardElement?: HTMLElement) => {
    // Store reference to clicked card for focus restoration
    if (cardElement) {
      clickedCardRef.current = cardElement;
    }

    setSelectedBlog(blog);
    setIsModalOpen(true);
    setIsLoadingFullContent(true);
    setFullBlogContent(null);
    setModalError(null);
    setCurrentSectionIndex(0);

    // Focus modal after opening
    setTimeout(() => {
      modalContentRef.current?.focus();
    }, 100);

    try {
      // Fetch full blog content from individual endpoint
      const response = await fetch(`/api/hyperblogs/${blog.id}`);

      if (!response.ok) {
        throw new Error(`Failed to load full content: ${response.statusText}`);
      }

      const fullBlog: HyperBlogInfo = await response.json();
      setFullBlogContent(fullBlog);
      setModalError(null);
    } catch (err: any) {
      console.error("Error loading full blog content:", err);
      const errorMessage = "Failed to load full blog content. Please try again.";
      setModalError(errorMessage);
      // Still show the modal with preview data
      setFullBlogContent(blog);
    } finally {
      setIsLoadingFullContent(false);
    }
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
          <p className="text-lg">No blogs yet. Be the first to create one!</p>
        </div>
      )}

      {/* Blog List */}
      {blogs.length > 0 && (
        <div className="space-y-4">
          {blogs.map(blog => (
            <div
              key={blog.id}
              className="chat chat-start cursor-pointer hover:bg-base-200 hover:scale-[1.01] hover:shadow-lg transition-all duration-200 rounded-lg border border-transparent hover:border-primary/20"
              onClick={e => handleOpenBlog(blog, e.currentTarget)}
              role="button"
              tabIndex={0}
              aria-label={`Blog post: ${blog.user_query}`}
              onKeyDown={e => {
                if (e.key === "Enter") handleOpenBlog(blog, e.currentTarget);
              }}
            >
              <div className="chat-bubble chat-bubble-secondary max-w-full sm:max-w-2xl relative focus:ring-2 focus:ring-primary focus:ring-offset-2">
                {/* Status Badge */}
                <div className="absolute top-2 right-2">{getStatusBadge(blog.generation_status)}</div>

                {/* Title */}
                <h4 className="font-semibold text-base mb-2 pr-24 line-clamp-2">{blog.user_query}</h4>

                {/* Preview Text with Gradient Fade */}
                <div className="relative">
                  <p className="text-sm opacity-80 mb-2 line-clamp-4">{truncatePreview(blog.preview, 300)}</p>
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-secondary pointer-events-none"></div>
                </div>

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-2 text-xs opacity-70 mt-3">
                  <span>by {truncateAddress(blog.author_wallet, 6)}</span>
                  <span>•</span>
                  <span>{formatTimestamp(blog.created_at)}</span>
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

                {/* Action Link with Arrow */}
                {blog.generation_status === "completed" && (
                  <div className="mt-2">
                    <span className="text-xs text-primary hover:underline hover:translate-x-1 transition-transform duration-200 inline-flex items-center gap-1">
                      Read Full <ArrowRight className="w-3 h-3" />
                    </span>
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
        aria-busy={isLoadingFullContent}
      >
        <div
          ref={modalContentRef}
          className="modal-box max-w-full sm:max-w-5xl lg:max-w-6xl max-h-[90vh] flex flex-col p-0"
          onClick={e => e.stopPropagation()}
          tabIndex={-1}
        >
          {selectedBlog && (
            <>
              {/* Sticky Header */}
              <div className="sticky top-0 z-10 bg-base-100 border-b border-base-300 px-4 sm:px-6 py-3 sm:py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Mobile TOC Toggle */}
                  <button
                    className="btn btn-sm btn-ghost lg:hidden mt-1"
                    onClick={() => setIsTocOpen(!isTocOpen)}
                    aria-label="Toggle table of contents"
                  >
                    {isTocOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>

                  {/* Title and Status */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xl sm:text-2xl mb-2 break-words">{selectedBlog.user_query}</h3>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedBlog.generation_status)}
                      {selectedBlog.generation_status === "completed" && selectedBlog.word_count && (
                        <span
                          className="badge badge-ghost gap-1"
                          aria-label={`Reading time: ${calculateReadingTime(selectedBlog.word_count)}`}
                        >
                          <Clock className="w-3 h-3" />
                          {calculateReadingTime(selectedBlog.word_count)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  className="btn btn-sm sm:btn-md btn-circle btn-ghost flex-shrink-0 focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  onClick={handleCloseModal}
                  aria-label="Close modal"
                  aria-keyshortcuts="Escape"
                >
                  ✕
                </button>
              </div>

              {/* Main Content Area with TOC Sidebar */}
              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
                {/* Table of Contents Sidebar */}
                {fullBlogContent?.blog_content?.sections && (
                  <>
                    {/* Desktop TOC */}
                    <div
                      ref={tocRef}
                      className="hidden lg:block lg:w-64 lg:border-r lg:border-base-300 lg:overflow-y-auto"
                    >
                      <div className="p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-3">
                          Table of Contents
                        </h4>
                        <nav className="space-y-1">
                          {fullBlogContent.blog_content.sections
                            .sort((a, b) => a.order - b.order)
                            .map((section, index) => (
                              <button
                                key={section.htn_node_id}
                                onClick={() => handleScrollToSection(section.htn_node_id)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleScrollToSection(section.htn_node_id);
                                  }
                                }}
                                className={`toc-item w-full text-left text-sm py-2 px-4 rounded transition-all min-h-[44px] flex items-center gap-2 focus:ring-2 focus:ring-primary focus:outline-none ${
                                  activeSection === section.htn_node_id
                                    ? "toc-item active bg-base-200 border-l-4 border-primary font-semibold"
                                    : "border-l-4 border-transparent hover:bg-base-200"
                                }`}
                                tabIndex={0}
                              >
                                <span className="text-xs opacity-60 flex-shrink-0">{index + 1}.</span>
                                <span className="flex-1 line-clamp-2">{section.title}</span>
                              </button>
                            ))}
                        </nav>
                      </div>
                    </div>

                    {/* Mobile TOC Overlay */}
                    {isTocOpen && (
                      <div className="absolute inset-0 bg-base-100 z-20 p-6 overflow-y-auto lg:hidden">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold">Table of Contents</h4>
                          <button
                            className="btn btn-sm btn-circle btn-ghost"
                            onClick={() => setIsTocOpen(false)}
                            aria-label="Close table of contents"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <nav className="space-y-2">
                          {fullBlogContent.blog_content.sections
                            .sort((a, b) => a.order - b.order)
                            .map((section, index) => (
                              <button
                                key={section.htn_node_id}
                                onClick={() => handleScrollToSection(section.htn_node_id)}
                                className={`toc-item w-full text-left text-sm py-3 px-4 rounded transition-all min-h-[44px] flex items-center gap-2 ${
                                  activeSection === section.htn_node_id
                                    ? "toc-item active bg-base-200 border-l-4 border-primary font-semibold"
                                    : "border-l-4 border-transparent hover:bg-base-200"
                                }`}
                              >
                                <span className="text-xs opacity-60 flex-shrink-0">{index + 1}.</span>
                                <span className="flex-1">{section.title}</span>
                              </button>
                            ))}
                        </nav>
                      </div>
                    )}
                  </>
                )}

                {/* Content Scrolling Area */}
                <div
                  id="blog-content-scroll"
                  className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
                >
                  {/* Loading Full Content - Skeleton */}
                  {isLoadingFullContent && (
                    <div className="space-y-6" role="status" aria-live="polite" aria-label="Loading blog content">
                      {/* Title Skeleton */}
                      <div className="skeleton h-8 w-3/4 mb-4"></div>

                      {/* Section 1 */}
                      <div className="space-y-3">
                        <div className="skeleton h-6 w-1/2 mb-3"></div>
                        <div className="skeleton h-4 w-full mb-2"></div>
                        <div className="skeleton h-4 w-full mb-2"></div>
                        <div className="skeleton h-4 w-5/6 mb-2"></div>
                      </div>

                      {/* Section 2 */}
                      <div className="space-y-3">
                        <div className="skeleton h-6 w-2/5 mb-3"></div>
                        <div className="skeleton h-4 w-full mb-2"></div>
                        <div className="skeleton h-4 w-full mb-2"></div>
                        <div className="skeleton h-4 w-4/5 mb-2"></div>
                      </div>

                      {/* Section 3 */}
                      <div className="space-y-3">
                        <div className="skeleton h-6 w-3/5 mb-3"></div>
                        <div className="skeleton h-4 w-full mb-2"></div>
                        <div className="skeleton h-4 w-full mb-2"></div>
                        <div className="skeleton h-4 w-3/4 mb-2"></div>
                      </div>

                      {/* Metadata Footer Skeleton */}
                      <div className="skeleton h-24 w-full"></div>

                      <span className="sr-only">Loading blog content</span>
                    </div>
                  )}

                  {/* Modal Content */}
                  {!isLoadingFullContent && (
                    <div>
                      {/* Modal Error State */}
                      {modalError && (
                        <div className="alert alert-error mb-4" role="alert" aria-live="assertive">
                          <AlertCircle className="w-5 h-5" />
                          <span>{modalError}</span>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => selectedBlog && handleOpenBlog(selectedBlog)}
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {fullBlogContent?.blog_content && fullBlogContent.blog_content.sections ? (
                        // Render full blog sections
                        <div className="space-y-8 lg:space-y-12">
                          {fullBlogContent.blog_content.sections
                            .sort((a, b) => a.order - b.order)
                            .map((section, index) => (
                              <section
                                key={section.htn_node_id}
                                id={section.htn_node_id}
                                className={`blog-section scroll-mt-20 border-b border-base-200 pb-8 last:border-b-0 relative ${
                                  currentSectionIndex === index ? "ring-2 ring-primary/20 rounded-lg p-4 -m-4" : ""
                                }`}
                              >
                                {/* Copy Link Button */}
                                <button
                                  className="absolute top-0 right-0 btn btn-ghost btn-sm focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                  onClick={() => handleCopyLink(section.htn_node_id, section.title, fullBlogContent.id)}
                                  aria-label={`Copy link to ${section.title}`}
                                  title="Copy link to this section"
                                >
                                  {copiedSectionId === section.htn_node_id ? (
                                    <Check className="w-4 h-4 text-success" />
                                  ) : (
                                    <Link className="w-4 h-4" />
                                  )}
                                </button>

                                <h4 className="text-2xl lg:text-3xl font-bold mb-4 lg:mb-6 pr-12">{section.title}</h4>
                                <MarkdownRenderer content={section.content} />
                                {section.word_count && (
                                  <div className="text-xs opacity-60 mt-3">{section.word_count} words</div>
                                )}
                              </section>
                            ))}

                          {fullBlogContent.blog_content.metadata && (
                            <div className="bg-base-200 rounded-lg p-4 lg:p-6 space-y-3">
                              <h4 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-3">
                                Blog Metadata
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <FileText className="w-4 h-4 opacity-60" />
                                  <span>
                                    <strong>Total Words:</strong> {fullBlogContent.blog_content.metadata.total_words}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="w-4 h-4 opacity-60" />
                                  <span>
                                    <strong>Generation Time:</strong>{" "}
                                    {fullBlogContent.blog_content.metadata.generation_time_seconds}s
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <FileText className="w-4 h-4 opacity-60" />
                                  <span>
                                    <strong>Model:</strong> {fullBlogContent.blog_content.metadata.model}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <FileText className="w-4 h-4 opacity-60" />
                                  <span>
                                    <strong>Sections:</strong>{" "}
                                    {fullBlogContent.blog_content.metadata.sections_generated}
                                  </span>
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
                            <div className="alert alert-warning mt-4" role="alert">
                              <AlertTriangle className="w-5 h-5" />
                              <span className="text-sm">
                                Unable to load full content. You&apos;re viewing a preview.
                              </span>
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => selectedBlog && handleOpenBlog(selectedBlog)}
                              >
                                Retry
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {/* Keyboard Shortcut Hint */}
                      {fullBlogContent?.blog_content?.sections && (
                        <div className="text-center text-xs opacity-50 mt-8 pt-4 border-t border-base-200">
                          Press <kbd className="kbd kbd-xs">Esc</kbd> to close, <kbd className="kbd kbd-xs">↑</kbd>
                          <kbd className="kbd kbd-xs">↓</kbd> to navigate sections
                        </div>
                      )}
                    </div>
                  )}

                  {/* Screen reader announcements */}
                  <div className="sr-only" role="status" aria-live="polite">
                    {isLoadingFullContent && "Loading blog content"}
                    {!isLoadingFullContent && fullBlogContent && "Content loaded"}
                  </div>
                </div>
              </div>

              {/* Enhanced Footer Metadata */}
              <div className="border-t border-base-300 px-4 sm:px-6 py-4 lg:py-6 bg-base-100">
                <h4 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-3">Published Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                  <div className="bg-base-50 dark:bg-base-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 opacity-60" />
                      <span>
                        <strong>Author:</strong> {truncateAddress(selectedBlog.author_wallet, 8)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-base-50 dark:bg-base-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 opacity-60" />
                      <span>
                        <strong>Created:</strong> {formatTimestamp(selectedBlog.created_at)}
                      </span>
                    </div>
                  </div>
                  {selectedBlog.word_count && (
                    <div className="bg-base-50 dark:bg-base-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 opacity-60" />
                        <span>
                          <strong>Words:</strong> {selectedBlog.word_count}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedBlog.tx_hash && (
                    <div className="bg-base-50 dark:bg-base-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <ExternalLink className="w-4 h-4 opacity-60" />
                        <a
                          href={`https://etherscan.io/tx/${selectedBlog.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary hover:underline flex items-center gap-1"
                        >
                          <strong>Transaction:</strong> {truncateAddress(selectedBlog.tx_hash, 10)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
