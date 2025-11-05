"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePaymentHeader } from "@/hooks/usePaymentHeader";
import { ChatMessage } from "./ChatMessage";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import type { ChatMessage as ChatMessageType, ChatResponseWithPayment, GraphMode } from "@/lib/types/delve-api";
import { formatErrorMessage } from "@/lib/utils";

interface PaidChatInterfaceProps {
  agentId: string;
  className?: string;
}

export function PaidChatInterface({ agentId, className = "" }: PaidChatInterfaceProps) {
  const { isConnected } = useAccount();
  const { buildAndSignPaymentHeader, isLoading: isSigningPayment } = usePaymentHeader();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<ChatResponseWithPayment["payment"] | null>(null);
  const [graphMode, setGraphMode] = useState<GraphMode>("adaptive");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessageType = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const paymentHeader = await buildAndSignPaymentHeader();

      const response = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          chat_history: messages,
          agent_id: agentId,
          graph_mode: graphMode,
          payment_header: paymentHeader,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: ChatResponseWithPayment = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      setPayment(data.payment);
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
          <p>Please connect your wallet to start chatting with the AI agent.</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title">AI Agent Chat</h2>
          <div className="flex gap-2 items-center">
            <select
              className="select select-sm select-bordered"
              value={graphMode}
              onChange={e => setGraphMode(e.target.value as GraphMode)}
            >
              <option value="adaptive">Adaptive</option>
              <option value="static">Static</option>
              <option value="dynamic">Dynamic</option>
              <option value="none">None</option>
            </select>
            <PaymentStatusBadge payment={payment || undefined} />
          </div>
        </div>

        <div className="bg-base-200 rounded-lg p-4 h-96 overflow-y-auto mb-4">
          {messages.length === 0 && (
            <div className="text-center text-base-content/50 mt-20">
              Start a conversation...
            </div>
          )}
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} className="mb-4" />
          ))}
          {isLoading && (
            <div className="flex justify-center">
              <span className="loading loading-dots loading-lg"></span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            className="textarea textarea-bordered flex-1"
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading || isSigningPayment}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isSigningPayment}
          >
            {isLoading || isSigningPayment ? <span className="loading loading-spinner"></span> : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

