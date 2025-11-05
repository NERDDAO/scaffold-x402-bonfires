import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentInfo, AgentSelectionState, BonfireInfo } from "~~/lib/types/delve-api";

interface UseAgentSelectionConfig {
  initialBonfireId?: string | null;
  initialAgentId?: string | null;
}

export function useAgentSelection(selectionConfig?: UseAgentSelectionConfig) {
  const [availableBonfires, setAvailableBonfires] = useState<BonfireInfo[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AgentInfo[]>([]);
  const [selectedBonfireId, setSelectedBonfireId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loadingBonfires, setLoadingBonfires] = useState<boolean>(false);
  const [loadingAgents, setLoadingAgents] = useState<boolean>(false);
  const [errorBonfires, setErrorBonfires] = useState<string | null>(null);
  const [errorAgents, setErrorAgents] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // Load bonfires on mount
  useEffect(() => {
    let mounted = true;
    setLoadingBonfires(true);
    setErrorBonfires(null);

    fetch(`/api/bonfires`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load bonfires: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (!mounted) return;
        const bonfires = data.bonfires || [];
        setAvailableBonfires(bonfires);

        // Auto-select initial bonfire if provided
        if (
          selectionConfig?.initialBonfireId &&
          bonfires.find((b: BonfireInfo) => b.id === selectionConfig.initialBonfireId)
        ) {
          setSelectedBonfireId(selectionConfig.initialBonfireId);
        }

        setIsInitialized(true);
      })
      .catch(err => {
        if (!mounted) return;
        const errorMsg = err instanceof Error ? err.message : "Failed to load bonfires";
        setErrorBonfires(errorMsg);
        setInitializationError(errorMsg);
        setIsInitialized(true);
      })
      .finally(() => {
        if (mounted) setLoadingBonfires(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectionConfig?.initialBonfireId]);

  // When a bonfire is selected, fetch its agents
  useEffect(() => {
    let mounted = true;

    if (!selectedBonfireId) {
      setAvailableAgents([]);
      setSelectedAgentId(null);
      return () => {
        mounted = false;
      };
    }

    setLoadingAgents(true);
    setErrorAgents(null);

    fetch(`/api/bonfires/${selectedBonfireId}/agents`)
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Bonfire not found");
          throw new Error(`Failed to load agents: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        if (!mounted) return;
        const agents = (data.agents || [])
          .map((a: any) => ({
            ...a,
            id: String(a?.id ?? ""),
            username: String(a?.username ?? a?.name ?? a?.id ?? ""),
            name: a?.name || a?.username || a?.id,
            bonfire_id: a?.bonfire_id || a?.bonfireId || selectedBonfireId,
            is_active: a?.is_active ?? true,
          }))
          .filter((a: AgentInfo) => a.id && a.id.length > 0);

        setAvailableAgents(agents);

        // Auto-select initial agent if provided and matches the current bonfire
        if (
          selectionConfig?.initialAgentId &&
          selectedBonfireId === selectionConfig?.initialBonfireId &&
          agents.find((a: AgentInfo) => a.id === selectionConfig.initialAgentId)
        ) {
          setSelectedAgentId(selectionConfig.initialAgentId);
        }
      })
      .catch(err => {
        if (!mounted) return;
        const errorMsg = err instanceof Error ? err.message : "Failed to load agents";
        setErrorAgents(errorMsg);
      })
      .finally(() => {
        if (mounted) setLoadingAgents(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedBonfireId, selectionConfig?.initialAgentId, selectionConfig?.initialBonfireId]);

  const selectBonfire = useCallback((bonfireId: string | null) => {
    setSelectedBonfireId(bonfireId);
    setSelectedAgentId(null);
    setAvailableAgents([]);
  }, []);

  const selectAgent = useCallback((agentId: string | null) => {
    setSelectedAgentId(agentId);
  }, []);

  const selectionState: AgentSelectionState = useMemo(
    () => ({
      selectedBonfire: availableBonfires.find(b => b.id === selectedBonfireId) || null,
      selectedAgent: availableAgents.find(a => a.id === selectedAgentId) || null,
      availableBonfires,
      availableAgents,
      loading: { bonfires: loadingBonfires, agents: loadingAgents },
      error: { bonfires: errorBonfires, agents: errorAgents },
    }),
    [
      availableAgents,
      availableBonfires,
      selectedAgentId,
      selectedBonfireId,
      loadingAgents,
      loadingBonfires,
      errorAgents,
      errorBonfires,
    ],
  );

  return {
    // state
    availableBonfires,
    availableAgents,
    selectedBonfire: selectionState.selectedBonfire,
    selectedAgent: selectionState.selectedAgent,
    selectedBonfireId,
    selectedAgentId,
    // initialization state
    isInitialized,
    initializationError,
    // actions
    selectBonfire,
    selectAgent,
    // selection state for component
    selectionState,
    // loading & error
    loading: { bonfires: loadingBonfires, agents: loadingAgents },
    error: { bonfires: errorBonfires, agents: errorAgents },
  } as const;
}
