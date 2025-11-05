/**
 * Centralized configuration module for the x402 payment-gated application
 *
 * NOTE: Next.js only replaces DIRECT references to process.env.VARIABLE_NAME at build time.
 * Dynamic property access like process.env[key] will NOT work!
 */

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function assertEnvVar(value: string | undefined, name: string, description: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}\nDescription: ${description}`);
  }
  return value;
}

// Direct access pattern - required for Next.js webpack replacement
const delveApiUrl = assertEnvVar(
  process.env.NEXT_PUBLIC_DELVE_API_URL,
  "NEXT_PUBLIC_DELVE_API_URL",
  "Delve backend API URL",
);

const paymentAmount = assertEnvVar(
  process.env.NEXT_PUBLIC_PAYMENT_AMOUNT,
  "NEXT_PUBLIC_PAYMENT_AMOUNT",
  "Payment amount in token units",
);

const chainIdStr = assertEnvVar(
  process.env.NEXT_PUBLIC_CHAIN_ID,
  "NEXT_PUBLIC_CHAIN_ID",
  "Chain ID for wallet connection",
);
const chainId = parseInt(chainIdStr, 10);

if (isNaN(chainId) || chainId <= 0) {
  throw new Error(`Invalid NEXT_PUBLIC_CHAIN_ID: "${chainIdStr}"`);
}

const tokenAddress = assertEnvVar(
  process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS,
  "NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS",
  "ERC-20 token contract address",
);
if (!isValidAddress(tokenAddress)) {
  throw new Error(`Invalid NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS: "${tokenAddress}"`);
}

const recipientAddress = assertEnvVar(
  process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS,
  "NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS",
  "Payment recipient address",
);
if (!isValidAddress(recipientAddress)) {
  throw new Error(`Invalid NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS: "${recipientAddress}"`);
}

const network = assertEnvVar(
  process.env.NEXT_PUBLIC_PAYMENT_NETWORK,
  "NEXT_PUBLIC_PAYMENT_NETWORK",
  "Blockchain network name",
);

const queryLimit = parseInt(process.env.NEXT_PUBLIC_QUERY_LIMIT || "25", 10);
const expirationDays = parseInt(process.env.NEXT_PUBLIC_EXPIRATION_DAYS || "30", 10);
const defaultAgentId = process.env.NEXT_PUBLIC_DEFAULT_AGENT_ID || "";

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

export const config = {
  delve: { apiUrl: delveApiUrl, timeout: 30000 },
  payment: { amount: paymentAmount, tokenAddress, recipientAddress, chainId, network, queryLimit, expirationDays },
  app: { isDevelopment, isProduction, defaultAgentId: defaultAgentId || undefined },
} as const;
