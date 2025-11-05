"use client";

import { useSearchParams } from "next/navigation";
import { PaidChatInterface } from "@/components/PaidChatInterface";
import { config } from "@/lib/config";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent") || config.app.defaultAgentId || "default-agent";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Payment-Gated AI Chat</h1>
        <p className="text-base-content/70">
          Connect your wallet and pay to interact with the AI agent using blockchain payments.
        </p>
      </div>
      <PaidChatInterface agentId={agentId} />
    </div>
  );
}
