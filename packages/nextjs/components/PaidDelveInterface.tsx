"use client";

import { useState } from "react";
import { MicrosubSelector } from "./MicrosubSelector";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { useAgentSelection } from "@/hooks/useAgentSelection";
import { useMicrosubSelection } from "@/hooks/useMicrosubSelection";
import { usePaymentHeader } from "@/hooks/usePaymentHeader";
import type { DelveResponseWithPayment } from "@/lib/types/delve-api";
import { formatErrorMessage, isMicrosubError } from "@/lib/utils";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { notification } from "~~/utils/scaffold-eth/notification";

interface PaidDelveInterfaceProps {
  agentId: string;
  className?: string;
}

export function PaidDelveInterface({ agentId, className = "" }: PaidDelveInterfaceProps) {
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
      };

      if (microsubSelection.selectedMicrosub) {
        requestBody.tx_hash = microsubSelection.selectedMicrosub.tx_hash;
      } else if (paymentHeader) {
        requestBody.payment_header = paymentHeader;
      }

      const response = await fetch(`/api/agents/${agentId}/delve`, {
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
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title">Knowledge Graph Search</h2>
          <PaymentStatusBadge payment={results?.payment} />
        </div>

        <MicrosubSelector
          availableMicrosubs={microsubSelection.availableMicrosubs}
          selectedMicrosub={microsubSelection.selectedMicrosub}
          loading={microsubSelection.loading}
          error={microsubSelection.error}
          onSelectMicrosub={microsubSelection.selectMicrosub}
          availableAgents={agentSelection.availableAgents}
          className="mb-4"
        />

        <div className="flex gap-2 mb-4">
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

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
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
    </div>
  );
}
