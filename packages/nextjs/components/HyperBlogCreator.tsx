"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HyperBlogProgressModal } from "@/components/HyperBlogProgressModal";
import { usePaymentHeader } from "@/hooks/usePaymentHeader";
import {
  HyperBlogHTNProgress,
  HyperBlogInfo,
  PurchaseHyperBlogRequest,
  PurchaseHyperBlogResponse,
} from "@/lib/types/delve-api";
import { formatErrorMessage } from "@/lib/utils";
import { notification } from "@/utils/scaffold-eth/notification";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

interface HyperBlogCreatorProps {
  dataroomId: string;
  dataroomDescription?: string;
  dataroomPrice?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (hyperblogId: string) => void;
}

export const HyperBlogCreator: React.FC<HyperBlogCreatorProps> = ({
  dataroomId,
  dataroomDescription,
  dataroomPrice,
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Form state
  const [userQuery, setUserQuery] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [blogLength, setBlogLength] = useState<"short" | "medium" | "long">("medium");

  // Loading/Error state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  // Result state
  const [hyperblogId, setHyperblogId] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "generating" | "completed" | "failed">("idle");
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // HTN Progress state
  const [htnProgress, setHtnProgress] = useState<HyperBlogHTNProgress | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);

  // Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hooks
  const { isConnected, address } = useAccount();
  const { buildAndSignPaymentHeader, isLoading: isSigningPayment } = usePaymentHeader();

  // Effect: Reset state on modal close
  useEffect(() => {
    if (!isOpen) {
      setUserQuery("");
      setIsPublic(true);
      setBlogLength("medium");
      setIsLoading(false);
      setIsPriceLoading(false);
      setError(null);
      setHyperblogId(null);
      setGenerationStatus("idle");
      setWordCount(null);
      setPreview(null);
      setHtnProgress(null);
      setShowProgressModal(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isOpen]);

  // Effect: Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Effect: Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current && isConnected) {
      textareaRef.current.focus();
    }
  }, [isOpen, isConnected]);

  // Effect: Clear price loading state when dataroomPrice prop changes
  useEffect(() => {
    if (dataroomPrice !== undefined) {
      setIsPriceLoading(false);
    }
  }, [dataroomPrice]);

  // Validation helper
  const isQueryValid = userQuery.trim().length >= 3 && userQuery.length <= 500;

  // Character count color
  const getCharCountColor = () => {
    if (userQuery.length > 500) return "text-error";
    if (userQuery.length < 3) return "text-warning";
    return "text-success";
  };

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Start polling function
  const startPolling = useCallback(
    async (hyperblogIdToCheck: string) => {
      // Clear existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Poll function
      const pollStatus = async () => {
        try {
          const response = await fetch(`/api/hyperblogs/${hyperblogIdToCheck}`);
          if (!response.ok) {
            console.error("Failed to fetch hyperblog status:", response.statusText);
            return;
          }

          const data: HyperBlogInfo = await response.json();
          setGenerationStatus(data.generation_status);

          // Update HTN progress if available
          if (data.htn_progress) {
            console.log("HTN progress received:", data.htn_progress);
            setHtnProgress(data.htn_progress);
          }

          if (data.generation_status === "generating") {
            // Keep progress modal open during generation
            setShowProgressModal(true);
          } else if (data.generation_status === "completed") {
            setWordCount(data.word_count);
            setPreview(data.preview);
            setShowProgressModal(false);
            setHtnProgress(null);
            stopPolling();
            const truncatedQuery = userQuery.length > 60 ? userQuery.substring(0, 60) + "..." : userQuery;
            notification.success(`Blog completed: "${truncatedQuery}"!`);
            if (onSuccess) {
              onSuccess(hyperblogIdToCheck);
            }
          } else if (data.generation_status === "failed") {
            setShowProgressModal(false);
            setHtnProgress(null);
            stopPolling();
            setError("Blog generation failed. Please try again.");
            notification.error("Blog generation failed");
          }
        } catch (err) {
          console.error("Error polling hyperblog status:", err);
          // Don't stop polling on error - will retry on next interval
        }
      };

      // Call immediately
      await pollStatus();

      // Set up interval
      pollingIntervalRef.current = setInterval(pollStatus, 5000);
    },
    [stopPolling, onSuccess, userQuery],
  );

  // Submit handler
  const handleSubmit = useCallback(async () => {
    // Pre-validation
    if (!isConnected || !address) {
      setError("Please connect your wallet to create a blog");
      notification.error("Please connect your wallet");
      return;
    }

    if (userQuery.trim().length < 3 || userQuery.length > 500) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate payment amount
      let priceUsd: number;

      setIsPriceLoading(true);
      try {
        // Always fetch current dynamic price from backend to get minimum floor enforcement
        // The dataroomPrice prop may be stale or not include minimum floor calculation
        const dataroomResponse = await fetch(`/api/datarooms/${dataroomId}`);
        if (!dataroomResponse.ok) {
          throw new Error("Failed to fetch dataroom details");
        }
        const dataroomData = await dataroomResponse.json();
        // Use current_hyperblog_price_usd which includes minimum floor enforcement
        const dynamicPrice = dataroomData.current_hyperblog_price_usd
          ? parseFloat(dataroomData.current_hyperblog_price_usd)
          : 0;
        priceUsd = dynamicPrice > 0 ? dynamicPrice : dataroomData.price_usd;
      } finally {
        setIsPriceLoading(false);
      }

      // Set amount as decimal string (buildAndSignPaymentHeader handles conversion)
      const amount = priceUsd.toFixed(2);

      // Build and sign payment
      notification.info("Signing payment...");
      const paymentHeader = await buildAndSignPaymentHeader(amount);

      if (!paymentHeader) {
        throw new Error("Payment signing cancelled or failed");
      }

      // Build request body
      // Note: generation_mode defaults to "blog" on backend for multi-section articles
      const requestBody: PurchaseHyperBlogRequest = {
        payment_header: paymentHeader,
        dataroom_id: dataroomId,
        user_query: userQuery.trim(),
        is_public: isPublic,
        blog_length: blogLength,
        generation_mode: "blog", // Explicit: use blog HTN for multi-section articles
        expected_amount: amount, // Pass signed amount to ensure backend uses same price
      };

      // Call purchase API
      notification.info("Creating blog...");
      const response = await fetch("/api/hyperblogs/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to create blog" }));
        throw new Error(errorData.detail || errorData.message || "Failed to create blog");
      }

      const data: PurchaseHyperBlogResponse = await response.json();

      // Handle success
      const createdHyperblogId = data.hyperblog.id;
      const status = data.hyperblog.generation_status;

      setHyperblogId(createdHyperblogId);
      setGenerationStatus(status);

      notification.success("Blog purchase successful! Generating content...");

      // Start polling if generating
      if (status === "generating") {
        // Show progress modal immediately
        setShowProgressModal(true);
        // Set initial HTN progress if available in response
        if (data.hyperblog.htn_progress) {
          setHtnProgress(data.hyperblog.htn_progress);
        }
        await startPolling(createdHyperblogId);
      } else if (status === "completed") {
        setWordCount(data.hyperblog.word_count);
        setPreview(data.hyperblog.preview);
        notification.success("Blog generated successfully!");
        if (onSuccess) {
          onSuccess(createdHyperblogId);
        }
      }

      setIsLoading(false);
    } catch (err: any) {
      const errorMessage = formatErrorMessage(err);
      setError(errorMessage);
      notification.error(errorMessage);
      setIsLoading(false);
    }
  }, [
    isConnected,
    address,
    userQuery,
    dataroomId,
    dataroomPrice,
    isPublic,
    blogLength,
    buildAndSignPaymentHeader,
    startPolling,
    onSuccess,
  ]);

  // Close handler
  const handleClose = useCallback(() => {
    stopPolling();
    onClose();
  }, [stopPolling, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "Enter" && !e.shiftKey && isQueryValid && !isLoading && !isSigningPayment) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isQueryValid, isLoading, isSigningPayment, handleClose, handleSubmit]);

  // Early return if not open
  if (!isOpen) return null;

  return (
    <div className="modal modal-open" onClick={handleClose} role="dialog" aria-label="Create HyperBlog Modal">
      <div
        className="modal-box relative max-w-full sm:max-w-2xl"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Close button */}
        <button className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3" onClick={handleClose}>
          ✕
        </button>

        {/* Header */}
        <h3 className="font-bold text-2xl mb-2">Create HyperBlog</h3>
        <p className="text-sm opacity-70 mb-6">
          Generate an AI-powered blog post from this dataroom&apos;s knowledge graph
        </p>

        {/* Dataroom Preview */}
        {dataroomDescription && (
          <div className="alert alert-info mb-4">
            <div>
              <div className="flex items-start gap-2">
                <span className="text-xl">📁</span>
                <div className="flex-1">
                  <div className="font-semibold mb-1">Data Room:</div>
                  <div className="text-sm opacity-90">
                    {dataroomDescription.length > 100
                      ? dataroomDescription.substring(0, 100) + "..."
                      : dataroomDescription}
                  </div>
                  {isPriceLoading ? (
                    <div className="mt-2 text-sm font-bold flex items-center gap-2">
                      <span className="loading loading-spinner loading-xs"></span>
                      Calculating price...
                    </div>
                  ) : dataroomPrice !== undefined ? (
                    <div className="mt-2 text-sm font-bold">${dataroomPrice.toFixed(2)} USD</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Connection Check */}
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <p className="text-center text-lg opacity-80">Please connect your wallet to create a blog</p>
            <ConnectButton />
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="space-y-4">
              {/* User Query Input */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Blog Topic <span className={`text-xs ${getCharCountColor()}`}>({userQuery.length}/500)</span>
                  </span>
                </label>
                <textarea
                  ref={textareaRef}
                  className={`textarea textarea-bordered h-24 sm:h-32 w-full ${
                    !isQueryValid && userQuery.length > 0 ? "textarea-error" : ""
                  }`}
                  placeholder="e.g., 'How to play white in chess openings' or 'Introduction to quantum computing'"
                  value={userQuery}
                  onChange={e => setUserQuery(e.target.value)}
                  maxLength={500}
                  disabled={isLoading || generationStatus === "generating"}
                />
                <label className="label">
                  <span className="label-text-alt">Describe what you want the blog to cover (3-500 characters)</span>
                </label>
              </div>

              {/* Blog Length Selector */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Blog Length</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${blogLength === "short" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setBlogLength("short")}
                    disabled={isLoading || generationStatus === "generating"}
                  >
                    Short
                    <span className="text-xs opacity-70">(2 min)</span>
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${blogLength === "medium" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setBlogLength("medium")}
                    disabled={isLoading || generationStatus === "generating"}
                  >
                    Medium
                    <span className="text-xs opacity-70">(5 min)</span>
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${blogLength === "long" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setBlogLength("long")}
                    disabled={isLoading || generationStatus === "generating"}
                  >
                    Long
                    <span className="text-xs opacity-70">(10 min)</span>
                  </button>
                </div>
                <label className="label">
                  <span className="label-text-alt">Choose your preferred reading length</span>
                </label>
              </div>

              {/* Visibility Toggle */}
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    disabled={isLoading || generationStatus === "generating"}
                  />
                  <span className="label-text">Make blog public (visible in dataroom feed)</span>
                </label>
              </div>

              {/* Error Display */}
              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              {/* Generation Status Display - Hidden when progress modal is shown */}
              {hyperblogId && !showProgressModal && (
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold">Status:</span>
                      {generationStatus === "generating" && (
                        <span className="badge badge-warning gap-2">
                          <span className="loading loading-spinner loading-xs"></span>
                          Generating...
                        </span>
                      )}
                      {generationStatus === "completed" && <span className="badge badge-success">✓ Completed</span>}
                      {generationStatus === "failed" && <span className="badge badge-error">✗ Failed</span>}
                    </div>

                    {generationStatus === "completed" && wordCount && (
                      <div className="text-sm space-y-2">
                        <p>
                          <span className="font-semibold">Word Count:</span> {wordCount.toLocaleString()} words
                        </p>
                        {preview && (
                          <div>
                            <p className="font-semibold mb-1">Preview:</p>
                            <p className="text-xs opacity-80 italic">{preview}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {generationStatus === "generating" && (
                      <p className="text-sm opacity-70">
                        Your blog is being generated. This may take 30-60 seconds. You can close this and check back
                        later.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="modal-action">
              {!hyperblogId ? (
                <>
                  <button className="btn" onClick={handleClose} disabled={isLoading}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={!isQueryValid || isLoading || isSigningPayment}
                  >
                    {isSigningPayment ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Signing Payment...
                      </>
                    ) : isLoading ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Creating...
                      </>
                    ) : (
                      "Create Blog"
                    )}
                  </button>
                </>
              ) : generationStatus === "completed" ? (
                <>
                  <button className="btn" onClick={handleClose}>
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (onSuccess && hyperblogId) {
                        onSuccess(hyperblogId);
                      }
                      handleClose();
                    }}
                  >
                    View Blog
                  </button>
                </>
              ) : (
                <button className="btn" onClick={handleClose}>
                  Close
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* HTN Progress Modal - Overlays on top of the main modal */}
      <HyperBlogProgressModal
        isOpen={showProgressModal}
        htnProgress={htnProgress}
        userQuery={userQuery}
        onClose={() => setShowProgressModal(false)}
      />
    </div>
  );
};
