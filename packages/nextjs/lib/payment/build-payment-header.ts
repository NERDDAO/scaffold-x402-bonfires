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

  const authorization: TransferWithAuthorization = {
    from: userAddress,
    to: recipientAddress,
    value: amount,
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
