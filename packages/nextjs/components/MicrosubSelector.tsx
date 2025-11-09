"use client";

import React, { useId, useMemo } from "react";
import { AgentInfo, MicrosubInfo } from "~~/lib/types/delve-api";
import { formatTimestamp, truncateAddress, truncateText } from "~~/lib/utils";

interface MicrosubSelectorProps {
  availableMicrosubs: MicrosubInfo[];
  selectedMicrosub: MicrosubInfo | null;
  loading: boolean;
  error: string | null;
  onSelectMicrosub: (tx_hash: string | null) => void;
  availableAgents?: AgentInfo[];
  className?: string;
  isSidebarMode?: boolean; // Flag to enable sidebar-specific styling
  onCloseSidebar?: () => void; // Callback to close the sidebar on mobile
}

export const MicrosubSelector: React.FC<MicrosubSelectorProps> = ({
  availableMicrosubs,
  selectedMicrosub,
  loading,
  error,
  onSelectMicrosub,
  availableAgents,
  className = "",
  isSidebarMode = false,
  onCloseSidebar,
}) => {
  // Generate unique ID for radio group to avoid collisions with multiple instances
  const radioGroupName = useId();

  // Helper function for agent name resolution
  const getAgentName = useMemo(() => {
    return (agent_id: string): string => {
      if (!availableAgents) return truncateAddress(agent_id, 6);
      const agent = availableAgents.find(a => a.id === agent_id);
      return agent ? agent.username || agent.name : truncateAddress(agent_id, 6);
    };
  }, [availableAgents]);

  // Helper function to detect data rooms
  const isDataRoom = (microsub: MicrosubInfo): boolean => {
    return !!microsub.description && microsub.description.trim().length > 0;
  };

  // Helper function for status badge
  const getStatusBadge = (microsub: MicrosubInfo): React.ReactElement => {
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

  // Helper function for expiration warning
  const isExpiringSoon = (expires_at: string, is_valid: boolean | undefined): boolean => {
    if (!is_valid) return false;
    const expirationDate = new Date(expires_at);
    const now = new Date();
    const hoursUntilExpiration = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiration > 0 && hoursUntilExpiration <= 24;
  };

  // Check if there are any valid microsubs
  const hasValidMicrosubs = availableMicrosubs.some(m => m.is_valid);

  return (
    <div className={`microsub-selector ${isSidebarMode ? "h-full flex flex-col" : "w-full"} ${className}`}>
      {/* Sidebar header (only in sidebar mode) */}
      {isSidebarMode && (
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h3 className="font-bold text-lg">Subscriptions</h3>
          {onCloseSidebar && (
            <button className="btn btn-sm btn-ghost btn-circle lg:hidden" onClick={onCloseSidebar}>
              ✕
            </button>
          )}
        </div>
      )}

      {/* Label section (only in non-sidebar mode) */}
      {!isSidebarMode && (
        <label className="label">
          <span className="label-text font-semibold">Select Payment Method</span>
        </label>
      )}

      {/* Loading state */}
      {loading && <div className="skeleton h-32 w-full"></div>}

      {/* Error state */}
      {error && !loading && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && (
        <div className={isSidebarMode ? "flex-1 overflow-y-auto px-4 py-2" : ""}>
          <div className="space-y-3">
            {/* "Use New Payment" option card */}
            <div
              className={`card bg-base-200 cursor-pointer transition-colors ${
                isSidebarMode ? "shadow-sm hover:bg-base-200 p-3" : "shadow-sm hover:bg-base-300"
              } ${selectedMicrosub === null ? "ring-2 ring-primary" : ""}`}
              onClick={() => onSelectMicrosub(null)}
            >
              <div className={`card-body ${isSidebarMode ? "p-3" : "p-4"} flex flex-row items-center gap-3`}>
                <input
                  type="radio"
                  name={radioGroupName}
                  className="radio radio-primary"
                  checked={selectedMicrosub === null}
                  onChange={() => onSelectMicrosub(null)}
                  onClick={e => e.stopPropagation()}
                />
                <div className="flex-1">
                  <div className="font-semibold">💳 Use New Payment</div>
                  <div className="text-sm opacity-70">Sign a new payment header for this request</div>
                </div>
                {!hasValidMicrosubs && <span className="badge badge-primary badge-sm">Recommended</span>}
              </div>
            </div>

            {/* Divider */}
            {availableMicrosubs.length > 0 && (
              <div className="divider text-sm opacity-50">OR USE EXISTING SUBSCRIPTION</div>
            )}

            {/* Microsub list */}
            {availableMicrosubs.length > 0 && (
              <>
                {availableMicrosubs.map(microsub => {
                  const isSelected = selectedMicrosub?.tx_hash === microsub.tx_hash;
                  const isDisabled = !microsub.is_valid;
                  const expiringSoon = isExpiringSoon(microsub.expires_at, microsub.is_valid);

                  return (
                    <div
                      key={microsub.tx_hash}
                      className={`card bg-base-200 cursor-pointer transition-colors ${
                        isSidebarMode ? "shadow-sm hover:bg-base-200" : "shadow-sm hover:bg-base-300"
                      } ${isSelected ? "ring-2 ring-primary" : ""} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => !isDisabled && onSelectMicrosub(microsub.tx_hash)}
                    >
                      <div className={`card-body ${isSidebarMode ? "p-3" : "p-4"}`}>
                        <div className="flex flex-row items-start gap-3">
                          <input
                            type="radio"
                            name={radioGroupName}
                            className="radio radio-primary mt-1"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => !isDisabled && onSelectMicrosub(microsub.tx_hash)}
                            onClick={e => e.stopPropagation()}
                          />
                          <div className="flex-1 space-y-2">
                            {/* Top row: Agent name and status badge */}
                            <div className="flex flex-row items-center justify-between">
                              <span className="font-semibold">{getAgentName(microsub.agent_id)}</span>
                              {getStatusBadge(microsub)}
                            </div>

                            {/* Middle row: Queries info */}
                            <div className="flex flex-row items-center gap-2 text-sm">
                              <span>📊</span>
                              <span>
                                {microsub.queries_remaining} / {microsub.query_limit} queries remaining
                              </span>
                            </div>

                            {/* Bottom row: Expiration and transaction hash */}
                            <div className="flex flex-row items-center justify-between text-xs opacity-70">
                              <div className="flex flex-row items-center gap-2">
                                <span>⏰</span>
                                <span>{formatTimestamp(microsub.expires_at)}</span>
                                {expiringSoon && <span className="badge badge-warning badge-xs">Expiring Soon</span>}
                              </div>
                              <div className="flex flex-row items-center gap-2">
                                <span>🔗</span>
                                <span>{truncateAddress(microsub.tx_hash, 6)}</span>
                              </div>
                            </div>

                            {/* Data Room Section */}
                            {isDataRoom(microsub) && (
                              <div
                                className={`mt-2 pt-2 border-t border-base-300 rounded-b-lg ${
                                  isSidebarMode ? "bg-info/10 px-3 pb-3" : "bg-base-300/50 -mx-4 -mb-4 px-4 pb-4"
                                }`}
                              >
                                <div className="space-y-2">
                                  <div className="flex gap-2 items-center">
                                    <span className="badge badge-info badge-sm">
                                      {isSidebarMode ? "📁 Data Room" : "Data Room"}
                                    </span>
                                    {microsub.system_prompt && <span className="badge badge-sm">Custom Prompt</span>}
                                  </div>
                                  <p className={isSidebarMode ? "text-sm" : "text-xs"}>
                                    {truncateText(microsub.description || "", 100)}
                                  </p>
                                  {microsub.center_node_uuid && (
                                    <div className={isSidebarMode ? "text-sm opacity-70" : "text-xs opacity-70"}>
                                      🎯 Center: {truncateAddress(microsub.center_node_uuid, 6)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Empty state */}
            {availableMicrosubs.length === 0 && (
              <div className="alert alert-info">
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
                <span>No existing subscriptions found. Use new payment to continue.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Helper text below selector */}
      {!loading && !error && (
        <div className={`text-xs opacity-70 ${isSidebarMode ? "mt-auto p-4 border-t border-base-300" : "mt-2"}`}>
          {selectedMicrosub ? (
            <span>
              Using subscription {truncateAddress(selectedMicrosub.tx_hash, 6)} with{" "}
              {selectedMicrosub.queries_remaining} queries remaining
            </span>
          ) : (
            <span>A new payment will be required for this request</span>
          )}
        </div>
      )}
    </div>
  );
};

export default MicrosubSelector;
