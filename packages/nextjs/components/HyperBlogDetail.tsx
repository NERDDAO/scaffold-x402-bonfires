"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { HyperBlogInfo } from "@/lib/types/delve-api";
import { calculateReadingTime } from "@/lib/utils";
import { notification } from "@/utils/scaffold-eth/notification";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Link as LinkIcon,
  Menu,
  MessageCircle,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from "lucide-react";
import { useAccount } from "wagmi";

type CommentType = {
  id: string;
  hyperblog_id: string;
  user_wallet: string;
  content: string;
  created_at: string;
};

interface HyperBlogDetailProps {
  blog: HyperBlogInfo;
  onBack?: () => void;
  showBackButton?: boolean;
  initialSectionId?: string | null;
}

/**
 * HyperBlogDetail Component
 *
 * Reusable component that displays the full hyperblog content with all interactive features.
 * Used in both the feed modal and the dedicated detail page.
 */
export const HyperBlogDetail = ({ blog, onBack, showBackButton = true, initialSectionId }: HyperBlogDetailProps) => {
  const { address: userAddress, isConnected } = useAccount();

  // Full Content State
  const [fullBlogContent, setFullBlogContent] = useState<HyperBlogInfo | null>(blog.blog_content ? blog : null);
  const [isLoadingFullContent, setIsLoadingFullContent] = useState<boolean>(!blog.blog_content);
  const [error, setError] = useState<string | null>(null);

  // Interaction State
  const [votingStates, setVotingStates] = useState<Map<string, "upvoting" | "downvoting" | null>>(new Map());
  const [userVotes, setUserVotes] = useState<Map<string, "upvote" | "downvote" | null>>(new Map());
  const [commentsOpen, setCommentsOpen] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>("");
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [viewed, setViewed] = useState<boolean>(false);

  // Banner State
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isBannerLoading, setIsBannerLoading] = useState<boolean>(false);
  const [bannerError, setBannerError] = useState<boolean>(false);
  const [bannerCached, setBannerCached] = useState<boolean>(false);

  // Navigation State
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);

  // Refs
  const tocRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

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
   * Fetch Full Content
   */
  const fetchFullContent = useCallback(async () => {
    if (fullBlogContent?.blog_content) return;

    setIsLoadingFullContent(true);
    setError(null);

    try {
      const response = await fetch(`/api/hyperblogs/${blog.id}`);
      if (!response.ok) {
        throw new Error(`Failed to load full content: ${response.statusText}`);
      }
      const data: HyperBlogInfo = await response.json();
      setFullBlogContent(data);
    } catch (err: any) {
      console.error("Error loading full blog content:", err);
      setError("Failed to load full blog content. Please try again.");
      // Set preview content as fallback
      setFullBlogContent(blog);
    } finally {
      setIsLoadingFullContent(false);
    }
  }, [blog, fullBlogContent]);

  useEffect(() => {
    fetchFullContent();
  }, [fetchFullContent]);

  /**
   * Generate Banner Image
   */
  const generateBanner = useCallback(async () => {
    if (bannerUrl || isBannerLoading) return;

    setIsBannerLoading(true);
    setBannerError(false);

    try {
      const response = await fetch(`/api/hyperblogs/${blog.id}/banner`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate banner");
      }

      const data = await response.json();
      setBannerUrl(data.banner_url);
      setBannerCached(data.cached || false);
    } catch (err) {
      console.error("Error generating banner:", err);
      setBannerError(true);
    } finally {
      setIsBannerLoading(false);
    }
  }, [blog.id, bannerUrl, isBannerLoading]);

  /**
   * Trigger banner generation when content is loaded
   */
  useEffect(() => {
    if (fullBlogContent && fullBlogContent.image_prompt && !fullBlogContent.banner_url && !bannerUrl) {
      generateBanner();
    }
  }, [fullBlogContent, generateBanner, bannerUrl]);

  /**
   * Initialize banner state from blog data
   */
  useEffect(() => {
    if (fullBlogContent?.banner_url) {
      setBannerUrl(fullBlogContent.banner_url);
      setBannerCached(true);
    }
  }, [fullBlogContent]);

  /**
   * Handle View Increment
   */
  useEffect(() => {
    const handleIncrementView = async () => {
      if (viewed) return;

      // Check session storage
      try {
        const storedViews = sessionStorage.getItem("viewedHyperBlogs");
        let viewedSet = new Set<string>();
        if (storedViews) {
          viewedSet = new Set(JSON.parse(storedViews));
        }

        if (viewedSet.has(blog.id)) {
          setViewed(true);
          return;
        }

        const response = await fetch(`/api/hyperblogs/${blog.id}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_wallet: isConnected ? userAddress : undefined }),
        });

        if (response.ok) {
          viewedSet.add(blog.id);
          sessionStorage.setItem("viewedHyperBlogs", JSON.stringify(Array.from(viewedSet)));
          setViewed(true);

          // Update view count locally
          const updatedBlog = await response.json();
          setFullBlogContent(prev => (prev ? { ...prev, view_count: updatedBlog.view_count } : null));
        }
      } catch (err) {
        console.error("Error tracking view:", err);
      }
    };

    handleIncrementView();
  }, [blog.id, isConnected, userAddress, viewed]);

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
   * Scroll to initial section if provided
   */
  useEffect(() => {
    if (initialSectionId && !isLoadingFullContent && fullBlogContent?.blog_content?.sections) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        handleScrollToSection(initialSectionId);
      }, 300);
    }
  }, [initialSectionId, isLoadingFullContent, fullBlogContent, handleScrollToSection]);

  /**
   * Scroll tracking effect for TOC active state
   */
  useEffect(() => {
    if (!fullBlogContent?.blog_content?.sections) {
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
  }, [fullBlogContent]);

  /**
   * Handler: Copy section link to clipboard
   */
  const handleCopyLink = useCallback(
    (sectionId: string, sectionTitle: string) => {
      const url = `${window.location.origin}/hyperblogs/${blog.id}#${sectionId}`;

      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopiedSectionId(sectionId);
          notification.success(`Link to "${sectionTitle}" copied to clipboard`);

          setTimeout(() => {
            setCopiedSectionId(null);
          }, 2000);
        })
        .catch(err => {
          console.error("Failed to copy link:", err);
          notification.error("Failed to copy link");
        });
    },
    [blog.id],
  );

  /**
   * Handler: Vote on a blog
   */
  const handleVote = useCallback(
    async (voteType: "upvote" | "downvote") => {
      if (!isConnected) {
        notification.error("Please connect your wallet to vote");
        return;
      }

      if (votingStates.get(blog.id)) {
        return;
      }

      setVotingStates(prev => new Map(prev).set(blog.id, voteType === "upvote" ? "upvoting" : "downvoting"));

      try {
        const response = await fetch(`/api/hyperblogs/${blog.id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote_type: voteType, user_wallet: userAddress }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to vote");
        }

        const voteResponse: { success: boolean; upvotes: number; downvotes: number; user_vote: string | null } =
          await response.json();

        setFullBlogContent(prev =>
          prev ? { ...prev, upvotes: voteResponse.upvotes, downvotes: voteResponse.downvotes } : null,
        );

        setUserVotes(prev => new Map(prev).set(blog.id, voteType));
        notification.success(`Successfully ${voteType}d!`);
      } catch (err: any) {
        console.error("Vote error:", err);
        notification.error(err.message || "Failed to submit vote");
      } finally {
        setVotingStates(prev => {
          const newMap = new Map(prev);
          newMap.delete(blog.id);
          return newMap;
        });
      }
    },
    [isConnected, userAddress, votingStates, blog.id],
  );

  /**
   * Handler: Fetch comments
   */
  const handleFetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/hyperblogs/${blog.id}/comments`);
      if (!response.ok) throw new Error("Failed to fetch comments");
      const data = await response.json();
      // The backend returns { comments: [], count: ... } or just [] if older API
      // We need to handle both, but newer API returns object with comments array
      const commentsList = Array.isArray(data) ? data : data.comments || [];
      setComments(commentsList);
    } catch (error) {
      console.error("Error fetching comments:", error);
      notification.error("Failed to load comments");
    } finally {
      setLoadingComments(false);
    }
  }, [blog.id]);

  /**
   * Handler: Toggle comments section
   */
  const handleToggleComments = useCallback(() => {
    if (!commentsOpen && comments.length === 0) {
      handleFetchComments();
    }
    setCommentsOpen(!commentsOpen);
  }, [commentsOpen, comments.length, handleFetchComments]);

  /**
   * Handler: Submit comment
   */
  const handleSubmitComment = useCallback(async () => {
    if (!isConnected) {
      notification.error("Please connect your wallet to comment");
      return;
    }

    if (!newCommentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/hyperblogs/${blog.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_text: newCommentText, user_wallet: userAddress }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to post comment");
      }

      const newComment = await response.json();

      setComments(prev => [newComment, ...prev]);

      // Update comment count
      setFullBlogContent(prev => (prev ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : null));

      setNewCommentText("");
      notification.success("Comment posted!");
    } catch (error: any) {
      console.error("Error posting comment:", error);
      notification.error(error.message || "Failed to post comment");
    } finally {
      setIsSubmittingComment(false);
    }
  }, [isConnected, newCommentText, userAddress, blog.id]);

  /**
   * Keyboard navigation for sections
   */
  useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onBack) {
        onBack();
        return;
      }

      if (!fullBlogContent?.blog_content?.sections) return;

      const sections = fullBlogContent.blog_content.sections.sort((a, b) => a.order - b.order);
      const maxIndex = sections.length - 1;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        // Only navigate if not typing in comment box
        if (document.activeElement?.tagName === "TEXTAREA") return;

        event.preventDefault();
        const nextIndex = Math.min(currentSectionIndex + 1, maxIndex);
        setCurrentSectionIndex(nextIndex);
        handleScrollToSection(sections[nextIndex].htn_node_id);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        if (document.activeElement?.tagName === "TEXTAREA") return;

        event.preventDefault();
        const prevIndex = Math.max(currentSectionIndex - 1, 0);
        setCurrentSectionIndex(prevIndex);
        handleScrollToSection(sections[prevIndex].htn_node_id);
      }
    };

    window.addEventListener("keydown", handleKeyboardNavigation);
    return () => {
      window.removeEventListener("keydown", handleKeyboardNavigation);
    };
  }, [fullBlogContent, currentSectionIndex, handleScrollToSection, onBack]);

  const currentBlog = fullBlogContent || blog;

  return (
    <div className="bg-base-100 min-h-screen flex flex-col w-full">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-base-100/95 backdrop-blur border-b border-base-300 px-4 sm:px-6 py-3 sm:py-4 flex items-start justify-between gap-4">
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
            <h3 className="font-bold text-xl sm:text-2xl mb-2 break-words">{currentBlog.user_query}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge(currentBlog.generation_status)}
              {currentBlog.generation_status === "completed" && currentBlog.word_count && (
                <span
                  className="badge badge-ghost gap-1"
                  aria-label={`Reading time: ${calculateReadingTime(currentBlog.word_count)}`}
                >
                  <Clock className="w-3 h-3" />
                  {calculateReadingTime(currentBlog.word_count)}
                </span>
              )}
              <span className="badge badge-ghost gap-1" aria-label={`Views: ${currentBlog.view_count || 0}`}>
                <Eye className="w-3 h-3" />
                {currentBlog.view_count || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Back/Close Button */}
        {showBackButton && (
          <button className="btn btn-sm sm:btn-md btn-ghost gap-2" onClick={onBack} aria-label="Go back">
            {onBack ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            <span className="hidden sm:inline">{onBack ? "Close" : "Back"}</span>
          </button>
        )}
        {!showBackButton && onBack && (
          <button
            className="btn btn-sm sm:btn-md btn-circle btn-ghost flex-shrink-0"
            onClick={onBack}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Banner Image Section */}
      {!isLoadingFullContent && (fullBlogContent?.image_prompt || bannerUrl) && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {/* Banner Loading State */}
          {isBannerLoading && (
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-base-200 animate-pulse">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <span className="text-sm opacity-70">Generating banner...</span>
              </div>
            </div>
          )}

          {/* Banner Image Display */}
          {bannerUrl && !bannerError && !isBannerLoading && (
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden shadow-lg">
              <Image
                src={bannerUrl}
                alt={`Banner for ${currentBlog.user_query}`}
                fill
                className="object-cover"
                onError={() => setBannerError(true)}
                unoptimized
              />
              {bannerCached && (
                <div className="absolute top-2 right-2 badge badge-sm badge-ghost bg-base-100/80 gap-1">
                  <Check className="w-3 h-3" />
                  Cached
                </div>
              )}
            </div>
          )}

          {/* Banner Error/Fallback State */}
          {(bannerError || (!bannerUrl && !isBannerLoading && fullBlogContent?.image_prompt)) && !isBannerLoading && (
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-medium opacity-60 text-center px-4">{currentBlog.user_query}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative max-w-full">
        {/* Table of Contents Sidebar */}
        {currentBlog.blog_content?.sections && (
          <>
            {/* Desktop TOC */}
            <div
              ref={tocRef}
              className="hidden lg:block lg:w-64 lg:border-r lg:border-base-300 lg:overflow-y-auto lg:h-[calc(100vh-100px)] sticky top-[80px] z-10"
            >
              <div className="p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-3">Table of Contents</h4>
                <nav className="space-y-1">
                  {currentBlog.blog_content.sections
                    .sort((a, b) => a.order - b.order)
                    .map((section, index) => (
                      <button
                        key={section.htn_node_id}
                        onClick={() => handleScrollToSection(section.htn_node_id)}
                        className={`toc-item w-full text-left text-sm py-2 px-4 rounded transition-all min-h-[44px] flex items-center gap-2 focus:ring-2 focus:ring-primary focus:outline-none ${
                          activeSection === section.htn_node_id
                            ? "toc-item active bg-base-200 border-l-4 border-primary font-semibold"
                            : "border-l-4 border-transparent hover:bg-base-200"
                        }`}
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
              <div className="fixed inset-0 bg-base-100 z-50 p-6 overflow-y-auto lg:hidden">
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
                  {currentBlog.blog_content.sections
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
        <div ref={contentRef} className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 max-w-4xl mx-auto w-full">
          {/* Loading Full Content - Skeleton */}
          {isLoadingFullContent && (
            <div className="space-y-6 max-w-3xl mx-auto" role="status" aria-live="polite">
              <div className="skeleton h-8 w-3/4 mb-4"></div>
              <div className="space-y-3">
                <div className="skeleton h-6 w-1/2 mb-3"></div>
                <div className="skeleton h-4 w-full mb-2"></div>
                <div className="skeleton h-4 w-full mb-2"></div>
                <div className="skeleton h-4 w-5/6 mb-2"></div>
              </div>
              <div className="space-y-3">
                <div className="skeleton h-6 w-2/5 mb-3"></div>
                <div className="skeleton h-4 w-full mb-2"></div>
                <div className="skeleton h-4 w-full mb-2"></div>
                <div className="skeleton h-4 w-4/5 mb-2"></div>
              </div>
            </div>
          )}

          {/* Main Content */}
          {!isLoadingFullContent && (
            <div className="max-w-3xl mx-auto">
              {/* Error State */}
              {error && (
                <div className="alert alert-error mb-4">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                  <button className="btn btn-sm btn-primary" onClick={fetchFullContent}>
                    Retry
                  </button>
                </div>
              )}

              {currentBlog.blog_content && currentBlog.blog_content.sections ? (
                // Render full blog sections
                <div className="space-y-8 lg:space-y-12">
                  {currentBlog.blog_content.sections
                    .sort((a, b) => a.order - b.order)
                    .map(section => (
                      <section
                        key={section.htn_node_id}
                        id={section.htn_node_id}
                        className={`blog-section scroll-mt-24 border-b border-base-200 pb-8 last:border-b-0 relative group`}
                      >
                        {/* Copy Link Button */}
                        <button
                          className="absolute top-0 right-0 btn btn-ghost btn-sm opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                          onClick={() => handleCopyLink(section.htn_node_id, section.title)}
                          aria-label={`Copy link to ${section.title}`}
                          title="Copy link to this section"
                        >
                          {copiedSectionId === section.htn_node_id ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <LinkIcon className="w-4 h-4" />
                          )}
                        </button>

                        <h4 className="text-2xl lg:text-3xl font-bold mb-4 lg:mb-6 pr-12 text-base-content">
                          {section.title}
                        </h4>
                        <MarkdownRenderer content={section.content} />
                        {section.word_count && (
                          <div className="text-xs opacity-60 mt-3">{section.word_count} words</div>
                        )}
                      </section>
                    ))}

                  {currentBlog.blog_content.metadata && (
                    <div className="bg-base-200 rounded-lg p-4 lg:p-6 space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-3">Blog Metadata</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 opacity-60" />
                            <span>
                              <strong>Total Words:</strong> {currentBlog.blog_content.metadata.total_words}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 opacity-60" />
                            <span>
                              <strong>Generation Time:</strong>{" "}
                              {currentBlog.blog_content.metadata.generation_time_seconds}s
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 opacity-60" />
                            <span>
                              <strong>Model:</strong> {currentBlog.blog_content.metadata.model}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 opacity-60" />
                            <span>
                              <strong>Sections:</strong> {currentBlog.blog_content.metadata.sections_generated}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Fallback to preview
                <>
                  <div className="prose prose-lg max-w-none mb-8">
                    <p className="text-base leading-relaxed whitespace-pre-wrap">{currentBlog.preview}</p>
                  </div>
                  {currentBlog.generation_status === "completed" && (
                    <div className="alert alert-warning mt-4" role="alert">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="text-sm">Unable to load full content. You&apos;re viewing a preview.</span>
                      <button className="btn btn-sm btn-ghost" onClick={fetchFullContent}>
                        Retry
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Comments Section */}
              <div className="mt-12 pt-8 border-t border-base-200">
                <div
                  className={`collapse collapse-arrow bg-base-100 border border-base-200 rounded-lg ${commentsOpen ? "collapse-open" : "collapse-close"}`}
                >
                  <div
                    className="collapse-title text-lg font-medium flex items-center gap-2 cursor-pointer"
                    onClick={handleToggleComments}
                  >
                    <MessageCircle className="w-5 h-5" />
                    Comments ({currentBlog.comment_count || 0})
                  </div>
                  <div className="collapse-content">
                    <div className="space-y-4 mb-6 mt-2">
                      {loadingComments ? (
                        <div className="flex justify-center py-4">
                          <span className="loading loading-spinner"></span>
                        </div>
                      ) : comments.length > 0 ? (
                        comments.map(comment => (
                          <div key={comment.id} className="card bg-base-50 border border-base-200 p-3 sm:p-4 text-sm">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-xs opacity-70">
                                {truncateAddress(comment.user_wallet)}
                              </span>
                              <span className="text-xs opacity-50">{formatTimestamp(comment.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center opacity-50 py-4">No comments yet. Be the first!</div>
                      )}
                    </div>

                    {isConnected ? (
                      <div className="form-control">
                        <textarea
                          className="textarea textarea-bordered h-24 mb-2"
                          placeholder="Write a comment..."
                          value={newCommentText}
                          onChange={e => setNewCommentText(e.target.value)}
                          maxLength={1000}
                          disabled={isSubmittingComment}
                        ></textarea>
                        <div className="flex justify-between items-center">
                          <span className="text-xs opacity-50">{newCommentText.length}/1000</span>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={handleSubmitComment}
                            disabled={!newCommentText.trim() || isSubmittingComment}
                          >
                            {isSubmittingComment ? (
                              <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                              "Post Comment"
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center py-4 bg-base-50 rounded-lg">
                        <ConnectButton />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Voting & Footer Actions */}
              {currentBlog.generation_status === "completed" && (
                <div className="mt-8 flex justify-center gap-4">
                  <button
                    className={`btn gap-2 ${userVotes.get(blog.id) === "upvote" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => handleVote("upvote")}
                    disabled={votingStates.get(blog.id) !== undefined}
                  >
                    {votingStates.get(blog.id) === "upvoting" ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      <ThumbsUp className="w-5 h-5" />
                    )}
                    <span>{currentBlog.upvotes || 0}</span>
                  </button>
                  <button
                    className={`btn gap-2 ${userVotes.get(blog.id) === "downvote" ? "btn-error text-white" : "btn-outline"}`}
                    onClick={() => handleVote("downvote")}
                    disabled={votingStates.get(blog.id) !== undefined}
                  >
                    {votingStates.get(blog.id) === "downvoting" ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      <ThumbsDown className="w-5 h-5" />
                    )}
                    <span>{currentBlog.downvotes || 0}</span>
                  </button>
                </div>
              )}

              <div className="text-center text-xs opacity-50 mt-12 pt-4 border-t border-base-200 pb-8">
                Press <kbd className="kbd kbd-xs">Esc</kbd> to close, <kbd className="kbd kbd-xs">↑</kbd>
                <kbd className="kbd kbd-xs">↓</kbd> to navigate sections
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Metadata */}
      {!isLoadingFullContent && (
        <div className="border-t border-base-300 px-4 sm:px-6 py-4 lg:py-6 bg-base-100 z-20">
          <div className="max-w-5xl mx-auto">
            <h4 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-3">Published Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="bg-base-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 opacity-60" />
                  <span className="truncate">
                    <strong>Author:</strong> {truncateAddress(currentBlog.author_wallet, 8)}
                  </span>
                </div>
              </div>
              <div className="bg-base-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 opacity-60" />
                  <span>
                    <strong>Created:</strong> {formatTimestamp(currentBlog.created_at)}
                  </span>
                </div>
              </div>
              {currentBlog.word_count && (
                <div className="bg-base-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 opacity-60" />
                    <span>
                      <strong>Words:</strong> {currentBlog.word_count}
                    </span>
                  </div>
                </div>
              )}
              {currentBlog.tx_hash && (
                <div className="bg-base-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <ExternalLink className="w-4 h-4 opacity-60" />
                    <a
                      href={`https://etherscan.io/tx/${currentBlog.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary hover:underline flex items-center gap-1 truncate"
                    >
                      <strong>Transaction:</strong> {truncateAddress(currentBlog.tx_hash, 6)}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
