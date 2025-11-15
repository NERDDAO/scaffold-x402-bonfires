/**
 * Utility functions for the x402 payment-gated application
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Truncate an Ethereum address for display
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format an ISO timestamp to a human-readable string
 */
export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return isoString;
  }
}

/**
 * Extract user-friendly error message from various error types
 */
export function formatErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    // Check for microsub-specific errors
    if (error.includes("409") || error.includes("Conflict")) {
      return "Subscription exhausted. Retrying with new payment...";
    }
    if (error.includes("expired")) {
      return "Subscription has expired. Please use a new payment.";
    }
    if (error.includes("exhausted")) {
      return "Subscription has no queries remaining. Please use a new payment.";
    }
    return error;
  }

  if (error instanceof Error) {
    // Check for microsub-specific errors
    if (error.message.includes("409") || error.message.includes("Conflict")) {
      return "Subscription exhausted. Retrying with new payment...";
    }
    if (error.message.includes("expired")) {
      return "Subscription has expired. Please use a new payment.";
    }
    if (error.message.includes("exhausted")) {
      return "Subscription has no queries remaining. Please use a new payment.";
    }
    if (error.message.includes("User rejected")) {
      return "Transaction was rejected by user";
    }
    if (error.message.includes("insufficient funds")) {
      return "Insufficient funds to complete transaction";
    }
    if (error.message.includes("network")) {
      return "Network error. Please check your connection and try again.";
    }
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as any).message);
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Detect if an error is related to microsub validity issues
 * @param error - The error to check
 * @returns Object indicating if it's a microsub error and the error type
 */
export function isMicrosubError(error: unknown): {
  isMicrosubError: boolean;
  errorType?: "expired" | "exhausted" | "invalid";
} {
  let message = "";

  if (typeof error === "string") {
    message = error.toLowerCase();
  } else if (error instanceof Error) {
    message = error.message.toLowerCase();
  } else if (error && typeof error === "object" && "message" in error) {
    message = String((error as any).message).toLowerCase();
  }

  if (!message) {
    return { isMicrosubError: false };
  }

  // Check for expired subscription
  if (message.includes("expired") || message.includes("expiration")) {
    return { isMicrosubError: true, errorType: "expired" };
  }

  // Check for exhausted subscription
  if (message.includes("exhausted") || message.includes("no queries remaining")) {
    return { isMicrosubError: true, errorType: "exhausted" };
  }

  // Check for invalid subscription
  if (message.includes("invalid") || message.includes("not found")) {
    return { isMicrosubError: true, errorType: "invalid" };
  }

  // Check for 409 Conflict (default to exhausted)
  if (message.includes("409") || message.includes("conflict")) {
    return { isMicrosubError: true, errorType: "exhausted" };
  }

  // Check for generic microsub/subscription errors
  if (message.includes("microsub") || message.includes("subscription")) {
    return { isMicrosubError: true, errorType: "invalid" };
  }

  return { isMicrosubError: false };
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Format token amount with decimals for display
 */
export function formatTokenAmount(amount: string | number, decimals: number = 6, displayDecimals: number = 2): string {
  try {
    const amountNum = typeof amount === "string" ? parseFloat(amount) : amount;
    const divisor = Math.pow(10, decimals);
    const value = amountNum / divisor;
    return value.toFixed(displayDecimals);
  } catch (error) {
    console.error("Error formatting token amount:", error);
    return String(amount);
  }
}

/**
 * Shorten a long text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Calculate reading time estimate from word count
 */
export function calculateReadingTime(wordCount: number): string {
  if (!wordCount || wordCount <= 0) return "";

  const minutes = Math.ceil(wordCount / 200);

  if (minutes < 1) {
    return "< 1 min read";
  } else if (minutes === 1) {
    return "1 min read";
  } else {
    return `${minutes} min read`;
  }
}
