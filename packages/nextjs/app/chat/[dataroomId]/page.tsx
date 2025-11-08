"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PaidChatInterface } from "@/components/PaidChatInterface";
import type { DataRoomInfo, MicrosubInfo } from "@/lib/types/delve-api";
import { formatTimestamp, truncateAddress, truncateText } from "@/lib/utils";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export default function DataRoomSubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [dataRoom, setDataRoom] = useState<DataRoomInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [microsubs, setMicrosubs] = useState<MicrosubInfo[]>([]);

  // Fetch microsubs for the connected wallet
  const fetchMicrosubs = useCallback(async () => {
    if (!address) {
      setMicrosubs([]);
      return;
    }

    try {
      const response = await fetch(`/api/microsubs?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setMicrosubs(data.microsubs || []);
      }
    } catch (err) {
      console.error("Error fetching microsubs:", err);
    }
  }, [address]);

  // Fetch microsubs when address changes
  useEffect(() => {
    fetchMicrosubs();
  }, [fetchMicrosubs]);

  // Fetch DataRoom on mount
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchDataRoom = async () => {
      if (!params.dataroomId) {
        if (isMounted) {
          setError("No DataRoom ID provided");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/datarooms/${params.dataroomId}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            if (isMounted) setError("DataRoom not found");
          } else if (response.status === 503) {
            if (isMounted) setError("Service temporarily unavailable. Please try again.");
          } else {
            const errorData = await response.json();
            if (isMounted) setError(errorData.error || "Failed to fetch DataRoom");
          }
          if (isMounted) setLoading(false);
          return;
        }

        const data: DataRoomInfo = await response.json();
        if (isMounted) setDataRoom(data);
      } catch (err: any) {
        if (err.name === "AbortError") {
          return; // Fetch was aborted, don't update state
        }
        console.error("Error fetching DataRoom:", err);
        if (isMounted) setError(err.message || "Failed to fetch DataRoom");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDataRoom();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [params.dataroomId]);

  // Find active subscription for this DataRoom
  const activeSubscription = useMemo(() => {
    if (!microsubs || !params.dataroomId) {
      return null;
    }

    // Filter microsubs by dataroom_id and validity
    const validSubscriptions = microsubs.filter(
      (microsub: MicrosubInfo) =>
        (microsub as any).dataroom_id === params.dataroomId &&
        !microsub.is_expired &&
        !microsub.is_exhausted &&
        microsub.is_valid !== false,
    );

    return validSubscriptions.length > 0 ? validSubscriptions[0] : null;
  }, [microsubs, params.dataroomId]);

  // Callback when a new subscription is created in the child component
  const handleSubscriptionCreated = useCallback(async () => {
    // Refetch microsubs to get the new subscription
    await fetchMicrosubs();
  }, [fetchMicrosubs]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col gap-4">
          <div className="skeleton h-8 w-64"></div>
          <div className="skeleton h-32 w-full"></div>
          <div className="skeleton h-64 w-full"></div>
        </div>
        <div className="text-center mt-4 text-base-content/60">Loading data room...</div>
      </div>
    );
  }

  // Error state
  if (error || !dataRoom) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="alert alert-error mb-4">
          <span>{error || "DataRoom not found"}</span>
        </div>
        <button className="btn btn-primary" onClick={() => router.push("/data-rooms")}>
          Back to Marketplace
        </button>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumb */}
        <div className="text-sm breadcrumbs mb-4">
          <ul>
            <li>
              <a onClick={() => router.push("/data-rooms")} className="cursor-pointer">
                Data Rooms
              </a>
            </li>
            <li>{truncateText(dataRoom.description, 40)}</li>
          </ul>
        </div>

        {/* DataRoom Details Card */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-2">{truncateText(dataRoom.description, 100)}</h2>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="badge badge-info">
                by {dataRoom.creator_name || dataRoom.creator_username || truncateAddress(dataRoom.creator_id, 6)}
              </span>
              <span className="badge badge-ghost">
                {dataRoom.bonfire_name || truncateAddress(dataRoom.bonfire_id, 6)}
              </span>
              {dataRoom.is_active ? (
                <span className="badge badge-success">Active</span>
              ) : (
                <span className="badge badge-ghost">Inactive</span>
              )}
            </div>

            {/* Pricing Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title">Price</div>
                <div className="stat-value text-2xl">${dataRoom.price_usd.toFixed(2)}</div>
                <div className="stat-desc">USD</div>
              </div>
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title">Query Limit</div>
                <div className="stat-value text-2xl">{dataRoom.query_limit}</div>
                <div className="stat-desc">queries</div>
              </div>
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title">Expiration</div>
                <div className="stat-value text-2xl">{dataRoom.expiration_days}</div>
                <div className="stat-desc">days access</div>
              </div>
            </div>

            {/* Configuration Indicators */}
            <div className="flex flex-wrap gap-2 mb-4">
              {dataRoom.center_node_uuid && <span className="badge badge-secondary">🎯 Focused Search</span>}
              {dataRoom.system_prompt && <span className="badge badge-accent">🤖 Custom AI Prompt</span>}
            </div>

            {/* Created Date */}
            <div className="text-xs opacity-70">Created {formatTimestamp(dataRoom.created_at)}</div>
          </div>
        </div>

        {/* Connect Wallet Prompt */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body items-center text-center">
            <h3 className="card-title mb-2">Connect Your Wallet</h3>
            <p className="mb-4 opacity-80">Connect your wallet to subscribe to this data room</p>
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  // Inactive DataRoom warning
  if (!dataRoom.is_active && !activeSubscription) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumb */}
        <div className="text-sm breadcrumbs mb-4">
          <ul>
            <li>
              <a onClick={() => router.push("/data-rooms")} className="cursor-pointer">
                Data Rooms
              </a>
            </li>
            <li>{truncateText(dataRoom.description, 40)}</li>
          </ul>
        </div>

        <div className="alert alert-warning mb-4">
          <span>This data room is no longer active and cannot accept new subscriptions.</span>
        </div>

        <button className="btn btn-primary" onClick={() => router.push("/data-rooms")}>
          Back to Marketplace
        </button>
      </div>
    );
  }

  // Main page content
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="text-sm breadcrumbs mb-4">
        <ul>
          <li>
            <a onClick={() => router.push("/data-rooms")} className="cursor-pointer">
              Data Rooms
            </a>
          </li>
          <li>{truncateText(dataRoom.description, 40)}</li>
        </ul>
      </div>

      {/* DataRoom Details Card */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-2">{truncateText(dataRoom.description, 100)}</h2>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="badge badge-info">
              by {dataRoom.creator_name || dataRoom.creator_username || truncateAddress(dataRoom.creator_id, 6)}
            </span>
            <span className="badge badge-ghost">
              {dataRoom.bonfire_name || truncateAddress(dataRoom.bonfire_id, 6)}
            </span>
            {dataRoom.is_active ? (
              <span className="badge badge-success">Active</span>
            ) : (
              <span className="badge badge-ghost">Inactive</span>
            )}
          </div>

          {/* Pricing Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="stat bg-base-200 rounded-lg p-4">
              <div className="stat-title">Price</div>
              <div className="stat-value text-2xl">${dataRoom.price_usd.toFixed(2)}</div>
              <div className="stat-desc">USD</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-4">
              <div className="stat-title">Query Limit</div>
              <div className="stat-value text-2xl">{dataRoom.query_limit}</div>
              <div className="stat-desc">queries</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-4">
              <div className="stat-title">Expiration</div>
              <div className="stat-value text-2xl">{dataRoom.expiration_days}</div>
              <div className="stat-desc">days access</div>
            </div>
          </div>

          {/* Configuration Indicators */}
          <div className="flex flex-wrap gap-2 mb-4">
            {dataRoom.center_node_uuid && <span className="badge badge-secondary">🎯 Focused Search</span>}
            {dataRoom.system_prompt && <span className="badge badge-accent">🤖 Custom AI Prompt</span>}
          </div>

          {/* Created Date */}
          <div className="text-xs opacity-70">Created {formatTimestamp(dataRoom.created_at)}</div>
        </div>
      </div>

      {/* Subscription Status & Chat Interface */}
      {activeSubscription ? (
        // Case: User has active subscription
        <div>
          <div className="card bg-success/10 border border-success mb-6">
            <div className="card-body">
              <h3 className="card-title text-success">
                <span className="text-2xl">✅</span> Active Subscription
              </h3>
              <div className="flex flex-col gap-2 mt-2">
                <div className="text-sm">
                  <span className="font-semibold">Queries Remaining:</span> {activeSubscription.queries_remaining}/
                  {activeSubscription.query_limit}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Expires:</span> {formatTimestamp(activeSubscription.expires_at)}
                </div>
                <div className="text-xs opacity-70">
                  <span className="font-semibold">Transaction:</span> {truncateAddress(activeSubscription.tx_hash, 8)}
                </div>
              </div>
            </div>
          </div>

          {/* Render Chat Interface */}
          <PaidChatInterface
            agentId={dataRoom.agent_id || dataRoom.bonfire_id}
            selectedMicrosubTxHash={activeSubscription.tx_hash}
            onSubscriptionCreated={handleSubscriptionCreated}
          />
        </div>
      ) : (
        // Case: User has no active subscription
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title mb-2">Subscribe to Data Room</h3>
            <p className="opacity-80 mb-4">
              To access this data room, you&apos;ll need to create a subscription. You&apos;ll be prompted to sign a
              payment when you send your first message. The subscription will be created automatically.
            </p>

            {/* Pricing Summary */}
            <div className="bg-base-200 rounded-lg p-4 mb-4">
              <div className="text-sm font-semibold mb-2">Subscription Details:</div>
              <ul className="list-disc list-inside text-sm space-y-1 opacity-80">
                <li>Price: ${dataRoom.price_usd.toFixed(2)} USD</li>
                <li>Queries: {dataRoom.query_limit} queries included</li>
                <li>Duration: {dataRoom.expiration_days} days access</li>
              </ul>
            </div>

            {/* Explanation */}
            <div className="alert alert-info">
              <div className="flex-1">
                <div className="text-sm font-semibold mb-1">How it works:</div>
                <div className="text-xs opacity-80">
                  1. Type your first message below
                  <br />
                  2. You&apos;ll be prompted to sign a payment transaction
                  <br />
                  3. Your subscription will be created automatically
                  <br />
                  4. Start chatting with the AI agent!
                </div>
              </div>
            </div>

            {/* Start Chat Button & Interface */}
            <div className="mt-4">
              <PaidChatInterface
                agentId={dataRoom.agent_id || dataRoom.bonfire_id}
                dataroomId={params.dataroomId as string}
                onSubscriptionCreated={handleSubscriptionCreated}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
