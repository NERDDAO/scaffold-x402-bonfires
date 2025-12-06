import { expect } from "chai";
import { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SantaBonfirePayment, MockUSDC } from "../typechain-types";

describe("SantaBonfirePayment", function () {
  const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const BASE_URI = "https://api.santabonfire.com/nft/";

  async function deployFixture() {
    const [owner, admin, user1, user2] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();
    const mockUSDCAddress = await mockUSDC.getAddress();

    // Get the deployed bytecode and set at USDC address
    const deployedBytecode = await ethers.provider.getCode(mockUSDCAddress);
    await network.provider.send("hardhat_setCode", [USDC_BASE_MAINNET, deployedBytecode]);

    const usdc = MockUSDCFactory.attach(USDC_BASE_MAINNET) as MockUSDC;

    // Deploy SantaBonfirePayment with owner and admin
    const SantaBonfirePaymentFactory = await ethers.getContractFactory("SantaBonfirePayment");
    const santaBonfire = (await SantaBonfirePaymentFactory.deploy(
      owner.address,
      admin.address,
      BASE_URI,
    )) as SantaBonfirePayment;
    await santaBonfire.waitForDeployment();

    // Mint USDC to users for testing
    await usdc.mint(user1.address, 100_000_000n);
    await usdc.mint(user2.address, 100_000_000n);

    return { santaBonfire, usdc, owner, admin, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should deploy with correct owner", async function () {
      const { santaBonfire, owner } = await loadFixture(deployFixture);
      expect(await santaBonfire.owner()).to.equal(owner.address);
    });

    it("Should deploy with correct admin", async function () {
      const { santaBonfire, admin } = await loadFixture(deployFixture);
      expect(await santaBonfire.admin()).to.equal(admin.address);
    });

    it("Should deploy with correct NFT name and symbol", async function () {
      const { santaBonfire } = await loadFixture(deployFixture);
      expect(await santaBonfire.name()).to.equal("Santa Bonfire Access");
      expect(await santaBonfire.symbol()).to.equal("SANTA");
    });
  });

  describe("Admin Mint", function () {
    it("Should allow admin to mint NFT", async function () {
      const { santaBonfire, admin, user1 } = await loadFixture(deployFixture);

      await santaBonfire.connect(admin).mint(user1.address);

      expect(await santaBonfire.hasMinted(user1.address)).to.equal(true);
      expect(await santaBonfire.balanceOf(user1.address)).to.equal(1n);
    });

    it("Should emit NFTMinted event", async function () {
      const { santaBonfire, admin, user1 } = await loadFixture(deployFixture);

      await expect(santaBonfire.connect(admin).mint(user1.address))
        .to.emit(santaBonfire, "NFTMinted")
        .withArgs(user1.address, 1n);
    });

    it("Should revert when non-admin tries to mint", async function () {
      const { santaBonfire, user1, user2 } = await loadFixture(deployFixture);

      await expect(santaBonfire.connect(user1).mint(user2.address)).to.be.revertedWithCustomError(
        santaBonfire,
        "NotAdmin",
      );
    });

    it("Should revert when owner tries to mint (owner is not admin)", async function () {
      const { santaBonfire, owner, user1 } = await loadFixture(deployFixture);

      await expect(santaBonfire.connect(owner).mint(user1.address)).to.be.revertedWithCustomError(
        santaBonfire,
        "NotAdmin",
      );
    });

    it("Should revert when minting to address that already has NFT", async function () {
      const { santaBonfire, admin, user1 } = await loadFixture(deployFixture);

      await santaBonfire.connect(admin).mint(user1.address);

      await expect(santaBonfire.connect(admin).mint(user1.address)).to.be.revertedWithCustomError(
        santaBonfire,
        "AlreadyMinted",
      );
    });
  });

  describe("Admin Mint Batch", function () {
    it("Should allow admin to batch mint", async function () {
      const { santaBonfire, admin, user1, user2 } = await loadFixture(deployFixture);

      await santaBonfire.connect(admin).mintBatch([user1.address, user2.address]);

      expect(await santaBonfire.balanceOf(user1.address)).to.equal(1n);
      expect(await santaBonfire.balanceOf(user2.address)).to.equal(1n);
      expect(await santaBonfire.totalMinted()).to.equal(2n);
    });

    it("Should skip already minted addresses", async function () {
      const { santaBonfire, admin, user1, user2 } = await loadFixture(deployFixture);

      await santaBonfire.connect(admin).mint(user1.address);
      await santaBonfire.connect(admin).mintBatch([user1.address, user2.address]);

      expect(await santaBonfire.balanceOf(user1.address)).to.equal(1n);
      expect(await santaBonfire.balanceOf(user2.address)).to.equal(1n);
      expect(await santaBonfire.totalMinted()).to.equal(2n);
    });

    it("Should revert when non-admin tries batch mint", async function () {
      const { santaBonfire, user1, user2 } = await loadFixture(deployFixture);

      await expect(santaBonfire.connect(user1).mintBatch([user2.address])).to.be.revertedWithCustomError(
        santaBonfire,
        "NotAdmin",
      );
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to set admin", async function () {
      const { santaBonfire, owner, admin, user1 } = await loadFixture(deployFixture);

      await expect(santaBonfire.connect(owner).setAdmin(user1.address))
        .to.emit(santaBonfire, "AdminUpdated")
        .withArgs(admin.address, user1.address);

      expect(await santaBonfire.admin()).to.equal(user1.address);
    });

    it("Should revert when non-owner tries to set admin", async function () {
      const { santaBonfire, admin, user1 } = await loadFixture(deployFixture);

      await expect(santaBonfire.connect(admin).setAdmin(user1.address))
        .to.be.revertedWithCustomError(santaBonfire, "OwnableUnauthorizedAccount")
        .withArgs(admin.address);
    });

    it("Should allow owner to withdraw USDC", async function () {
      const { santaBonfire, usdc, owner, user1 } = await loadFixture(deployFixture);

      const paymentAmount = 10_000_000n;
      await usdc.connect(user1).transfer(await santaBonfire.getAddress(), paymentAmount);

      const ownerBalanceBefore = await usdc.balanceOf(owner.address);
      await santaBonfire.connect(owner).withdraw();

      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBalanceBefore + paymentAmount);
    });

    it("Should revert when admin tries to withdraw", async function () {
      const { santaBonfire, usdc, admin, user1 } = await loadFixture(deployFixture);

      await usdc.connect(user1).transfer(await santaBonfire.getAddress(), 10_000_000n);

      await expect(santaBonfire.connect(admin).withdraw())
        .to.be.revertedWithCustomError(santaBonfire, "OwnableUnauthorizedAccount")
        .withArgs(admin.address);
    });

    it("Should allow owner to update base URI", async function () {
      const { santaBonfire, owner } = await loadFixture(deployFixture);

      const newURI = "https://new-api.santabonfire.com/nft/";
      await expect(santaBonfire.connect(owner).setBaseURI(newURI))
        .to.emit(santaBonfire, "BaseURIUpdated")
        .withArgs(BASE_URI, newURI);
    });
  });

  describe("x402 Payment Flow", function () {
    it("Should handle full x402 flow: USDC transfer + admin mint", async function () {
      const { santaBonfire, usdc, owner, admin, user1 } = await loadFixture(deployFixture);

      // Step 1: x402 facilitator transfers USDC to contract
      const paymentAmount = 10_000_000n;
      await usdc.connect(user1).transfer(await santaBonfire.getAddress(), paymentAmount);

      expect(await santaBonfire.getBalance()).to.equal(paymentAmount);

      // Step 2: Backend verifies payment, admin mints NFT
      await santaBonfire.connect(admin).mint(user1.address);

      expect(await santaBonfire.balanceOf(user1.address)).to.equal(1n);

      // Step 3: Owner withdraws USDC
      await santaBonfire.connect(owner).withdraw();
      expect(await santaBonfire.getBalance()).to.equal(0n);
    });

    it("Should handle multiple users through x402 flow", async function () {
      const { santaBonfire, usdc, owner, admin, user1, user2 } = await loadFixture(deployFixture);

      // Both users pay via x402
      await usdc.connect(user1).transfer(await santaBonfire.getAddress(), 10_000_000n);
      await usdc.connect(user2).transfer(await santaBonfire.getAddress(), 20_000_000n);

      // Admin batch mints
      await santaBonfire.connect(admin).mintBatch([user1.address, user2.address]);

      expect(await santaBonfire.totalMinted()).to.equal(2n);

      // Owner withdraws
      await santaBonfire.connect(owner).withdraw();
      expect(await santaBonfire.getBalance()).to.equal(0n);
    });
  });
});
