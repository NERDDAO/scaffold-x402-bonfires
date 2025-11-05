import { useEffect, useState } from "react";
import { Block, TransactionReceipt } from "viem";
import { usePublicClient } from "wagmi";

/**
 * Custom hook to fetch blocks from the blockchain
 */
export const useFetchBlocks = () => {
  const publicClient = usePublicClient();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [transactionReceipts, setTransactionReceipts] = useState<{ [key: string]: TransactionReceipt }>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0n);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBlocks = async () => {
      if (!publicClient) return;

      try {
        setIsLoading(true);
        const blockNumber = await publicClient.getBlockNumber();
        setTotalBlocks(blockNumber);

        // Fetch last 10 blocks
        const blockPromises = [];
        for (let i = 0; i < 10; i++) {
          const num = blockNumber - BigInt(i);
          if (num >= 0n) {
            blockPromises.push(publicClient.getBlock({ blockNumber: num, includeTransactions: true }));
          }
        }

        const fetchedBlocks = await Promise.all(blockPromises);
        setBlocks(fetchedBlocks);

        // Fetch transaction receipts
        const receipts: { [key: string]: TransactionReceipt } = {};
        for (const block of fetchedBlocks) {
          if (block.transactions && Array.isArray(block.transactions)) {
            for (const tx of block.transactions) {
              const txHash = typeof tx === "string" ? tx : tx.hash;
              if (txHash) {
                try {
                  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
                  receipts[txHash] = receipt;
                } catch (err) {
                  console.error(`Failed to fetch receipt for ${txHash}:`, err);
                }
              }
            }
          }
        }
        setTransactionReceipts(receipts);
        setError(null);
      } catch (err) {
        console.error("Error fetching blocks:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlocks();
  }, [publicClient, currentPage]);

  return { blocks, transactionReceipts, currentPage, totalBlocks, setCurrentPage, isLoading, error };
};
