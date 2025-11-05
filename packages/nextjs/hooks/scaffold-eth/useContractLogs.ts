import { useEffect, useState } from "react";
import { Address } from "viem";
import { usePublicClient } from "wagmi";

/**
 * Custom hook to fetch contract logs
 */
export const useContractLogs = (address: Address) => {
  const publicClient = usePublicClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!publicClient || !address) return;

      try {
        setIsLoading(true);
        const blockNumber = await publicClient.getBlockNumber();
        const fromBlock = blockNumber > 1000n ? blockNumber - 1000n : 0n;

        const contractLogs = await publicClient.getLogs({
          address,
          fromBlock,
          toBlock: blockNumber,
        });

        setLogs(contractLogs);
        setError(null);
      } catch (err) {
        console.error("Error fetching logs:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [publicClient, address]);

  return { data: logs, logs, isLoading, error };
};
