import { useAccount } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import { NETWORKS_EXTRA_DATA } from "~~/utils/scaffold-eth";

export function useTargetNetwork() {
  const { chain } = useAccount();
  return {
    targetNetwork: chain || scaffoldConfig.targetNetworks[0],
  };
}

export function useNetworkColor() {
  const { targetNetwork } = useTargetNetwork();
  return targetNetwork ? getNetworkColor(targetNetwork) : undefined;
}

export function getNetworkColor(network: any, isDarkMode?: boolean): string {
  const extraData = NETWORKS_EXTRA_DATA[network.id];
  if (!extraData) return "#666666";

  const colorData = extraData.color;

  // If color is an array [lightColor, darkColor], return based on theme
  if (Array.isArray(colorData)) {
    return isDarkMode ? colorData[1] : colorData[0];
  }

  // If it's a string, return as is
  return colorData as string;
}
