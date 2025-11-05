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
    return error;
  }

  if (error instanceof Error) {
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
