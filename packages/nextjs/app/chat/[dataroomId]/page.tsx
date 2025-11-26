"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PaidChatInterface } from "@/components/PaidChatInterface";
import { useAgentSelection } from "@/hooks/useAgentSelection";
import { usePaymentHeader } from "@/hooks/usePaymentHeader";
import type { DataRoomInfo, MicrosubInfo } from "@/lib/types/delve-api";
import { formatTimestamp, truncateAddress, truncateText } from "@/lib/utils";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { notification } from "~~/utils/scaffold-eth/notification";

export default function DataRoomSubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [dataRoom, setDataRoom] = useState<DataRoomInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [microsubs, setMicrosubs] = useState<MicrosubInfo[]>([]);
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [newTxHash, setNewTxHash] = useState<string | null>(null);
  const { buildAndSignPaymentHeader, isLoading: isSigningPayment } = usePaymentHeader();

  // Comment 1: Initialize useAgentSelection with both bonfire and agent IDs
  const agentSelection = useAgentSelection({
    initialBonfireId: dataRoom?.bonfire_id || null,
    initialAgentId: dataRoom?.agent_id || null,
  });

  // Fetch microsubs for the connected wallet
  const fetchMicrosubs = useCallback(async () => {
    if (!address) {
      setMicrosubs([]);
      return;
    }

    try {
      // Comment 4: Use wallet_address query param instead of address
      const response = await fetch(`/api/microsubs?wallet_address=${address}`);
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

  // Find active subscription for this DataRoom (moved before useEffect that depends on it)
  const activeSubscription = useMemo(() => {
    if (!microsubs || !params.dataroomId) {
      return null;
    }

    // Comment 5: Type-safe access to dataroom_id with proper check
    const validSubscriptions = microsubs.filter((microsub: MicrosubInfo) => {
      // Check if microsub has dataroom_id and matches
      const microsubDataroomId = microsub.dataroom_id;
      if (!microsubDataroomId || String(microsubDataroomId) !== String(params.dataroomId)) {
        return false;
      }

      // Check validity
      return (
        !microsub.is_expired &&
        !microsub.is_exhausted &&
        microsub.is_valid !== false &&
        (microsub.queries_remaining || 0) > 0
      );
    });

    return validSubscriptions.length > 0 ? validSubscriptions[0] : null;
  }, [microsubs, params.dataroomId]);

  // Comment 3: Restore selection from localStorage on mount
  useEffect(() => {
    if (!activeSubscription && !newTxHash) {
      const storedTxHash = localStorage.getItem("selectedMicrosubTxHash");
      if (storedTxHash) {
        setNewTxHash(storedTxHash);
      }
    }
  }, [activeSubscription, newTxHash]);

  // Comment 1: After dataRoom loads, select bonfire and agent
  useEffect(() => {
    if (!dataRoom || !agentSelection.isInitialized) return;

    // Select bonfire if not already selected
    if (dataRoom.bonfire_id && agentSelection.selectedBonfireId !== dataRoom.bonfire_id) {
      agentSelection.selectBonfire(dataRoom.bonfire_id);
    }

    // If dataRoom has agent_id, select it
    if (dataRoom.agent_id && agentSelection.selectedAgentId !== dataRoom.agent_id) {
      agentSelection.selectAgent(dataRoom.agent_id);
    }
    // If no agent_id but agents are loaded, select first active agent
    else if (!dataRoom.agent_id && agentSelection.availableAgents.length > 0 && !agentSelection.selectedAgentId) {
      const firstActive = agentSelection.availableAgents.find(a => a.is_active);
      if (firstActive) {
        agentSelection.selectAgent(firstActive.id);
      } else if (agentSelection.availableAgents.length > 0) {
        agentSelection.selectAgent(agentSelection.availableAgents[0].id);
      }
    }
  }, [
    dataRoom,
    agentSelection.isInitialized,
    agentSelection.selectedBonfireId,
    agentSelection.selectedAgentId,
    agentSelection.availableAgents,
    agentSelection.selectBonfire,
    agentSelection.selectAgent,
  ]);

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

  // Callback when a new subscription is created in the child component
  const handleSubscriptionCreated = useCallback(async () => {
    // Refetch microsubs to get the new subscription
    await fetchMicrosubs();
  }, [fetchMicrosubs]);

  // Handler for explicit subscription button
  const handleSubscribe = useCallback(async () => {
    setSubscriptionError(null);
    setIsSubscribing(true);

    try {
      // Validate wallet is connected
      if (!isConnected || !address) {
        throw new Error("Wallet not connected");
      }

      // Validate dataRoom exists and is active
      if (!dataRoom) {
        throw new Error("DataRoom not found");
      }

      if (!dataRoom.is_active) {
        throw new Error("This DataRoom is no longer active");
      }

      // Use the actual dataroom price in decimal USD format
      const priceDecimal = dataRoom.price_usd.toFixed(2);

      // Build and sign payment header with the correct amount
      const paymentHeader = await buildAndSignPaymentHeader(priceDecimal);

      // User cancelled signing
      if (!paymentHeader) {
        setSubscriptionError("Payment signing cancelled");
        notification.error("Payment signing cancelled");
        return;
      }

      // Comment 2: Build request body with dataRoom.agent_id (or omit if backend infers from dataroom_id)
      const requestBody: any = {
        payment_header: paymentHeader,
        dataroom_id: params.dataroomId,
        expected_amount: priceDecimal,
      };

      // Include agent_id if available from dataRoom
      if (dataRoom.agent_id) {
        requestBody.agent_id = dataRoom.agent_id;
      }

      // POST to /api/microsubs
      const response = await fetch("/api/microsubs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Handle error response
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to create subscription";

        // Map status codes to user-friendly messages
        if (response.status === 402) {
          throw new Error("Payment verification failed. Please try again.");
        } else if (response.status === 404) {
          throw new Error("DataRoom not found or no longer available");
        } else if (response.status === 409) {
          throw new Error("This DataRoom is no longer active");
        } else if (response.status === 503) {
          throw new Error("Request timeout. Please try again.");
        } else {
          throw new Error(errorMessage);
        }
      }

      // Parse successful response
      const responseData: MicrosubInfo = await response.json();

      // Comment 3: Persist tx_hash to localStorage and state for pre-selection
      if (responseData.tx_hash) {
        localStorage.setItem("selectedMicrosubTxHash", responseData.tx_hash);
        setNewTxHash(responseData.tx_hash);
      }

      // Show success notification
      notification.success("Subscription created! You can now start chatting.");

      // Refetch microsubs to update the activeSubscription
      await fetchMicrosubs();

      // Comment 6: Navigate/refresh to ensure chat loads with new microsub selected
      router.refresh();
    } catch (err: any) {
      console.error("Error creating subscription:", err);

      // Extract user-friendly error message
      let errorMessage = "Failed to create subscription. Please try again.";

      if (err.message) {
        errorMessage = err.message;
      } else if (err.name === "TimeoutError") {
        errorMessage = "Request timeout. Please try again.";
      } else if (err.message && err.message.includes("fetch")) {
        errorMessage = "Network error. Please check your connection.";
      }

      setSubscriptionError(errorMessage);
      notification.error(errorMessage);
    } finally {
      setIsSubscribing(false);
    }
  }, [isConnected, address, dataRoom, buildAndSignPaymentHeader, params.dataroomId, fetchMicrosubs]);

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
                by{" "}
                {dataRoom.creator_name ||
                  dataRoom.creator_username ||
                  (dataRoom.creator_wallet ? truncateAddress(dataRoom.creator_wallet, 6) : "Anonymous")}
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

  // Comment 4: Determine the agent ID to use (never fall back to bonfire_id)
  const chatAgentId = agentSelection.selectedAgent?.id || dataRoom?.agent_id;

  // Comment 4: Check if we can render chat (need a valid agent)
  const canRenderChat = !!chatAgentId && agentSelection.isInitialized;
  const isLoadingAgent = !agentSelection.isInitialized || agentSelection.loading.agents;

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
              by{" "}
              {dataRoom.creator_name ||
                dataRoom.creator_username ||
                (dataRoom.creator_wallet ? truncateAddress(dataRoom.creator_wallet, 6) : "Anonymous")}
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

      {/* Active Subscription Badge (if exists) */}
      {activeSubscription && (
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
      )}

      {/* Subscribe Button (if no active subscription) */}
      {!activeSubscription && (
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h3 className="card-title mb-2">Subscribe to Data Room</h3>
            <p className="opacity-80 mb-4">
              Click the Subscribe button below, or start chatting to create your subscription automatically.
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

            {/* Error Display */}
            {subscriptionError && (
              <div className="alert alert-error mb-4">
                <span>{subscriptionError}</span>
              </div>
            )}

            {/* Subscribe Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                className="btn btn-primary btn-lg w-full max-w-md"
                onClick={handleSubscribe}
                disabled={isSubscribing || isSigningPayment || !dataRoom.is_active}
              >
                {isSubscribing || isSigningPayment ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    {isSigningPayment ? "Signing Payment..." : "Subscribing..."}
                  </>
                ) : (
                  "Subscribe Now"
                )}
              </button>
              <p className="text-xs opacity-60 text-center">
                You&apos;ll be prompted to sign a payment transaction in your wallet
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comment 4: Show error if no agent available */}
      {!isLoadingAgent && !canRenderChat && (
        <div className="alert alert-warning">
          <span>No agent configured for this DataRoom. Please contact the creator.</span>
        </div>
      )}

      {/* Comment 2: Render Chat Interface in both cases (with or without subscription) */}
      {canRenderChat && (
        <PaidChatInterface
          agentId={chatAgentId}
          dataroomId={!activeSubscription ? String(params.dataroomId) : undefined}
          dataroomDescription={dataRoom.description}
          dataroomCenterNodeUuid={dataRoom.center_node_uuid}
          initialGraphMode="dynamic"
          selectedMicrosubTxHash={newTxHash || activeSubscription?.tx_hash}
          onSubscriptionCreated={handleSubscriptionCreated}
        />
      )}
    </div>
  );
}
