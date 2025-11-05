/**
 * Centralized configuration module for the x402 payment-gated application
 */

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function getRequiredEnv(key: string, description: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}\nDescription: ${description}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

const delveApiUrl = getRequiredEnv("NEXT_PUBLIC_DELVE_API_URL", "Delve backend API URL");
const paymentAmount = getRequiredEnv("NEXT_PUBLIC_PAYMENT_AMOUNT", "Payment amount in token units");
const chainIdStr = getRequiredEnv("NEXT_PUBLIC_CHAIN_ID", "Chain ID for wallet connection");
const chainId = parseInt(chainIdStr, 10);

if (isNaN(chainId) || chainId <= 0) {
  throw new Error(`Invalid NEXT_PUBLIC_CHAIN_ID: "${chainIdStr}"`);
}

const tokenAddress = getRequiredEnv("NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS", "ERC-20 token contract address");
if (!isValidAddress(tokenAddress)) {
  throw new Error(`Invalid NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS: "${tokenAddress}"`);
}

const recipientAddress = getRequiredEnv("NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS", "Payment recipient address");
if (!isValidAddress(recipientAddress)) {
  throw new Error(`Invalid NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS: "${recipientAddress}"`);
}

const network = getRequiredEnv("NEXT_PUBLIC_PAYMENT_NETWORK", "Blockchain network name");
const queryLimit = parseInt(getOptionalEnv("NEXT_PUBLIC_QUERY_LIMIT", "25"), 10);
const expirationDays = parseInt(getOptionalEnv("NEXT_PUBLIC_EXPIRATION_DAYS", "30"), 10);
const defaultAgentId = getOptionalEnv("NEXT_PUBLIC_DEFAULT_AGENT_ID", "");

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

export const config = {
  delve: { apiUrl: delveApiUrl, timeout: 30000 },
  payment: { amount: paymentAmount, tokenAddress, recipientAddress, chainId, network, queryLimit, expirationDays },
  app: { isDevelopment, isProduction, defaultAgentId: defaultAgentId || undefined },
} as const;
