import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the HyperBlogNFT contract using the deployer account
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployHyperBlogNFT: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Admin address - can be set to a different address for production
  // For now, deployer is both owner and admin
  const admin = process.env.ADMIN_ADDRESS || deployer;

  // Base URI for NFT metadata (can be updated later via setBaseURI)
  const baseURI = process.env.HYPERBLOG_NFT_BASE_URI || "https://api.delve.xyz/nft/metadata/";

  await deploy("HyperBlogNFT", {
    from: deployer,
    // Contract constructor arguments: owner, admin, name, symbol, baseURI
    args: [deployer, admin, "HyperBlog NFT", "HBLOG", baseURI],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const hyperBlogNFT = await hre.ethers.getContract<Contract>("HyperBlogNFT", deployer);
  console.log("📝 HyperBlogNFT deployed!");
  console.log("   Owner:", deployer);
  console.log("   Admin:", admin);
  console.log("   NFT Name:", await hyperBlogNFT.name());
  console.log("   NFT Symbol:", await hyperBlogNFT.symbol());
  console.log("   Base URI:", baseURI);
};

export default deployHyperBlogNFT;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags HyperBlogNFT
deployHyperBlogNFT.tags = ["HyperBlogNFT"];
