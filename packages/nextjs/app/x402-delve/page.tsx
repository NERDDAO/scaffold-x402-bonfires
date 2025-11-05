"use client";

import { useSearchParams } from "next/navigation";
import { PaidDelveInterface } from "@/components/PaidDelveInterface";
import { config } from "@/lib/config";

export default function DelvePage() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent") || config.app.defaultAgentId || "default-agent";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Knowledge Graph Search</h1>
        <p className="text-base-content/70">
          Search the knowledge graph with blockchain-powered payments.
        </p>
      </div>
      <PaidDelveInterface agentId={agentId} />
    </div>
  );
}

