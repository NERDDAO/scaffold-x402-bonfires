"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HyperBlogCreator } from "@/components/HyperBlogCreator";
import { HyperBlogFeed } from "@/components/HyperBlogFeed";
import type { DataRoomInfo } from "@/lib/types/delve-api";
import { notification } from "@/utils/scaffold-eth/notification";

export default function DataRoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dataroomId = params.dataroomId as string;

  // State
  const [dataroom, setDataroom] = useState<DataRoomInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState<boolean>(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState<number>(0);

  // Fetch dataroom details
  const fetchDataroom = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/datarooms/${dataroomId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data: DataRoomInfo = await response.json();
      setDataroom(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch dataroom";
      setError(errorMessage);
      console.error("Error fetching dataroom:", err);
    } finally {
      setIsLoading(false);
    }
  }, [dataroomId]);

  useEffect(() => {
    if (dataroomId) {
      fetchDataroom();
    }
  }, [dataroomId, fetchDataroom]);

  // Handlers
  const handleBack = () => {
    router.push("/data-rooms");
  };

  const handleOpenCreator = () => {
    setIsCreatorOpen(true);
  };

  const handleCloseCreator = () => {
    setIsCreatorOpen(false);
  };

  const handleCreatorSuccess = (hyperblogId: string) => {
    notification.success(`Blog created successfully! ID: ${hyperblogId}`);
    setIsCreatorOpen(false);
    // Increment key to force feed refresh
    setFeedRefreshKey(prev => prev + 1);
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="skeleton h-8 w-48 mb-4"></div>
          <div className="skeleton h-32 w-full mb-6"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-32 w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error && !dataroom) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="alert alert-error shadow-lg mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="font-bold">Error loading dataroom</h3>
            <div className="text-sm">{error}</div>
          </div>
          <button onClick={fetchDataroom} className="btn btn-sm btn-ghost">
            Retry
          </button>
        </div>
        <button onClick={handleBack} className="btn btn-ghost">
          ← Back to Marketplace
        </button>
      </div>
    );
  }

  // Main Content
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Back Button */}
      <button onClick={handleBack} className="btn btn-ghost btn-sm mb-6">
        ← Back to Marketplace
      </button>

      {/* Dataroom Header Card */}
      {dataroom && (
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  {dataroom.bonfire_name || `DataRoom ${dataroomId.substring(0, 8)}...`}
                </h1>
                <div className="flex items-center gap-2 mb-2">
                  {dataroom.is_active ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge badge-ghost">Inactive</span>
                  )}
                  {dataroom.creator_name && <span className="badge badge-info">by {dataroom.creator_name}</span>}
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleOpenCreator} disabled={!dataroom.is_active}>
                📝 Create Blog
              </button>
            </div>

            {/* Description */}
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-base opacity-80">{dataroom.description}</p>
            </div>

            {/* Pricing & Configuration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="stat bg-base-200 rounded-lg">
                <div className="stat-title">Price</div>
                <div className="stat-value text-2xl">
                  $
                  {dataroom.current_hyperblog_price_usd && parseFloat(dataroom.current_hyperblog_price_usd) > 0
                    ? dataroom.current_hyperblog_price_usd
                    : dataroom.price_usd.toFixed(2)}
                </div>
                <div className="stat-desc">{dataroom.dynamic_pricing_enabled ? "USD (dynamic)" : "USD per blog"}</div>
              </div>
              <div className="stat bg-base-200 rounded-lg">
                <div className="stat-title">Query Limit</div>
                <div className="stat-value text-2xl">{dataroom.query_limit}</div>
                <div className="stat-desc">queries per subscription</div>
              </div>
              <div className="stat bg-base-200 rounded-lg">
                <div className="stat-title">Expiration</div>
                <div className="stat-value text-2xl">{dataroom.expiration_days}</div>
                <div className="stat-desc">days</div>
              </div>
              <div className="stat bg-base-200 rounded-lg">
                <div className="stat-title">Features</div>
                <div className="stat-value text-xl">
                  {dataroom.center_node_uuid ? "🎯" : ""}
                  {dataroom.system_prompt ? "🤖" : ""}
                </div>
                <div className="stat-desc">
                  {dataroom.center_node_uuid && "Focused Search "}
                  {dataroom.system_prompt && "Custom AI"}
                </div>
              </div>
            </div>

            {/* Dynamic Pricing Info */}
            {dataroom.dynamic_pricing_enabled && (
              <div className="alert alert-info mb-4">
                <span>💡 Dynamic Pricing Active</span>
                <div className="text-sm">
                  {dataroom.total_purchases === 0 ? (
                    <p>
                      First blog has <strong>no protocol fee</strong>! Price increases with each purchase.
                    </p>
                  ) : (
                    <p>
                      Current price: <strong>${dataroom.current_hyperblog_price_usd}</strong> (updates with purchases)
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* System Prompt (if present) */}
            {dataroom.system_prompt && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">AI System Prompt</h3>
                <div className="bg-base-200 p-4 rounded-lg">
                  <p className="text-sm font-mono opacity-80">{dataroom.system_prompt}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HyperBlog Feed */}
      <div className="mb-8">
        <HyperBlogFeed key={feedRefreshKey} dataroomId={dataroomId} autoRefreshInterval={30000} />
      </div>

      {/* HyperBlog Creator Modal */}
      {dataroom && (
        <HyperBlogCreator
          dataroomId={dataroomId}
          dataroomDescription={dataroom.description}
          dataroomPrice={
            dataroom.current_hyperblog_price_usd && parseFloat(dataroom.current_hyperblog_price_usd) > 0
              ? parseFloat(dataroom.current_hyperblog_price_usd)
              : dataroom.price_usd
          }
          isOpen={isCreatorOpen}
          onClose={handleCloseCreator}
          onSuccess={handleCreatorSuccess}
        />
      )}
    </div>
  );
}
