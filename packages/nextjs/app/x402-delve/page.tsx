"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AgentSelector } from "@/components/AgentSelector";
import { PaidDelveInterface } from "@/components/PaidDelveInterface";
import { useAgentSelection } from "@/hooks/useAgentSelection";
import { config } from "@/lib/config";

function DelvePageContent() {
  const searchParams = useSearchParams();
  const urlAgentId = searchParams.get("agent");
  const urlBonfireId = searchParams.get("bonfire");

  const agentSelection = useAgentSelection({
    initialBonfireId: urlBonfireId,
    initialAgentId: urlAgentId,
  });

  // Use selected bonfire ID for graph scoping
  const bonfireId = agentSelection.selectedBonfireId || urlBonfireId || config.app.defaultAgentId || "default-bonfire";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Knowledge Graph Search</h1>
        <p className="text-base-content/70">Search the knowledge graph with blockchain-powered payments.</p>
      </div>

      {/* Agent Selection */}
      <div className="mb-6 card bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Select Agent</h2>
          <AgentSelector
            state={agentSelection.selectionState}
            onBonfireChange={agentSelection.selectBonfire}
            onAgentChange={agentSelection.selectAgent}
          />
        </div>
      </div>

      {/* Delve Interface */}
      {agentSelection.selectedBonfire ? (
        <PaidDelveInterface bonfireId={bonfireId} />
      ) : (
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
          <span>Please select a bonfire to search the knowledge graph.</span>
        </div>
      )}
    </div>
  );
}

export default function DelvePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Knowledge Graph Search</h1>
            <p className="text-base-content/70">Loading...</p>
          </div>
        </div>
      }
    >
      <DelvePageContent />
    </Suspense>
  );
}
