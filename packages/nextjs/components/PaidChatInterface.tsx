"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "./ChatMessage";
import { MicrosubSelector } from "./MicrosubSelector";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { useAgentSelection } from "@/hooks/useAgentSelection";
import { useMicrosubSelection } from "@/hooks/useMicrosubSelection";
import { usePaymentHeader } from "@/hooks/usePaymentHeader";
import type { ChatMessage as ChatMessageType, ChatResponseWithPayment, GraphMode } from "@/lib/types/delve-api";
import { formatErrorMessage, isMicrosubError } from "@/lib/utils";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { notification } from "~~/utils/scaffold-eth/notification";

interface PaidChatInterfaceProps {
  agentId: string;
  className?: string;
}

export function PaidChatInterface({ agentId, className = "" }: PaidChatInterfaceProps) {
  const { isConnected, address } = useAccount();
  const { buildAndSignPaymentHeader, isLoading: isSigningPayment } = usePaymentHeader();
  const microsubSelection = useMicrosubSelection({ walletAddress: address });
  const agentSelection = useAgentSelection();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<ChatResponseWithPayment["payment"] | null>(null);
  const [graphMode, setGraphMode] = useState<GraphMode>("adaptive");
  const [isRetrying, setIsRetrying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Core send function that performs the fetch
  const send = async (messageText: string, chatHistory: ChatMessageType[], retrying: boolean) => {
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
        message: messageText,
        chat_history: chatHistory,
        agent_id: agentId,
        graph_mode: graphMode,
      };

      if (microsubSelection.selectedMicrosub) {
        requestBody.tx_hash = microsubSelection.selectedMicrosub.tx_hash;
      } else if (paymentHeader) {
        requestBody.payment_header = paymentHeader;
      }

      const response = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: ChatResponseWithPayment = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      setPayment(data.payment);
      setIsRetrying(false);
      setIsLoading(false);

      // Refetch microsubs to update queries_remaining count
      microsubSelection.refetch();
    } catch (err) {
      // Use centralized error detection
      const microsubErrorInfo = isMicrosubError(err);

      if (microsubErrorInfo.isMicrosubError && !retrying) {
        // First retry attempt - tailor message based on error type
        let warningMessage = "Subscription issue detected. Retrying with new payment...";
        if (microsubErrorInfo.errorType === "expired") {
          warningMessage = "Subscription expired during request. Retrying with new payment...";
        } else if (microsubErrorInfo.errorType === "exhausted") {
          warningMessage = "Subscription exhausted during request. Retrying with new payment...";
        }

        notification.warning(warningMessage, { duration: 4000 });
        microsubSelection.clearSelection();
        setIsRetrying(true);

        // Wait 1 second before retrying with same parameters
        setTimeout(() => {
          send(messageText, chatHistory, true);
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

  // Wrapper that prepares state before calling send
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessageType = { role: "user", content: input };
    const messageText = input;

    // Pre-request validation: check if selected microsub is valid before mutating UI
    const validation = microsubSelection.validateSelectedMicrosub();
    if (!validation.isValid) {
      notification.error(
        "Selected subscription is invalid. Please select a different subscription or use new payment.",
      );
      return;
    }

    // Build next chat history with the new user message
    const nextHistory = [...messages, userMessage];

    // Only mutate UI after validation passes
    setMessages(nextHistory);
    setInput("");

    // Call send with the message text and complete history
    await send(messageText, nextHistory, false);
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

        <MicrosubSelector
          availableMicrosubs={microsubSelection.availableMicrosubs}
          selectedMicrosub={microsubSelection.selectedMicrosub}
          loading={microsubSelection.loading}
          error={microsubSelection.error}
          onSelectMicrosub={microsubSelection.selectMicrosub}
          availableAgents={agentSelection.availableAgents}
          className="mb-4"
        />

        <div className="bg-base-200 rounded-lg p-4 h-96 overflow-y-auto mb-4">
          {messages.length === 0 && (
            <div className="text-center text-base-content/50 mt-20">Start a conversation...</div>
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
            disabled={isLoading || isSigningPayment || microsubSelection.loading || isRetrying}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isSigningPayment || microsubSelection.loading || isRetrying}
          >
            {isRetrying ? (
              "Retrying..."
            ) : isLoading || isSigningPayment ? (
              <span className="loading loading-spinner"></span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
