"use client";

import { useCallback, useState } from "react";
import { config } from "../lib/config";
import { buildPaymentTypedData, encodePaymentHeader } from "../lib/payment/build-payment-header";
import type { X402PaymentHeader } from "../lib/types/x402";
import { useAccount, useSignTypedData } from "wagmi";

export interface UsePaymentHeaderReturn {
  /**
   * Build and sign a payment header for X402 protocol.
   *
   * @param amount - Optional payment amount in token units. Defaults to config.payment.amount.
   * @param skipSigning - When true, skips wallet signing and returns null.
   *                      This is used when an existing microsub (subscription) is selected,
   *                      allowing the request to proceed without a new payment header.
   *                      The backend will use the provided tx_hash to identify the microsub.
   * @returns X402PaymentHeader object containing the signed payment data, or null if skipSigning is true.
   */
  buildAndSignPaymentHeader: (amount?: string, skipSigning?: boolean) => Promise<X402PaymentHeader | null>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Hook for building and signing X402 payment headers.
 *
 * This hook handles two payment modes:
 * 1. New Payment: Signs a fresh payment header with the user's wallet
 * 2. Existing Microsub: Returns null when skipSigning=true, allowing the request
 *    to use a tx_hash parameter instead of a payment_header
 *
 * The backend payment controller handles both modes by accepting either:
 * - payment_header (new payment)
 * - tx_hash (existing microsub)
 */
export function usePaymentHeader(): UsePaymentHeaderReturn {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync, isPending } = useSignTypedData();
  const [error, setError] = useState<Error | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const buildAndSignPaymentHeader = useCallback(
    async (amount?: string, skipSigning?: boolean): Promise<X402PaymentHeader | null> => {
      try {
        setError(null);
        setIsProcessing(true);

        // Early return if using existing microsub (skipSigning mode)
        // In this case, the caller should provide tx_hash instead of payment_header
        if (skipSigning === true) {
          return null;
        }

        if (!isConnected || !address) {
          throw new Error("Wallet not connected. Please connect your wallet to continue.");
        }

        const paymentAmount = amount || config.payment.amount;
        const typedData = buildPaymentTypedData({
          tokenAddress: config.payment.tokenAddress,
          recipientAddress: config.payment.recipientAddress,
          amount: paymentAmount,
          network: config.payment.network,
          chainId: config.payment.chainId,
          userAddress: address,
        });

        const signature = await signTypedDataAsync({
          domain: typedData.domain as any,
          types: typedData.types as any,
          primaryType: typedData.primaryType,
          message: typedData.message as any,
        });

        return encodePaymentHeader(typedData.message, signature, config.payment.network);
      } catch (err) {
        const error = new Error(err instanceof Error ? err.message : "Failed to build payment header");
        setError(error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [address, isConnected, signTypedDataAsync],
  );

  const reset = useCallback(() => setError(null), []);

  return { buildAndSignPaymentHeader, isLoading: isPending || isProcessing, error, reset };
}
