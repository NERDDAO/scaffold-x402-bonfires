import { expect } from "chai";
import { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SantaBonfirePayment, MockUSDC } from "../typechain-types";

describe("SantaBonfirePayment", function () {
  // Constants
  const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const MINIMUM_PAYMENT = 1_000_000n; // 1 USDC (6 decimals)
  const BASE_URI = "https://api.santabonfire.com/nft/";

  // Helper to generate ERC-3009 authorization params
  function getAuthorizationParams(from: string, value: bigint) {
    return {
      from,
      value,
      validAfter: 0n,
      validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
      nonce: ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`,
      v: 0,
      r: ethers.ZeroHash as `0x${string}`,
      s: ethers.ZeroHash as `0x${string}`,
    };
  }

  async function deployFixture() {
    const [owner, payer, otherAccount] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();
    const mockUSDCAddress = await mockUSDC.getAddress();

    // Get the deployed bytecode
    const deployedBytecode = await ethers.provider.getCode(mockUSDCAddress);

    // Set the MockUSDC bytecode at the hardcoded USDC address
    await network.provider.send("hardhat_setCode", [USDC_BASE_MAINNET, deployedBytecode]);

    // Get a reference to MockUSDC at the USDC address
    const usdc = MockUSDCFactory.attach(USDC_BASE_MAINNET) as MockUSDC;

    // Deploy SantaBonfirePayment
    const SantaBonfirePaymentFactory = await ethers.getContractFactory("SantaBonfirePayment");
    const santaBonfire = (await SantaBonfirePaymentFactory.deploy(
      owner.address,
      MINIMUM_PAYMENT,
      BASE_URI,
    )) as SantaBonfirePayment;
    await santaBonfire.waitForDeployment();

    // Mint USDC to payer for testing
    await usdc.mint(payer.address, 100_000_000n); // 100 USDC

    return { santaBonfire, usdc, owner, payer, otherAccount };
  }

  describe("Deployment", function () {
    it("Should deploy with correct owner", async function () {
      const { santaBonfire, owner } = await loadFixture(deployFixture);
      expect(await santaBonfire.owner()).to.equal(owner.address);
    });

    it("Should deploy with correct minimum payment", async function () {
      const { santaBonfire } = await loadFixture(deployFixture);
      expect(await santaBonfire.minimumPayment()).to.equal(MINIMUM_PAYMENT);
    });

    it("Should have correct USDC address", async function () {
      const { santaBonfire } = await loadFixture(deployFixture);
      expect(await santaBonfire.usdc()).to.equal(USDC_BASE_MAINNET);
    });

    it("Should deploy with correct NFT name and symbol", async function () {
      const { santaBonfire } = await loadFixture(deployFixture);
      expect(await santaBonfire.name()).to.equal("Santa Bonfire Access");
      expect(await santaBonfire.symbol()).to.equal("SANTA");
    });
  });

  describe("Payment (ERC-3009)", function () {
    it("Should whitelist payer after successful payment", async function () {
      const { santaBonfire, payer } = await loadFixture(deployFixture);

      expect(await santaBonfire.hasPaid(payer.address)).to.equal(false);

      const auth = getAuthorizationParams(payer.address, MINIMUM_PAYMENT);
      await santaBonfire.receivePayment(
        auth.from,
        auth.value,
        auth.validAfter,
        auth.validBefore,
        auth.nonce,
        auth.v,
        auth.r,
        auth.s,
      );

      expect(await santaBonfire.hasPaid(payer.address)).to.equal(true);
      expect(await santaBonfire.isWhitelisted(payer.address)).to.equal(true);
    });

    it("Should emit PaymentReceived event", async function () {
      const { santaBonfire, payer } = await loadFixture(deployFixture);

      const auth = getAuthorizationParams(payer.address, MINIMUM_PAYMENT);
      await expect(
        santaBonfire.receivePayment(
          auth.from,
          auth.value,
          auth.validAfter,
          auth.validBefore,
          auth.nonce,
          auth.v,
          auth.r,
          auth.s,
        ),
      )
        .to.emit(santaBonfire, "PaymentReceived")
        .withArgs(payer.address, MINIMUM_PAYMENT);
    });

    it("Should transfer USDC to contract", async function () {
      const { santaBonfire, usdc, payer } = await loadFixture(deployFixture);

      const payerBalanceBefore = await usdc.balanceOf(payer.address);
      const contractBalanceBefore = await santaBonfire.getBalance();

      const auth = getAuthorizationParams(payer.address, MINIMUM_PAYMENT);
      await santaBonfire.receivePayment(
        auth.from,
        auth.value,
        auth.validAfter,
        auth.validBefore,
        auth.nonce,
        auth.v,
        auth.r,
        auth.s,
      );

      expect(await usdc.balanceOf(payer.address)).to.equal(payerBalanceBefore - MINIMUM_PAYMENT);
      expect(await santaBonfire.getBalance()).to.equal(contractBalanceBefore + MINIMUM_PAYMENT);
    });

    it("Should revert when payment is below minimum", async function () {
      const { santaBonfire, payer } = await loadFixture(deployFixture);

      const lowAmount = MINIMUM_PAYMENT - 1n;
      const auth = getAuthorizationParams(payer.address, lowAmount);

      await expect(
        santaBonfire.receivePayment(
          auth.from,
          auth.value,
          auth.validAfter,
          auth.validBefore,
          auth.nonce,
          auth.v,
          auth.r,
          auth.s,
        ),
      )
        .to.be.revertedWithCustomError(santaBonfire, "PaymentBelowMinimum")
        .withArgs(lowAmount, MINIMUM_PAYMENT);
    });

    it("Should accept payment above minimum", async function () {
      const { santaBonfire, payer } = await loadFixture(deployFixture);

      const highAmount = MINIMUM_PAYMENT * 5n;
      const auth = getAuthorizationParams(payer.address, highAmount);

      await expect(
        santaBonfire.receivePayment(
          auth.from,
          auth.value,
          auth.validAfter,
          auth.validBefore,
          auth.nonce,
          auth.v,
          auth.r,
          auth.s,
        ),
      )
        .to.emit(santaBonfire, "PaymentReceived")
        .withArgs(payer.address, highAmount);

      expect(await santaBonfire.hasPaid(payer.address)).to.equal(true);
    });
  });

  describe("Withdrawal", function () {
    async function deployWithPaymentFixture() {
      const fixture = await loadFixture(deployFixture);
      const { santaBonfire, payer } = fixture;

      // Make a payment first
      const auth = getAuthorizationParams(payer.address, MINIMUM_PAYMENT);
      await santaBonfire.receivePayment(
        auth.from,
        auth.value,
        auth.validAfter,
        auth.validBefore,
        auth.nonce,
        auth.v,
        auth.r,
        auth.s,
      );

      return fixture;
    }

    it("Should allow owner to withdraw USDC", async function () {
      const { santaBonfire, usdc, owner } = await loadFixture(deployWithPaymentFixture);

      const ownerBalanceBefore = await usdc.balanceOf(owner.address);
      const contractBalance = await santaBonfire.getBalance();

      await santaBonfire.connect(owner).withdraw();

      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBalanceBefore + contractBalance);
      expect(await santaBonfire.getBalance()).to.equal(0n);
    });

    it("Should emit Withdrawal event", async function () {
      const { santaBonfire, owner } = await loadFixture(deployWithPaymentFixture);

      const contractBalance = await santaBonfire.getBalance();

      await expect(santaBonfire.connect(owner).withdraw())
        .to.emit(santaBonfire, "Withdrawal")
        .withArgs(owner.address, contractBalance);
    });

    it("Should revert when non-owner tries to withdraw", async function () {
      const { santaBonfire, payer } = await loadFixture(deployWithPaymentFixture);

      await expect(santaBonfire.connect(payer).withdraw())
        .to.be.revertedWithCustomError(santaBonfire, "OwnableUnauthorizedAccount")
        .withArgs(payer.address);
    });

    it("Should revert when there is nothing to withdraw", async function () {
      const { santaBonfire, owner } = await loadFixture(deployFixture);

      await expect(santaBonfire.connect(owner).withdraw()).to.be.revertedWithCustomError(
        santaBonfire,
        "NothingToWithdraw",
      );
    });
  });

  describe("NFT Minting", function () {
    async function deployWithPaymentFixture() {
      const fixture = await loadFixture(deployFixture);
      const { santaBonfire, payer } = fixture;

      // Make a payment first
      const auth = getAuthorizationParams(payer.address, MINIMUM_PAYMENT);
      await santaBonfire.receivePayment(
        auth.from,
        auth.value,
        auth.validAfter,
        auth.validBefore,
        auth.nonce,
        auth.v,
        auth.r,
        auth.s,
      );

      return fixture;
    }

    it("Should allow paid user to mint NFT", async function () {
      const { santaBonfire, payer } = await loadFixture(deployWithPaymentFixture);

      expect(await santaBonfire.canMint(payer.address)).to.equal(true);

      await santaBonfire.connect(payer).mintAccessNFT();

      expect(await santaBonfire.hasMinted(payer.address)).to.equal(true);
      expect(await santaBonfire.hasMintedNFT(payer.address)).to.equal(true);
      expect(await santaBonfire.balanceOf(payer.address)).to.equal(1n);
    });

    it("Should emit NFTMinted event with correct tokenId", async function () {
      const { santaBonfire, payer } = await loadFixture(deployWithPaymentFixture);

      await expect(santaBonfire.connect(payer).mintAccessNFT())
        .to.emit(santaBonfire, "NFTMinted")
        .withArgs(payer.address, 1n);
    });

    it("Should increment token counter correctly", async function () {
      const { santaBonfire, usdc, payer, otherAccount } = await loadFixture(deployWithPaymentFixture);

      // Mint USDC to otherAccount and make payment
      await usdc.mint(otherAccount.address, 100_000_000n);
      const auth = getAuthorizationParams(otherAccount.address, MINIMUM_PAYMENT);
      await santaBonfire.receivePayment(
        auth.from,
        auth.value,
        auth.validAfter,
        auth.validBefore,
        auth.nonce,
        auth.v,
        auth.r,
        auth.s,
      );

      // Both users mint
      await santaBonfire.connect(payer).mintAccessNFT();
      await santaBonfire.connect(otherAccount).mintAccessNFT();

      expect(await santaBonfire.totalMinted()).to.equal(2n);
    });

    it("Should revert when non-paid user tries to mint", async function () {
      const { santaBonfire, otherAccount } = await loadFixture(deployFixture);

      expect(await santaBonfire.canMint(otherAccount.address)).to.equal(false);

      await expect(santaBonfire.connect(otherAccount).mintAccessNFT()).to.be.revertedWithCustomError(
        santaBonfire,
        "NotWhitelisted",
      );
    });

    it("Should revert when user tries to mint twice", async function () {
      const { santaBonfire, payer } = await loadFixture(deployWithPaymentFixture);

      // First mint succeeds
      await santaBonfire.connect(payer).mintAccessNFT();

      expect(await santaBonfire.canMint(payer.address)).to.equal(false);

      // Second mint fails
      await expect(santaBonfire.connect(payer).mintAccessNFT()).to.be.revertedWithCustomError(
        santaBonfire,
        "AlreadyMinted",
      );
    });
  });

  describe("Multi-Payment Flow", function () {
    it("Should handle pay -> mint -> pay -> mint flow (second mint reverts)", async function () {
      const { santaBonfire, payer } = await loadFixture(deployFixture);

      // First payment
      const auth1 = getAuthorizationParams(payer.address, MINIMUM_PAYMENT);
      await santaBonfire.receivePayment(
        auth1.from,
        auth1.value,
        auth1.validAfter,
        auth1.validBefore,
        auth1.nonce,
        auth1.v,
        auth1.r,
        auth1.s,
      );

      expect(await santaBonfire.hasPaid(payer.address)).to.equal(true);

      // First mint succeeds
      await santaBonfire.connect(payer).mintAccessNFT();
      expect(await santaBonfire.hasMinted(payer.address)).to.equal(true);
      expect(await santaBonfire.balanceOf(payer.address)).to.equal(1n);

      // Second payment (different nonce)
      const auth2 = getAuthorizationParams(payer.address, MINIMUM_PAYMENT);
      await santaBonfire.receivePayment(
        auth2.from,
        auth2.value,
        auth2.validAfter,
        auth2.validBefore,
        auth2.nonce,
        auth2.v,
        auth2.r,
        auth2.s,
      );

      // User is still whitelisted
      expect(await santaBonfire.hasPaid(payer.address)).to.equal(true);

      // Second mint reverts - user already minted
      await expect(santaBonfire.connect(payer).mintAccessNFT()).to.be.revertedWithCustomError(
        santaBonfire,
        "AlreadyMinted",
      );

      // Balance should still be 1 NFT
      expect(await santaBonfire.balanceOf(payer.address)).to.equal(1n);
    });

    it("Should allow multiple payments from same address but only one mint", async function () {
      const { santaBonfire, usdc, payer } = await loadFixture(deployFixture);

      const initialBalance = await usdc.balanceOf(payer.address);

      // Make 3 payments
      for (let i = 0; i < 3; i++) {
        const auth = getAuthorizationParams(payer.address, MINIMUM_PAYMENT);
        await santaBonfire.receivePayment(
          auth.from,
          auth.value,
          auth.validAfter,
          auth.validBefore,
          auth.nonce,
          auth.v,
          auth.r,
          auth.s,
        );
      }

      // Contract should have received all 3 payments
      expect(await santaBonfire.getBalance()).to.equal(MINIMUM_PAYMENT * 3n);
      expect(await usdc.balanceOf(payer.address)).to.equal(initialBalance - MINIMUM_PAYMENT * 3n);

      // User should be whitelisted
      expect(await santaBonfire.hasPaid(payer.address)).to.equal(true);

      // Only one mint should succeed
      await santaBonfire.connect(payer).mintAccessNFT();
      expect(await santaBonfire.balanceOf(payer.address)).to.equal(1n);

      // Additional mint attempts should fail
      await expect(santaBonfire.connect(payer).mintAccessNFT()).to.be.revertedWithCustomError(
        santaBonfire,
        "AlreadyMinted",
      );
    });

    it("Should track contract balance correctly across multiple payments and withdrawals", async function () {
      const { santaBonfire, usdc, owner, payer, otherAccount } = await loadFixture(deployFixture);

      // Mint USDC to otherAccount
      await usdc.mint(otherAccount.address, 100_000_000n);

      // Payment from payer
      const auth1 = getAuthorizationParams(payer.address, MINIMUM_PAYMENT * 2n);
      await santaBonfire.receivePayment(
        auth1.from,
        auth1.value,
        auth1.validAfter,
        auth1.validBefore,
        auth1.nonce,
        auth1.v,
        auth1.r,
        auth1.s,
      );

      expect(await santaBonfire.getBalance()).to.equal(MINIMUM_PAYMENT * 2n);

      // Payment from otherAccount
      const auth2 = getAuthorizationParams(otherAccount.address, MINIMUM_PAYMENT * 3n);
      await santaBonfire.receivePayment(
        auth2.from,
        auth2.value,
        auth2.validAfter,
        auth2.validBefore,
        auth2.nonce,
        auth2.v,
        auth2.r,
        auth2.s,
      );

      expect(await santaBonfire.getBalance()).to.equal(MINIMUM_PAYMENT * 5n);

      // Owner withdraws
      const ownerBalanceBefore = await usdc.balanceOf(owner.address);
      await santaBonfire.connect(owner).withdraw();

      expect(await santaBonfire.getBalance()).to.equal(0n);
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBalanceBefore + MINIMUM_PAYMENT * 5n);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update minimum payment", async function () {
      const { santaBonfire, owner } = await loadFixture(deployFixture);

      const newMinimum = 5_000_000n; // 5 USDC

      await expect(santaBonfire.connect(owner).setMinimumPayment(newMinimum))
        .to.emit(santaBonfire, "MinimumPaymentUpdated")
        .withArgs(MINIMUM_PAYMENT, newMinimum);

      expect(await santaBonfire.minimumPayment()).to.equal(newMinimum);
    });

    it("Should revert when non-owner tries to update minimum payment", async function () {
      const { santaBonfire, payer } = await loadFixture(deployFixture);

      await expect(santaBonfire.connect(payer).setMinimumPayment(5_000_000n))
        .to.be.revertedWithCustomError(santaBonfire, "OwnableUnauthorizedAccount")
        .withArgs(payer.address);
    });

    it("Should allow owner to update base URI", async function () {
      const { santaBonfire, owner } = await loadFixture(deployFixture);

      const newURI = "https://new-api.santabonfire.com/nft/";

      await expect(santaBonfire.connect(owner).setBaseURI(newURI))
        .to.emit(santaBonfire, "BaseURIUpdated")
        .withArgs(BASE_URI, newURI);
    });

    it("Should revert when non-owner tries to update base URI", async function () {
      const { santaBonfire, payer } = await loadFixture(deployFixture);

      await expect(santaBonfire.connect(payer).setBaseURI("https://malicious.com/"))
        .to.be.revertedWithCustomError(santaBonfire, "OwnableUnauthorizedAccount")
        .withArgs(payer.address);
    });
  });
});
