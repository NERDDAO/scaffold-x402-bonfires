import { Hash, TransactionReceipt } from "viem";
import { usePublicClient } from "wagmi";
import { notification } from "~~/utils/scaffold-eth";

type TransactionFunc = () => Promise<Hash>;
type TransactionObject = {
  to?: string;
  value?: bigint;
  account?: string;
  [key: string]: any;
};
type TTransactorOptions = {
  onBlockConfirmation?: (txnReceipt: TransactionReceipt) => void;
  blockConfirmations?: number;
};

/**
 * Custom hook for sending transactions with block confirmations
 */
export const useTransactor = (walletClient?: any) => {
  const publicClient = usePublicClient();

  const result = async (
    tx: TransactionFunc | Promise<Hash> | TransactionObject,
    options?: TTransactorOptions,
  ): Promise<Hash | undefined> => {
    try {
      let transactionHash: Hash;

      // Execute the transaction
      if (typeof tx === "function") {
        transactionHash = await tx();
      } else if (typeof tx === "object" && !("then" in tx) && "to" in tx) {
        // It's a transaction object, send it via wallet client
        if (walletClient && walletClient.sendTransaction) {
          transactionHash = await walletClient.sendTransaction(tx);
        } else {
          throw new Error("Wallet client not available for transaction");
        }
      } else {
        transactionHash = (await tx) as Hash;
      }

      notification.success("Transaction sent!");

      // Wait for confirmations if requested
      if (options?.onBlockConfirmation && publicClient) {
        const transactionReceipt = await publicClient.waitForTransactionReceipt({
          hash: transactionHash,
          confirmations: options.blockConfirmations || 1,
        });
        options.onBlockConfirmation(transactionReceipt);
      }

      return transactionHash;
    } catch (error: any) {
      if (error?.message) {
        notification.error(error.message);
      } else {
        notification.error("Transaction failed");
      }
      throw error;
    }
  };

  return result;
};
