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
    <div className={`card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow ${className}`}>
      <div className="card-body">
        {/* Header Section */}
        <div className="flex flex-row items-center justify-between mb-3">
          <div className="flex flex-row items-center gap-2">
            <span className="text-2xl">🗂️</span>
            <h3 className="card-title text-lg">{getBonfireName()}</h3>
          </div>
          {getStatusBadge()}
        </div>

        {/* Description Section */}
        <div className="mb-4">
          <p className="text-sm text-base-content/80 mb-1">{displayDescription}</p>
          {shouldTruncateDescription && (
            <button onClick={toggleDescriptionExpanded} className="btn btn-ghost btn-xs text-primary">
              {isDescriptionExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {/* Metadata Row */}
        <div className="flex flex-col gap-2 text-sm mb-4">
          <div className="flex flex-row items-center gap-2">
            <span>📊</span>
            <span>
              {microsub.queries_remaining} / {microsub.query_limit} queries
            </span>
          </div>
          <div className="flex flex-row items-center gap-2">
            <span>⏰</span>
            <span>Expires {formatTimestamp(microsub.expires_at)}</span>
          </div>
          {microsub.center_node_uuid && (
            <div className="flex flex-row items-center gap-2">
              <span>🎯</span>
              <span className="text-xs">Center: {truncateAddress(microsub.center_node_uuid, 6)}</span>
            </div>
          )}
          {microsub.system_prompt && (
            <div className="flex flex-row items-center gap-2">
              <span className="badge badge-secondary badge-sm">Custom Prompt</span>
            </div>
          )}
        </div>

        {/* Preview Entities Section */}
        <div className="mb-4">
          <button onClick={toggleExpanded} className="btn btn-sm btn-ghost w-full justify-between">
            <span>
              {isExpanded ? "Hide Preview" : "Show Preview"} ({previewEntities.length} entities)
            </span>
            <span>{isExpanded ? "▲" : "▼"}</span>
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-2">
              {loading && (
                <div className="flex justify-center items-center py-4">
                  <span className="loading loading-spinner loading-sm"></span>
                  <span className="ml-2 text-sm">Loading preview...</span>
                </div>
              )}

              {error && !loading && (
                <div className="alert alert-error shadow-sm">
                  <span className="text-sm">Preview unavailable</span>
                  <button onClick={handleRefresh} className="btn btn-xs btn-ghost">
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && previewEntities.length === 0 && (
                <div className="alert alert-info shadow-sm">
                  <span className="text-sm">No entities found for this description</span>
                </div>
              )}

              {!loading && !error && previewEntities.length > 0 && (
                <div className="space-y-2">
                  {previewEntities.map((entity, idx) => (
                    <div key={entity.uuid || idx} className="card bg-base-200 shadow-sm">
                      <div className="card-body p-3">
                        <div className="flex flex-row items-start gap-2">
                          {entity.entity_type && (
                            <span className="badge badge-primary badge-sm">{entity.entity_type}</span>
                          )}
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{entity.name}</p>
                            {entity.summary && (
                              <p className="text-xs opacity-70 mt-1">{truncateText(entity.summary, 80)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-center opacity-50 mt-2">View more in graph</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Actions */}
        <div className="card-actions justify-end gap-2">
          <button onClick={handleRefresh} className="btn btn-sm btn-ghost" disabled={loading || isFetching}>
            {loading || isFetching ? <span className="loading loading-spinner loading-xs"></span> : "🔄 Refresh"}
          </button>
          <button
            className="btn btn-primary btn-sm"
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
