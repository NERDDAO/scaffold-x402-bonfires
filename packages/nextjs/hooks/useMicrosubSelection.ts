import { useCallback, useEffect, useMemo, useState } from "react";
import type { MicrosubInfo, MicrosubListResponse } from "~~/lib/types/delve-api";

// Extended MicrosubInfo with disabled flag for UI
export interface MicrosubInfoWithDisabled extends MicrosubInfo {
  disabled: boolean;
}

interface UseMicrosubSelectionConfig {
  walletAddress?: string | null;
  autoSelectValid?: boolean;
  onInvalidSelection?: (reason: "expired" | "exhausted" | "invalid") => void;
  onlyDataRooms?: boolean;
}

export function useMicrosubSelection(config?: UseMicrosubSelectionConfig) {
  const [availableMicrosubs, setAvailableMicrosubs] = useState<MicrosubInfoWithDisabled[]>([]);
  const [selectedMicrosub, setSelectedMicrosub] = useState<MicrosubInfoWithDisabled | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState<number>(0);

  // Fetch microsubs when wallet address changes OR when refetchTrigger changes
  useEffect(() => {
    let mounted = true;
    const abortController = new AbortController();

    // Comment 2: Clear selection when wallet changes to avoid cross-account selection
    setSelectedMicrosub(null);

    // Early return if wallet address is not provided
    if (!config?.walletAddress) {
      setAvailableMicrosubs([]);
      setLoading(false);
      setError(null);
      return () => {
        mounted = false;
        abortController.abort();
      };
    }

    // Comment 3: Capture wallet address for request scoping
    const requestWalletAddress = config.walletAddress;

    setLoading(true);
    setError(null);

    const apiUrl = `/api/microsubs?wallet_address=${encodeURIComponent(config.walletAddress)}${config?.onlyDataRooms ? "&only_data_rooms=true" : ""}`;

    fetch(apiUrl, {
      signal: abortController.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load microsubs: ${res.statusText}`);
        return res.json();
      })
      .then((data: MicrosubListResponse) => {
        // Comment 3: Only update state if request is still relevant
        if (!mounted || requestWalletAddress !== config?.walletAddress) return;

        // Comment 1: Map microsubs to include disabled flag
        const microsubsWithDisabled: MicrosubInfoWithDisabled[] = (data.microsubs || []).map(m => ({
          ...m,
          disabled: m.is_expired || m.is_exhausted || !m.is_valid,
        }));

        setAvailableMicrosubs(microsubsWithDisabled);

        // Comment 2: Only auto-select if autoSelectValid is enabled
        if (config?.autoSelectValid) {
          const firstValid = microsubsWithDisabled.find(m => !m.disabled);
          if (firstValid) {
            setSelectedMicrosub(firstValid);
          }
        }
      })
      .catch(err => {
        if (!mounted || err.name === "AbortError") return;
        const errorMsg = err instanceof Error ? err.message : "Failed to load microsubs";
        setError(errorMsg);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [config?.walletAddress, config?.autoSelectValid, config?.onlyDataRooms, refetchTrigger]);

  // Refetch function to manually trigger microsub refresh
  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedMicrosub(null);
  }, []);

  // Comment 4: Expose validation method without UI coupling
  const validateSelectedMicrosub = useCallback(() => {
    if (selectedMicrosub === null) {
      return { isValid: true as const };
    }

    let reason: "expired" | "exhausted" | "invalid" | undefined;

    if (selectedMicrosub.is_expired === true) {
      reason = "expired";
    } else if (selectedMicrosub.is_exhausted === true) {
      reason = "exhausted";
    } else if (selectedMicrosub.is_valid === false) {
      reason = "invalid";
    }

    if (reason) {
      // Comment 4: Notify caller via callback if provided
      config?.onInvalidSelection?.(reason);
      return { isValid: false as const, reason };
    }

    return { isValid: true as const };
  }, [selectedMicrosub, config]);

  // Comment 5: Block selection of disabled microsubs
  const selectMicrosub = useCallback(
    (tx_hash: string | null) => {
      if (tx_hash === null) {
        setSelectedMicrosub(null);
        return;
      }
      const microsub = availableMicrosubs.find(m => m.tx_hash === tx_hash);

      // Don't select if not found or disabled
      if (!microsub || microsub.disabled) {
        return;
      }

      setSelectedMicrosub(microsub);
    },
    [availableMicrosubs],
  );

  const validMicrosubs = useMemo(() => availableMicrosubs.filter(m => !m.disabled), [availableMicrosubs]);

  const expiredMicrosubs = useMemo(() => availableMicrosubs.filter(m => m.is_expired === true), [availableMicrosubs]);

  const exhaustedMicrosubs = useMemo(
    () => availableMicrosubs.filter(m => m.is_exhausted === true),
    [availableMicrosubs],
  );

  const hasValidMicrosubs = useMemo(() => validMicrosubs.length > 0, [validMicrosubs]);

  const hasAnyMicrosubs = useMemo(() => availableMicrosubs.length > 0, [availableMicrosubs]);

  return {
    // state
    availableMicrosubs,
    selectedMicrosub,
    loading,
    error,
    // computed
    validMicrosubs,
    expiredMicrosubs,
    exhaustedMicrosubs,
    hasValidMicrosubs,
    hasAnyMicrosubs,
    // actions
    selectMicrosub,
    clearSelection,
    validateSelectedMicrosub,
    refetch,
  } as const;
}
