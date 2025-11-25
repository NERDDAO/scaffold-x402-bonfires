"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BonfireInfo, DelveResponse, MicrosubInfo } from "~~/lib/types/delve-api";
import { formatTimestamp, truncateAddress, truncateText } from "~~/lib/utils";

interface DataRoomCardProps {
  microsub: MicrosubInfo;
  bonfires?: BonfireInfo[];
  className?: string;
}

interface PreviewEntity {
  uuid: string;
  name: string;
  summary?: string;
  entity_type?: string;
}

export const DataRoomCard: React.FC<DataRoomCardProps> = ({ microsub, bonfires, className = "" }) => {
  const router = useRouter();
  const [previewEntities, setPreviewEntities] = useState<PreviewEntity[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [hasEverFetched, setHasEverFetched] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get bonfire name
  const getBonfireName = useCallback((): string => {
    if (!microsub.bonfire_id) return "Unknown Bonfire";
    if (!bonfires) return truncateAddress(microsub.bonfire_id, 6);
    const bonfire = bonfires.find(b => b.id === microsub.bonfire_id);
    return bonfire ? bonfire.name : truncateAddress(microsub.bonfire_id, 6);
  }, [microsub.bonfire_id, bonfires]);

  // Get status badge
  const getStatusBadge = (): React.ReactElement => {
    if (microsub.is_expired === true) {
      return <span className="badge badge-error badge-sm">Expired</span>;
    }
    if (microsub.is_exhausted === true) {
      return <span className="badge badge-warning badge-sm">Exhausted</span>;
    }
    if (microsub.is_valid === true) {
      return <span className="badge badge-success badge-sm">Active</span>;
    }
    return <span className="badge badge-ghost badge-sm">Unknown</span>;
  };

  // Fetch preview entities with abort signal
  const fetchPreview = useCallback(
    async (signal: AbortSignal) => {
      if (!microsub.description || !microsub.bonfire_id) return;

      setLoading(true);
      setError(null);
      setIsFetching(true);

      try {
        const response = await fetch(`/api/bonfires/${microsub.bonfire_id}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: microsub.description,
            num_results: 5,
          }),
          signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch preview: ${response.statusText}`);
        }

        const data: DelveResponse = await response.json();

        // Transform entities to preview format
        const entities: PreviewEntity[] = (data.entities || []).map(entity => ({
          uuid: entity.uuid || entity.id || "",
          name: entity.name || "Unnamed",
          summary: entity.summary || entity.description || "",
          entity_type: entity.entity_type || entity.type || "",
        }));

        // Only update state if not aborted
        if (!signal.aborted) {
          setPreviewEntities(entities);
          setHasEverFetched(true);
        }
      } catch (err) {
        // Don't update state if request was aborted
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (!signal.aborted) {
          const errorMsg = err instanceof Error ? err.message : "Failed to fetch preview";
          setError(errorMsg);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setIsFetching(false);
        }
      }
    },
    [microsub.description, microsub.bonfire_id],
  );

  // Lazy-load preview when expanded for the first time
  useEffect(() => {
    // Only fetch if expanded and never fetched before (caching)
    if (isExpanded && !hasEverFetched && !isFetching) {
      // Abort any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();
      fetchPreview(abortControllerRef.current.signal);
    }

    // Cleanup: abort fetch on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isExpanded, hasEverFetched, isFetching, fetchPreview]);

  const handleRefresh = () => {
    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for manual refresh
    abortControllerRef.current = new AbortController();
    fetchPreview(abortControllerRef.current.signal);
  };

  const toggleExpanded = () => {
    setIsExpanded(prev => !prev);
  };

  const toggleDescriptionExpanded = () => {
    setIsDescriptionExpanded(prev => !prev);
  };

  const descriptionText = microsub.description || "";
  const shouldTruncateDescription = descriptionText.length > 150;
  const displayDescription = isDescriptionExpanded ? descriptionText : truncateText(descriptionText, 150);

  return (
    <div className={`card-minimal group ${className}`}>
      <div className="card-body p-0">
        {/* Header Section */}
        <div className="flex flex-row items-start justify-between mb-4 gap-4">
          <div className="flex flex-row items-start gap-3">
            <span className="text-2xl mt-1">🗂️</span>
            <h3 className="card-title text-xl font-bold font-serif leading-tight">{getBonfireName()}</h3>
          </div>
          <div className="flex-shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Description Section */}
        <div className="mb-5">
          <p className="text-base text-base-content/80 mb-2 leading-relaxed">{displayDescription}</p>
          {shouldTruncateDescription && (
            <button
              onClick={toggleDescriptionExpanded}
              className="btn btn-ghost btn-xs text-primary hover:bg-transparent hover:underline p-0 h-auto min-h-0 font-normal"
            >
              {isDescriptionExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {/* Metadata Row */}
        <div className="flex flex-col gap-3 text-sm mb-6 border-t border-base-content/5 pt-4">
          <div className="flex flex-row items-center gap-3 text-base-content/70">
            <span>📊</span>
            <span className="font-medium">
              {microsub.queries_remaining} / {microsub.query_limit} queries
            </span>
          </div>
          <div className="flex flex-row items-center gap-3 text-base-content/70">
            <span>⏰</span>
            <span>Expires {formatTimestamp(microsub.expires_at)}</span>
          </div>
          {microsub.center_node_uuid && (
            <div className="flex flex-row items-center gap-3 text-base-content/70">
              <span>🎯</span>
              <span className="text-xs">Center: {truncateAddress(microsub.center_node_uuid, 6)}</span>
            </div>
          )}
          {microsub.system_prompt && (
            <div className="flex flex-row items-center gap-3">
              <span className="badge badge-secondary badge-outline badge-sm">Custom Prompt</span>
            </div>
          )}
        </div>

        {/* Preview Entities Section */}
        <div className="mb-6">
          <button
            onClick={toggleExpanded}
            className="btn btn-sm btn-ghost w-full justify-between bg-base-200/50 hover:bg-base-200 font-normal normal-case border-none"
          >
            <span>
              {isExpanded ? "Hide Preview" : "Show Preview"} ({previewEntities.length} entities)
            </span>
            <span>{isExpanded ? "▲" : "▼"}</span>
          </button>

          {isExpanded && (
            <div className="mt-4 space-y-3">
              {loading && (
                <div className="flex justify-center items-center py-4">
                  <span className="loading loading-spinner loading-sm text-primary"></span>
                  <span className="ml-2 text-sm text-base-content/60">Loading preview...</span>
                </div>
              )}

              {error && !loading && (
                <div className="alert alert-error shadow-sm text-sm py-2">
                  <span>Preview unavailable</span>
                  <button onClick={handleRefresh} className="btn btn-xs btn-ghost">
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && previewEntities.length === 0 && (
                <div className="alert alert-info shadow-sm text-sm py-2 bg-base-200 border-none text-base-content/70">
                  <span>No entities found for this description</span>
                </div>
              )}

              {!loading && !error && previewEntities.length > 0 && (
                <div className="space-y-3">
                  {previewEntities.map((entity, idx) => (
                    <div
                      key={entity.uuid || idx}
                      className="bg-base-100 border border-base-content/5 rounded-lg p-4 hover:border-base-content/10 transition-colors"
                    >
                      <div className="flex flex-row items-start gap-3">
                        {entity.entity_type && (
                          <span className="badge badge-primary badge-outline badge-sm mt-0.5 shrink-0">
                            {entity.entity_type}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm mb-1 text-base-content/90">{entity.name}</p>
                          {entity.summary && (
                            <p className="text-xs text-base-content/60 leading-relaxed">
                              {truncateText(entity.summary, 80)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-center text-base-content/40 mt-2">View more in graph</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Actions */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <button
            onClick={handleRefresh}
            className="btn btn-sm btn-ghost text-base-content/60 hover:bg-base-200"
            disabled={loading || isFetching}
            title="Refresh Data"
          >
            {loading || isFetching ? <span className="loading loading-spinner loading-xs"></span> : "🔄 Refresh"}
          </button>
          <button
            className="btn btn-primary btn-sm px-6 shadow-sm hover:shadow-md transition-all duration-200"
            onClick={() => router.push(`/x402-chat?agent=${microsub.agent_id}`)}
          >
            Use Data Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataRoomCard;
