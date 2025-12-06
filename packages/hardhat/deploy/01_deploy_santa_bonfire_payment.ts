import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the SantaBonfirePayment contract using the deployer account
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deploySantaBonfirePayment: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Minimum payment: 1 USDC (1_000_000 = 1 USDC with 6 decimals)
  const minimumPayment = 1_000_000n;

  // Base URI for NFT metadata (can be updated later via setBaseURI)
  const baseURI = "https://api.santabonfire.xyz/metadata/";

  await deploy("SantaBonfirePayment", {
    from: deployer,
    // Contract constructor arguments: owner address, minimum payment, and base URI
    args: [deployer, minimumPayment, baseURI],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const santaBonfirePayment = await hre.ethers.getContract<Contract>("SantaBonfirePayment", deployer);
  console.log("🎅 SantaBonfirePayment deployed!");
  console.log("   Minimum payment:", await santaBonfirePayment.minimumPayment(), "USDC units");
  console.log("   USDC address:", await santaBonfirePayment.USDC_BASE_MAINNET());
  console.log("   NFT Name:", await santaBonfirePayment.name());
  console.log("   NFT Symbol:", await santaBonfirePayment.symbol());
};

export default deploySantaBonfirePayment;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags SantaBonfirePayment
deploySantaBonfirePayment.tags = ["SantaBonfirePayment"];
