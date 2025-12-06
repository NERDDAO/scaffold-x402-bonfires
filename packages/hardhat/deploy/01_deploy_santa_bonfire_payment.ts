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

  // Admin address - can be set to a different address for production
  // For now, deployer is both owner and admin
  const admin = process.env.ADMIN_ADDRESS || deployer;

  // Base URI for NFT metadata (can be updated later via setBaseURI)
  const baseURI = "https://api.santabonfire.xyz/metadata/";

  await deploy("SantaBonfirePayment", {
    from: deployer,
    // Contract constructor arguments: owner address, admin address, and base URI
    args: [deployer, admin, baseURI],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const santaBonfirePayment = await hre.ethers.getContract<Contract>("SantaBonfirePayment", deployer);
  console.log("🎅 SantaBonfirePayment deployed!");
  console.log("   Owner:", deployer);
  console.log("   Admin:", admin);
  console.log("   NFT Name:", await santaBonfirePayment.name());
  console.log("   NFT Symbol:", await santaBonfirePayment.symbol());
};

export default deploySantaBonfirePayment;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags SantaBonfirePayment
deploySantaBonfirePayment.tags = ["SantaBonfirePayment"];
