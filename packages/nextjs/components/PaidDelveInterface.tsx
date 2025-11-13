"use client";

import { useEffect, useState } from "react";
import { DataRoomWizard } from "./DataRoomWizard";
import { MicrosubSelector } from "./MicrosubSelector";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { useAgentSelection } from "@/hooks/useAgentSelection";
import { useMicrosubSelection } from "@/hooks/useMicrosubSelection";
import { usePaymentHeader } from "@/hooks/usePaymentHeader";
import type { DataRoomConfig, DelveResponseWithPayment } from "@/lib/types/delve-api";
import { formatErrorMessage, isMicrosubError, truncateAddress, truncateText } from "@/lib/utils";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { notification } from "~~/utils/scaffold-eth/notification";

interface PaidDelveInterfaceProps {
  bonfireId: string;
  className?: string;
}

export function PaidDelveInterface({ bonfireId, className = "" }: PaidDelveInterfaceProps) {
  const { isConnected, address } = useAccount();
  const { buildAndSignPaymentHeader, isLoading: isSigningPayment } = usePaymentHeader();
  const microsubSelection = useMicrosubSelection({ walletAddress: address });
  const agentSelection = useAgentSelection();
  const [query, setQuery] = useState("");
  const [numResults, setNumResults] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DelveResponseWithPayment | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "results">("overview");
  const [isRetrying, setIsRetrying] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [pendingDataRoomConfig, setPendingDataRoomConfig] = useState<DataRoomConfig | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  // Auto-close sidebar on microsub selection (mobile)
  useEffect(() => {
    if (microsubSelection.selectedMicrosub) {
      closeSidebar();
    }
  }, [microsubSelection.selectedMicrosub]);

  const handleOpenWizard = () => setIsWizardOpen(true);
  const handleCloseWizard = () => setIsWizardOpen(false);
  const handleWizardComplete = (config: DataRoomConfig) => {
    setPendingDataRoomConfig(config);
    microsubSelection.clearSelection(); // Ensure "Use New Payment" is selected
    notification.success(`Data room configured: ${config.description.slice(0, 50)}...`);
  };

  // Core search function that performs the fetch
  const search = async (searchQuery: string, resultsCount: number, retrying: boolean) => {
    setError(null);
    setIsLoading(true);

    try {
      // Pre-request validation: check if selected microsub is valid
      if (!retrying) {
        const validation = microsubSelection.validateSelectedMicrosub();
        if (!validation.isValid) {
          notification.error(
            "Selected subscription is invalid. Please select a different subscription or use new payment.",
          );
          setIsLoading(false);
          return;
        }
      }

      // Check if using existing microsub or creating new payment
      const paymentHeader = microsubSelection.selectedMicrosub
        ? await buildAndSignPaymentHeader(undefined, true)
        : await buildAndSignPaymentHeader();

      // Build request body with either tx_hash or payment_header
      const requestBody: any = {
        query: searchQuery,
        num_results: resultsCount,
        bonfire_id: bonfireId, // Always include bonfire_id for graph scoping
      };

      if (microsubSelection.selectedMicrosub) {
        requestBody.tx_hash = microsubSelection.selectedMicrosub.tx_hash;
      } else if (paymentHeader) {
        requestBody.payment_header = paymentHeader;
      }

      // Include data room configuration if creating new payment
      if (pendingDataRoomConfig && !microsubSelection.selectedMicrosub) {
        requestBody.description = pendingDataRoomConfig.description;
        requestBody.system_prompt = pendingDataRoomConfig.systemPrompt;
        requestBody.center_node_uuid = pendingDataRoomConfig.centerNodeUuid;
      }

      // Override center_node_uuid if data room config exists (takes precedence)
      if (pendingDataRoomConfig?.centerNodeUuid) {
        requestBody.center_node_uuid = pendingDataRoomConfig.centerNodeUuid;
      }

      const response = await fetch(`/api/agents/${bonfireId}/delve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: DelveResponseWithPayment = await response.json();
      setResults(data);
      setActiveTab("results");
      setPendingDataRoomConfig(null); // Clear pending config after successful creation
      setIsRetrying(false);
      setIsLoading(false);
    } catch (err) {
      // Use centralized error detection
      const microsubErrorInfo = isMicrosubError(err);

      if (microsubErrorInfo.isMicrosubError && !retrying) {
        // First retry attempt - tailor message based on error type
        let warningMessage = "Subscription issue detected. Retrying with new payment...";
        if (microsubErrorInfo.errorType === "expired") {
          warningMessage = "Subscription expired during search. Retrying with new payment...";
        } else if (microsubErrorInfo.errorType === "exhausted") {
          warningMessage = "Subscription exhausted during search. Retrying with new payment...";
        }

        notification.warning(warningMessage, { duration: 4000 });
        microsubSelection.clearSelection();
        setIsRetrying(true);

        // Wait 1 second before retrying with same parameters
        setTimeout(() => {
          search(searchQuery, resultsCount, true);
        }, 1000);
        return;
      } else if (microsubErrorInfo.isMicrosubError && retrying) {
        // Retry failed
        notification.error("Subscription issue persists and retry failed. Please try again with a new payment.");
        setIsRetrying(false);
      }

      setError(formatErrorMessage(err));
      setIsLoading(false);
    }
  };

  // Wrapper that prepares state before calling search
  const handleSearch = async () => {
    if (!query.trim() || isLoading) return;

    // Pre-request validation: check if selected microsub is valid
    const validation = microsubSelection.validateSelectedMicrosub();
    if (!validation.isValid) {
      notification.error(
        "Selected subscription is invalid. Please select a different subscription or use new payment.",
      );
      return;
    }

    // Call search with current query and numResults
    await search(query, numResults, false);
  };

  if (!isConnected) {
    return (
      <div className={`card bg-base-200 shadow-xl ${className}`}>
        <div className="card-body items-center text-center">
          <h2 className="card-title">Connect Your Wallet</h2>
          <p>Please connect your wallet to search the knowledge graph.</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Layout */}
      <div className={`hidden lg:flex h-[calc(100vh-4rem)] bg-base-100 ${className}`}>
        {/* Sidebar */}
        <aside className="w-80 border-r border-base-300 flex flex-col">
          <MicrosubSelector
            availableMicrosubs={microsubSelection.availableMicrosubs}
            selectedMicrosub={microsubSelection.selectedMicrosub}
            loading={microsubSelection.loading}
            error={microsubSelection.error}
            onSelectMicrosub={microsubSelection.selectMicrosub}
            availableAgents={agentSelection.availableAgents}
            isSidebarMode={true}
            onCloseSidebar={closeSidebar}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-base-300">
            <h2 className="font-bold text-lg">Knowledge Graph Search</h2>
            <PaymentStatusBadge payment={results?.payment} />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-base-300">
            <button
              className="btn btn-sm btn-outline btn-primary"
              onClick={handleOpenWizard}
              disabled={isLoading || isSigningPayment || microsubSelection.loading}
            >
              ➕ Create Data Room
            </button>
            {pendingDataRoomConfig && (
              <div className="badge badge-info gap-2">
                📁 {truncateText(pendingDataRoomConfig.description, 30)}
                <button className="btn btn-xs btn-ghost btn-circle" onClick={() => setPendingDataRoomConfig(null)}>
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Alerts */}
          {microsubSelection.selectedMicrosub?.description && (
            <div className="alert alert-info mx-4 mt-2">
              <div className="flex-1">
                <div className="text-sm font-semibold mb-1">📁 Data Room Active</div>
                <div className="text-xs opacity-80">{microsubSelection.selectedMicrosub.description}</div>
                {microsubSelection.selectedMicrosub.system_prompt && (
                  <div className="text-xs opacity-70 mt-1">🤖 Custom system prompt active</div>
                )}
                {microsubSelection.selectedMicrosub.center_node_uuid && (
                  <div className="text-xs opacity-70 mt-1">
                    🎯 Center node: {truncateAddress(microsubSelection.selectedMicrosub.center_node_uuid, 6)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search Input */}
          <div className="px-4 py-3 border-b border-base-300">
            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder="Enter your search query..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                disabled={isLoading || isSigningPayment || microsubSelection.loading || isRetrying}
              />
              <select
                className="select select-bordered"
                value={numResults}
                onChange={e => setNumResults(parseInt(e.target.value))}
                disabled={isLoading || microsubSelection.loading || isRetrying}
              >
                <option value={5}>5 results</option>
                <option value={10}>10 results</option>
                <option value={20}>20 results</option>
                <option value={50}>50 results</option>
              </select>
              <button
                className="btn btn-primary"
                onClick={handleSearch}
                disabled={!query.trim() || isLoading || isSigningPayment || microsubSelection.loading || isRetrying}
              >
                {isRetrying ? (
                  "Retrying..."
                ) : isLoading || isSigningPayment ? (
                  <span className="loading loading-spinner"></span>
                ) : (
                  "Search"
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="alert alert-error mx-4 mb-2">
              <span>{error}</span>
            </div>
          )}

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {results && (
              <div className="tabs tabs-boxed mb-4">
                <button
                  className={`tab ${activeTab === "overview" ? "tab-active" : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  Overview
                </button>
                <button
                  className={`tab ${activeTab === "results" ? "tab-active" : ""}`}
                  onClick={() => setActiveTab("results")}
                >
                  Results ({(results.entities?.length || 0) + (results.episodes?.length || 0)})
                </button>
              </div>
            )}

            {results && activeTab === "overview" && (
              <div className="stats stats-vertical lg:stats-horizontal shadow">
                <div className="stat">
                  <div className="stat-title">Entities</div>
                  <div className="stat-value">{results.metrics?.entity_count || 0}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Episodes</div>
                  <div className="stat-value">{results.metrics?.episode_count || 0}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Edges</div>
                  <div className="stat-value">{results.metrics?.edge_count || 0}</div>
                </div>
              </div>
            )}

            {results && activeTab === "results" && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold mb-2">Entities ({results.entities?.length || 0})</h3>
                  {results.entities?.map((entity: any, idx: number) => (
                    <div key={idx} className="card bg-base-200 shadow-sm mb-2">
                      <div className="card-body p-4">
                        <div className="badge badge-primary">Entity</div>
                        <p className="font-semibold">{entity.name || "Unnamed"}</p>
                        <p className="text-sm opacity-70">{entity.summary || ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="font-bold mb-2">Episodes ({results.episodes?.length || 0})</h3>
                  {results.episodes?.map((episode: any, idx: number) => (
                    <div key={idx} className="card bg-base-200 shadow-sm mb-2">
                      <div className="card-body p-4">
                        <div className="badge badge-secondary">Episode</div>
                        <p className="text-sm">{episode.content || episode.summary || ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Layout with Drawer */}
      <div className="drawer lg:hidden">
        <input
          id="delve-sidebar-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={isSidebarOpen}
          onChange={toggleSidebar}
        />
        <div className="drawer-content flex flex-col h-[calc(100vh-4rem)]">
          {/* Main Content for Mobile */}
          <main className="flex-1 flex flex-col overflow-hidden bg-base-100">
            {/* Header with Toggle Button */}
            <div className="flex items-center justify-between p-4 border-b border-base-300">
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost btn-sm" onClick={toggleSidebar}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="inline-block w-5 h-5 stroke-current"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h2 className="font-bold text-lg">Knowledge Graph Search</h2>
              </div>
              <PaymentStatusBadge payment={results?.payment} />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-base-300">
              <button
                className="btn btn-sm btn-outline btn-primary"
                onClick={handleOpenWizard}
                disabled={isLoading || isSigningPayment || microsubSelection.loading}
              >
                ➕ Create Data Room
              </button>
              {pendingDataRoomConfig && (
                <div className="badge badge-info gap-2">
                  📁 {truncateText(pendingDataRoomConfig.description, 30)}
                  <button className="btn btn-xs btn-ghost btn-circle" onClick={() => setPendingDataRoomConfig(null)}>
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Alerts */}
            {microsubSelection.selectedMicrosub?.description && (
              <div className="alert alert-info mx-4 mt-2">
                <div className="flex-1">
                  <div className="text-sm font-semibold mb-1">📁 Data Room Active</div>
                  <div className="text-xs opacity-80">{microsubSelection.selectedMicrosub.description}</div>
                  {microsubSelection.selectedMicrosub.system_prompt && (
                    <div className="text-xs opacity-70 mt-1">🤖 Custom system prompt active</div>
                  )}
                  {microsubSelection.selectedMicrosub.center_node_uuid && (
                    <div className="text-xs opacity-70 mt-1">
                      🎯 Center node: {truncateAddress(microsubSelection.selectedMicrosub.center_node_uuid, 6)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="px-4 py-3 border-b border-base-300">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1"
                  placeholder="Enter your search query..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  disabled={isLoading || isSigningPayment || microsubSelection.loading || isRetrying}
                />
                <select
                  className="select select-bordered"
                  value={numResults}
                  onChange={e => setNumResults(parseInt(e.target.value))}
                  disabled={isLoading || microsubSelection.loading || isRetrying}
                >
                  <option value={5}>5 results</option>
                  <option value={10}>10 results</option>
                  <option value={20}>20 results</option>
                  <option value={50}>50 results</option>
                </select>
                <button
                  className="btn btn-primary"
                  onClick={handleSearch}
                  disabled={!query.trim() || isLoading || isSigningPayment || microsubSelection.loading || isRetrying}
                >
                  {isRetrying ? (
                    "Retrying..."
                  ) : isLoading || isSigningPayment ? (
                    <span className="loading loading-spinner"></span>
                  ) : (
                    "Search"
                  )}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="alert alert-error mx-4 mb-2">
                <span>{error}</span>
              </div>
            )}

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {results && (
                <div className="tabs tabs-boxed mb-4">
                  <button
                    className={`tab ${activeTab === "overview" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("overview")}
                  >
                    Overview
                  </button>
                  <button
                    className={`tab ${activeTab === "results" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("results")}
                  >
                    Results ({(results.entities?.length || 0) + (results.episodes?.length || 0)})
                  </button>
                </div>
              )}

              {results && activeTab === "overview" && (
                <div className="stats stats-vertical lg:stats-horizontal shadow">
                  <div className="stat">
                    <div className="stat-title">Entities</div>
                    <div className="stat-value">{results.metrics?.entity_count || 0}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Episodes</div>
                    <div className="stat-value">{results.metrics?.episode_count || 0}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Edges</div>
                    <div className="stat-value">{results.metrics?.edge_count || 0}</div>
                  </div>
                </div>
              )}

              {results && activeTab === "results" && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-bold mb-2">Entities ({results.entities?.length || 0})</h3>
                    {results.entities?.map((entity: any, idx: number) => (
                      <div key={idx} className="card bg-base-200 shadow-sm mb-2">
                        <div className="card-body p-4">
                          <div className="badge badge-primary">Entity</div>
                          <p className="font-semibold">{entity.name || "Unnamed"}</p>
                          <p className="text-sm opacity-70">{entity.summary || ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">Episodes ({results.episodes?.length || 0})</h3>
                    {results.episodes?.map((episode: any, idx: number) => (
                      <div key={idx} className="card bg-base-200 shadow-sm mb-2">
                        <div className="card-body p-4">
                          <div className="badge badge-secondary">Episode</div>
                          <p className="text-sm">{episode.content || episode.summary || ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Drawer Sidebar */}
        <div className="drawer-side z-40">
          <label htmlFor="delve-sidebar-drawer" className="drawer-overlay"></label>
          <aside className="w-80 h-full bg-base-100">
            <MicrosubSelector
              availableMicrosubs={microsubSelection.availableMicrosubs}
              selectedMicrosub={microsubSelection.selectedMicrosub}
              loading={microsubSelection.loading}
              error={microsubSelection.error}
              onSelectMicrosub={microsubSelection.selectMicrosub}
              availableAgents={agentSelection.availableAgents}
              isSidebarMode={true}
              onCloseSidebar={closeSidebar}
            />
          </aside>
        </div>
      </div>

      {/* DataRoomWizard Modal (shared by both layouts) */}
      <DataRoomWizard isOpen={isWizardOpen} onClose={handleCloseWizard} onComplete={handleWizardComplete} />
    </>
  );
}
