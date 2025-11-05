"use client";

import { useMemo } from "react";
import type { AgentInfo, AgentSelectionState, BonfireInfo } from "~~/lib/types/delve-api";

type AgentSelectorProps = {
  state: AgentSelectionState;
  onBonfireChange: (bonfireId: string | null) => void;
  onAgentChange: (agentId: string | null) => void;
};

export const AgentSelector: React.FC<AgentSelectorProps> = ({ state, onBonfireChange, onAgentChange }) => {
  const bonfireValue = useMemo(() => state.selectedBonfire?.id || "", [state.selectedBonfire]);
  const agentValue = useMemo(() => state.selectedAgent?.id || "", [state.selectedAgent]);

  const bonfireLabel = (b: BonfireInfo) => b.name;
  const agentLabel = (a: AgentInfo) => `${a.name || a.username || a.id}${a.is_active ? "" : " (inactive)"}`;

  return (
    <div className="agent-selector w-full">
      <div className="flex flex-col md:flex-row gap-4 w-full">
        {/* Bonfire selector */}
        <div className="form-control flex-1">
          <label className="label">
            <span className="label-text font-semibold">Select Bonfire</span>
          </label>
          {state.loading.bonfires ? (
            <div className="skeleton h-12 w-full"></div>
          ) : state.error?.bonfires ? (
            <div className="alert alert-error">
              <span>{state.error.bonfires || "Failed to load bonfires"}</span>
            </div>
          ) : (
            <div className="relative">
              <select
                className="select select-bordered w-full"
                value={bonfireValue}
                onChange={e => onBonfireChange(e.target.value || null)}
              >
                <option value="">— Select Bonfire —</option>
                {state.availableBonfires.map(b => (
                  <option key={b.id} value={b.id}>
                    {bonfireLabel(b)}
                  </option>
                ))}
              </select>
              {bonfireValue && (
                <button
                  className="btn btn-ghost btn-sm btn-circle absolute right-10 top-1/2 -translate-y-1/2"
                  onClick={() => onBonfireChange(null)}
                  aria-label="Clear bonfire"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Agent selector */}
        <div className="form-control flex-1">
          <label className="label">
            <span className="label-text font-semibold">Select Agent</span>
          </label>
          {state.loading.agents ? (
            <div className="skeleton h-12 w-full"></div>
          ) : state.error?.agents ? (
            <div className="alert alert-error">
              <span>{state.error.agents || "Failed to load agents"}</span>
            </div>
          ) : (
            <div className="relative">
              <select
                className="select select-bordered w-full"
                value={agentValue}
                onChange={e => onAgentChange(e.target.value || null)}
                disabled={!state.selectedBonfire}
              >
                <option value="">{state.selectedBonfire ? "— Select Agent —" : "Select a bonfire first"}</option>
                {state.selectedBonfire &&
                  state.availableAgents.map(a => (
                    <option key={a.id} value={a.id}>
                      {agentLabel(a)}
                    </option>
                  ))}
              </select>
              {agentValue && (
                <button
                  className="btn btn-ghost btn-sm btn-circle absolute right-10 top-1/2 -translate-y-1/2"
                  onClick={() => onAgentChange(null)}
                  aria-label="Clear agent"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentSelector;
