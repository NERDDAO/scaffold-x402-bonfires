"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AgentSelector } from "@/components/AgentSelector";
import { PaidChatInterface } from "@/components/PaidChatInterface";
import { useAgentSelection } from "@/hooks/useAgentSelection";
import { config } from "@/lib/config";
import type { DataRoomInfo } from "@/lib/types/delve-api";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const urlAgentId = searchParams.get("agent");
  const urlBonfireId = searchParams.get("bonfire");
  const urlDataRoomId = searchParams.get("dataroom");

  const [dataRoom, setDataRoom] = useState<DataRoomInfo | null>(null);

  const agentSelection = useAgentSelection({
    initialBonfireId: urlBonfireId || dataRoom?.bonfire_id,
    initialAgentId: urlAgentId,
  });

  // Fetch data room if ID is provided
  useEffect(() => {
    if (urlDataRoomId) {
      fetch(`/api/datarooms/${urlDataRoomId}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch data room");
          return res.json();
        })
        .then((data: DataRoomInfo) => {
          setDataRoom(data);
        })
        .catch(err => {
          console.error("Error fetching data room:", err);
        });
    }
  }, [urlDataRoomId]);

  // Use selected agent or fallback to URL param or default
  const agentId = agentSelection.selectedAgentId || urlAgentId || config.app.defaultAgentId || "default-agent";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Payment-Gated AI Chat</h1>
        <p className="text-base-content/70">
          Connect your wallet and pay to interact with the AI agent using blockchain payments.
        </p>
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

      {/* Chat Interface */}
      {agentSelection.selectedAgent ? (
        <PaidChatInterface agentId={agentId} />
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
          <span>Please select a bonfire and agent to start chatting.</span>
        </div>
      )}
    </div>
  );
}
