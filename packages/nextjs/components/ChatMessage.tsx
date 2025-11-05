"use client";

import { ChatMessage as ChatMessageType } from "@/lib/types/delve-api";

interface ChatMessageProps {
  message: ChatMessageType;
  className?: string;
}

export function ChatMessage({ message, className = "" }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`chat ${isUser ? "chat-end" : "chat-start"} ${className}`}>
      <div className="chat-image avatar">
        <div className="w-10 rounded-full">
          <div className={`flex items-center justify-center w-full h-full ${isUser ? "bg-primary" : "bg-secondary"}`}>
            <span className="text-xl">{isUser ? "👤" : "🤖"}</span>
          </div>
        </div>
      </div>
      <div className="chat-header mb-1">{isUser ? "You" : "Assistant"}</div>
      <div className={`chat-bubble ${isUser ? "chat-bubble-primary" : "chat-bubble-secondary"}`}>{message.content}</div>
    </div>
  );
}
