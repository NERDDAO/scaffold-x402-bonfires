import {
  BuildPaymentHeaderParams,
  DEFAULT_VALID_DURATION_SECONDS,
  EIP712Domain,
  ERC3009_TYPES,
  TransferWithAuthorization,
  TypedData,
  X402PaymentHeader,
  X402PaymentPayload,
  X402_VERSION,
} from "../types/x402";

// USDC has 6 decimals (most stablecoins use 6, not 18 like ETH)
const USDC_DECIMALS = 6;

/**
 * Converts a decimal amount string to the token's smallest unit
 * @param amount - Amount as a decimal string (e.g., "0.01")
 * @param decimals - Token decimals (default 6 for USDC)
 * @returns Amount in smallest unit as a string (e.g., "10000" for 0.01 USDC)
 */
export function parseTokenAmount(amount: string, decimals: number = USDC_DECIMALS): string {
  const amountFloat = parseFloat(amount);
  if (isNaN(amountFloat)) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  // Multiply by 10^decimals and convert to integer string
  const multiplier = Math.pow(10, decimals);
  const amountInSmallestUnit = Math.floor(amountFloat * multiplier);

  return amountInSmallestUnit.toString();
}

export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

export function getTokenDomain(tokenAddress: string, chainId: number): EIP712Domain {
  return {
    name: "USD Coin",
    version: "2",
    chainId: chainId,
    verifyingContract: tokenAddress,
  };
}

export function buildPaymentTypedData(params: BuildPaymentHeaderParams): TypedData {
  const {
    tokenAddress,
    recipientAddress,
    amount,
    chainId,
    userAddress,
    validDuration = DEFAULT_VALID_DURATION_SECONDS,
  } = params;
  const nonce = generateNonce();
  const now = Math.floor(Date.now() / 1000);
  const validAfter = now.toString();
  const validBefore = (now + validDuration).toString();

  // Convert decimal amount (e.g., "0.01") to token smallest unit (e.g., "10000" for USDC)
  const valueInSmallestUnit = parseTokenAmount(amount, USDC_DECIMALS);

  const authorization: TransferWithAuthorization = {
    from: userAddress,
    to: recipientAddress,
    value: valueInSmallestUnit,
    validAfter: validAfter,
    validBefore: validBefore,
    nonce: nonce,
  };

  const domain = getTokenDomain(tokenAddress, chainId);

  return {
    domain,
    types: ERC3009_TYPES,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  };
}

export function encodePaymentHeader(
  authorization: TransferWithAuthorization,
  signature: string,
  network: string,
): X402PaymentHeader {
  const payload: X402PaymentPayload = {
    x402Version: X402_VERSION,
    scheme: "exact",
    network: network,
    payload: { authorization, signature },
  };
  return btoa(JSON.stringify(payload));
}
