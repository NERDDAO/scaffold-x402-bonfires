import { notification } from "~~/utils/scaffold-eth";

/**
 * Custom hook for transactions
 */
export const useTransactor = (walletClient?: any) => {
  const result = async (tx: (() => Promise<any>) | Promise<any> | any) => {
    try {
      let txResult;

      // If it's a function, call it
      if (typeof tx === "function") {
        txResult = await tx();
      }
      // If it's a transaction object with to/value properties, send it via wallet client
      else if (tx && typeof tx === "object" && (tx.to || tx.value)) {
        if (walletClient && walletClient.sendTransaction) {
          txResult = await walletClient.sendTransaction(tx);
        } else {
          txResult = tx;
        }
      }
      // Otherwise treat it as a promise
      else {
        txResult = await tx;
      }

      notification.success("Transaction sent!");
      return txResult;
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
