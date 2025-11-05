import { useTargetNetwork } from "./useTargetNetwork";
import { ContractName, contracts } from "~~/utils/scaffold-eth/contract";

/**
 * Gets the deployed contract info for a given contract name and target network
 */
export const useDeployedContractInfo = (params: { contractName: ContractName } | ContractName) => {
  const { targetNetwork } = useTargetNetwork();

  const contractName =
    typeof params === "string" || typeof params === "number"
      ? params
      : typeof params === "object" && params !== null
        ? params.contractName
        : params;
  const deployedContract = contracts?.[targetNetwork.id]?.[contractName];

  return {
    data: deployedContract,
    isLoading: false,
  };
};
