"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePaymentHeader } from "@/hooks/usePaymentHeader";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import type { DelveResponseWithPayment } from "@/lib/types/delve-api";
import { formatErrorMessage } from "@/lib/utils";

interface PaidDelveInterfaceProps {
  agentId: string;
  className?: string;
}

export function PaidDelveInterface({ agentId, className = "" }: PaidDelveInterfaceProps) {
  const { isConnected } = useAccount();
  const { buildAndSignPaymentHeader, isLoading: isSigningPayment } = usePaymentHeader();
  const [query, setQuery] = useState("");
  const [numResults, setNumResults] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DelveResponseWithPayment | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "results">("overview");

  const handleSearch = async () => {
    if (!query.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const paymentHeader = await buildAndSignPaymentHeader();

      const response = await fetch(`/api/agents/${agentId}/delve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          num_results: numResults,
          payment_header: paymentHeader,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: DelveResponseWithPayment = await response.json();
      setResults(data);
      setActiveTab("results");
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
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

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="input input-bordered flex-1"
            placeholder="Enter your search query..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            disabled={isLoading || isSigningPayment}
          />
          <select
            className="select select-bordered"
            value={numResults}
            onChange={e => setNumResults(parseInt(e.target.value))}
            disabled={isLoading}
          >
            <option value={5}>5 results</option>
            <option value={10}>10 results</option>
            <option value={20}>20 results</option>
            <option value={50}>50 results</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={!query.trim() || isLoading || isSigningPayment}
          >
            {isLoading || isSigningPayment ? <span className="loading loading-spinner"></span> : "Search"}
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
              {results.entities?.map((entity, idx) => (
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
              {results.episodes?.map((episode, idx) => (
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

