"use client";

import { useCallback, useState } from "react";
import { config } from "../lib/config";
import { buildPaymentTypedData, encodePaymentHeader } from "../lib/payment/build-payment-header";
import type { X402PaymentHeader } from "../lib/types/x402";
import { useAccount, useSignTypedData } from "wagmi";

export interface UsePaymentHeaderReturn {
  buildAndSignPaymentHeader: (amount?: string) => Promise<X402PaymentHeader>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

export function usePaymentHeader(): UsePaymentHeaderReturn {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync, isPending } = useSignTypedData();
  const [error, setError] = useState<Error | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const buildAndSignPaymentHeader = useCallback(
    async (amount?: string): Promise<X402PaymentHeader> => {
      try {
        setError(null);
        setIsProcessing(true);

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
