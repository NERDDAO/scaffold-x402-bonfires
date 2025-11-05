import { useCallback, useEffect, useState } from "react";
import { notification } from "~~/utils/scaffold-eth";

/**
 * Custom hook for copying text to clipboard
 */
export const useCopyToClipboard = () => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    if (!navigator.clipboard) {
      notification.error("Clipboard not supported");
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      notification.success("Copied to clipboard!");
      return true;
    } catch {
      notification.error("Failed to copy!");
      setIsCopied(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  return { isCopied, isCopiedToClipboard: isCopied, copyToClipboard };
};
