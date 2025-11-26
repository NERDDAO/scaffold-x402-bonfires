"use client";

import React, { useEffect, useState } from "react";
import { DataRoomMarketplaceCard } from "@/components/DataRoomMarketplaceCard";
import { DataRoomWizard } from "@/components/DataRoomWizard";
import type { CreateDataRoomRequest, DataRoomConfig, DataRoomInfo, DataRoomListResponse } from "@/lib/types/delve-api";
import { notification } from "@/utils/scaffold-eth/notification";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export default function DataRoomsPage() {
  const { address, isConnected } = useAccount();

  // State management
  const [dataRooms, setDataRooms] = useState<DataRoomInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Fetch data rooms from marketplace
  const fetchDataRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/datarooms?limit=50&offset=0");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data: DataRoomListResponse = await response.json();
      setDataRooms(data.datarooms);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch data rooms";
      setError(errorMessage);
      console.error("Error fetching data rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount (regardless of wallet connection)
  useEffect(() => {
    fetchDataRooms();
  }, []);

  // Wizard handlers
  const handleOpenWizard = () => {
    if (!isConnected) {
      notification.error("Please connect your wallet to create a data room");
      return;
    }
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
  };

  const handleWizardComplete = async (config: DataRoomConfig) => {
    if (!address) {
      notification.error("Please connect your wallet");
      return;
    }

    setIsCreating(true);
    try {
      // Build request with creator_wallet from connected wallet
      const requestBody: CreateDataRoomRequest = {
        creator_wallet: address,
        bonfire_id: config.bonfireId,
        description: config.description,
        system_prompt: config.systemPrompt || "", // Backend requires system_prompt even if empty
        center_node_uuid: config.centerNodeUuid,
        price_usd: config.priceUsd,
        query_limit: config.queryLimit,
        expiration_days: config.expirationDays,
      };

      const response = await fetch("/api/datarooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const createdDataRoom: DataRoomInfo = await response.json();
      notification.success(`Data room created successfully! ID: ${createdDataRoom.id}`);

      // Refetch data rooms
      await fetchDataRooms();

      // Close wizard
      setIsWizardOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create data room";
      notification.error(errorMessage);
      console.error("Error creating data room:", err);
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">Data Room Marketplace</h1>
            <p className="text-base-content/70">
              Browse and subscribe to data rooms created by the community. Each data room provides configured access to
              knowledge graphs with AI-powered search.
            </p>
          </div>
          <button className="btn btn-primary btn-sm gap-2" onClick={handleOpenWizard} disabled={isCreating}>
            {isCreating ? <span className="loading loading-spinner loading-xs"></span> : "➕"}
            Create Data Room
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-64 w-full"></div>
          ))}
        </div>

        <DataRoomWizard isOpen={isWizardOpen} onClose={handleCloseWizard} onComplete={handleWizardComplete} />
      </div>
    );
  }

  // Error state
  if (error && !loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">Data Room Marketplace</h1>
            <p className="text-base-content/70">
              Browse and subscribe to data rooms created by the community. Each data room provides configured access to
              knowledge graphs with AI-powered search.
            </p>
          </div>
          <button className="btn btn-primary btn-sm gap-2" onClick={handleOpenWizard} disabled={isCreating}>
            {isCreating ? <span className="loading loading-spinner loading-xs"></span> : "➕"}
            Create Data Room
          </button>
        </div>

        <div className="alert alert-error shadow-lg">
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
            <h3 className="font-bold">Error loading data rooms</h3>
            <div className="text-sm">{error}</div>
          </div>
          <button onClick={fetchDataRooms} className="btn btn-sm btn-ghost">
            Retry
          </button>
        </div>

        <DataRoomWizard isOpen={isWizardOpen} onClose={handleCloseWizard} onComplete={handleWizardComplete} />
      </div>
    );
  }

  // Empty state
  if (dataRooms.length === 0 && !loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">Data Room Marketplace</h1>
            <p className="text-base-content/70">
              Browse and subscribe to data rooms created by the community. Each data room provides configured access to
              knowledge graphs with AI-powered search.
            </p>
          </div>
          <button className="btn btn-primary btn-sm gap-2" onClick={handleOpenWizard} disabled={isCreating}>
            {isCreating ? <span className="loading loading-spinner loading-xs"></span> : "➕"}
            Create Data Room
          </button>
        </div>

        <div className="alert alert-info shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <div>
            <h3 className="font-bold">No data rooms available</h3>
            <div className="text-sm">No data rooms available in the marketplace yet. Be the first to create one!</div>
          </div>
        </div>

        <DataRoomWizard isOpen={isWizardOpen} onClose={handleCloseWizard} onComplete={handleWizardComplete} />
      </div>
    );
  }

  // Data rooms grid
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">Data Room Marketplace</h1>
            <p className="text-base-content/70">
              Browse and subscribe to data rooms created by the community. Each data room provides configured access to
              knowledge graphs with AI-powered search.
            </p>
            <div className="mt-2 text-sm opacity-70">
              Found {dataRooms.length} data room{dataRooms.length !== 1 ? "s" : ""}
            </div>
            {!isConnected && (
              <div className="alert alert-info mt-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <div>
                  <h3 className="font-bold">Connect your wallet</h3>
                  <div className="text-sm">Connect your wallet to create data rooms and subscribe to listings.</div>
                </div>
                <div>
                  <ConnectButton />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={fetchDataRooms} className="btn btn-ghost btn-sm gap-2" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-xs"></span> : "🔄"}
              Refresh
            </button>
            <button className="btn btn-primary btn-sm gap-2" onClick={handleOpenWizard} disabled={isCreating}>
              {isCreating ? <span className="loading loading-spinner loading-xs"></span> : "➕"}
              Create Data Room
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dataRooms.map(dataroom => (
          <DataRoomMarketplaceCard key={dataroom.id} dataroom={dataroom} onHyperBlogCreated={() => fetchDataRooms()} />
        ))}
      </div>

      <DataRoomWizard isOpen={isWizardOpen} onClose={handleCloseWizard} onComplete={handleWizardComplete} />
    </div>
  );
}
