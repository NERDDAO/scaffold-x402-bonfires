import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { HyperBlogNFT } from "../typechain-types";

describe("HyperBlogNFT", function () {
  const BASE_URI = "https://api.delve.xyz/nft/metadata/";
  const NFT_NAME = "HyperBlog NFT";
  const NFT_SYMBOL = "HBLOG";

  async function deployFixture() {
    const [owner, admin, user1, user2] = await ethers.getSigners();

    const HyperBlogNFTFactory = await ethers.getContractFactory("HyperBlogNFT");
    const hyperBlogNFT = (await HyperBlogNFTFactory.deploy(
      owner.address,
      admin.address,
      NFT_NAME,
      NFT_SYMBOL,
      BASE_URI,
    )) as HyperBlogNFT;
    await hyperBlogNFT.waitForDeployment();

    return { hyperBlogNFT, owner, admin, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should deploy with correct owner", async function () {
      const { hyperBlogNFT, owner } = await loadFixture(deployFixture);
      expect(await hyperBlogNFT.owner()).to.equal(owner.address);
    });

    it("Should deploy with correct admin", async function () {
      const { hyperBlogNFT, admin } = await loadFixture(deployFixture);
      expect(await hyperBlogNFT.admin()).to.equal(admin.address);
    });

    it("Should deploy with correct NFT name and symbol", async function () {
      const { hyperBlogNFT } = await loadFixture(deployFixture);
      expect(await hyperBlogNFT.name()).to.equal(NFT_NAME);
      expect(await hyperBlogNFT.symbol()).to.equal(NFT_SYMBOL);
    });

    it("Should deploy with correct base URI", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);
      // Mint to check tokenURI includes baseURI
      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 1);
      expect(await hyperBlogNFT.tokenURI(1)).to.equal(BASE_URI + "1");
    });
  });

  describe("Minting Functionality", function () {
    it("Should allow admin to mint NFT with hyperblog ID", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 123);

      expect(await hyperBlogNFT.balanceOf(user1.address)).to.equal(1n);
      expect(await hyperBlogNFT.ownerOf(1)).to.equal(user1.address);
    });

    it("Should emit HyperBlogNFTMinted event with correct parameters", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);

      await expect(hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 123))
        .to.emit(hyperBlogNFT, "HyperBlogNFTMinted")
        .withArgs(user1.address, 1n, 123n);
    });

    it("Should increment token ID counter", async function () {
      const { hyperBlogNFT, admin, user1, user2 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 100);
      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user2.address, 200);

      expect(await hyperBlogNFT.totalMinted()).to.equal(2n);
      expect(await hyperBlogNFT.ownerOf(1)).to.equal(user1.address);
      expect(await hyperBlogNFT.ownerOf(2)).to.equal(user2.address);
    });

    it("Should revert when non-admin tries to mint", async function () {
      const { hyperBlogNFT, user1, user2 } = await loadFixture(deployFixture);

      await expect(hyperBlogNFT.connect(user1).mintHyperBlogNFT(user2.address, 1)).to.be.revertedWithCustomError(
        hyperBlogNFT,
        "NotAdmin",
      );
    });

    it("Should revert when owner tries to mint (owner is not admin)", async function () {
      const { hyperBlogNFT, owner, user1 } = await loadFixture(deployFixture);

      await expect(hyperBlogNFT.connect(owner).mintHyperBlogNFT(user1.address, 1)).to.be.revertedWithCustomError(
        hyperBlogNFT,
        "NotAdmin",
      );
    });

    it("Should revert when minting to zero address", async function () {
      const { hyperBlogNFT, admin } = await loadFixture(deployFixture);

      await expect(hyperBlogNFT.connect(admin).mintHyperBlogNFT(ethers.ZeroAddress, 1)).to.be.revertedWithCustomError(
        hyperBlogNFT,
        "InvalidRecipient",
      );
    });

    it("Should revert when hyperblog ID is zero", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);

      await expect(hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 0)).to.be.revertedWithCustomError(
        hyperBlogNFT,
        "InvalidHyperBlogId",
      );
    });

    it("Should revert when hyperblog ID already minted", async function () {
      const { hyperBlogNFT, admin, user1, user2 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 123);

      await expect(hyperBlogNFT.connect(admin).mintHyperBlogNFT(user2.address, 123))
        .to.be.revertedWithCustomError(hyperBlogNFT, "HyperBlogAlreadyMinted")
        .withArgs(123n);
    });
  });

  describe("Hyperblog ID to Token ID Mapping", function () {
    it("Should correctly map hyperblog ID to token ID", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 123);

      expect(await hyperBlogNFT.getTokenIdByHyperBlogId(123)).to.equal(1n);
    });

    it("Should correctly map token ID to hyperblog ID (reverse lookup)", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 123);

      expect(await hyperBlogNFT.getHyperBlogIdByTokenId(1)).to.equal(123n);
    });

    it("Should return zero for unminted hyperblog ID", async function () {
      const { hyperBlogNFT } = await loadFixture(deployFixture);

      expect(await hyperBlogNFT.getTokenIdByHyperBlogId(999)).to.equal(0n);
    });

    it("Should track minted status via hasHyperBlogMinted", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);

      expect(await hyperBlogNFT.hasHyperBlogMinted(123)).to.equal(false);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 123);

      expect(await hyperBlogNFT.hasHyperBlogMinted(123)).to.equal(true);
    });

    it("Should return correct info via getHyperBlogNFTInfo", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 123);

      const [minted, tokenId, nftOwner, uri] = await hyperBlogNFT.getHyperBlogNFTInfo(123);

      expect(minted).to.equal(true);
      expect(tokenId).to.equal(1n);
      expect(nftOwner).to.equal(user1.address);
      expect(uri).to.equal(BASE_URI + "1");
    });

    it("Should return empty info for unminted hyperblog ID", async function () {
      const { hyperBlogNFT } = await loadFixture(deployFixture);

      const [minted, tokenId, nftOwner, uri] = await hyperBlogNFT.getHyperBlogNFTInfo(999);

      expect(minted).to.equal(false);
      expect(tokenId).to.equal(0n);
      expect(nftOwner).to.equal(ethers.ZeroAddress);
      expect(uri).to.equal("");
    });

    it("Should handle multiple mints with different hyperblog IDs", async function () {
      const { hyperBlogNFT, admin, user1, user2 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 1);
      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 2);
      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user2.address, 3);

      expect(await hyperBlogNFT.totalMinted()).to.equal(3n);

      expect(await hyperBlogNFT.getTokenIdByHyperBlogId(1)).to.equal(1n);
      expect(await hyperBlogNFT.getTokenIdByHyperBlogId(2)).to.equal(2n);
      expect(await hyperBlogNFT.getTokenIdByHyperBlogId(3)).to.equal(3n);

      expect(await hyperBlogNFT.getHyperBlogIdByTokenId(1)).to.equal(1n);
      expect(await hyperBlogNFT.getHyperBlogIdByTokenId(2)).to.equal(2n);
      expect(await hyperBlogNFT.getHyperBlogIdByTokenId(3)).to.equal(3n);

      expect(await hyperBlogNFT.balanceOf(user1.address)).to.equal(2n);
      expect(await hyperBlogNFT.balanceOf(user2.address)).to.equal(1n);
    });
  });

  describe("Token URI Resolution", function () {
    it("Should return correct token URI using baseURI + tokenId", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 123);

      expect(await hyperBlogNFT.tokenURI(1)).to.equal(BASE_URI + "1");
    });

    it("Should update token URIs when base URI is changed", async function () {
      const { hyperBlogNFT, owner, admin, user1 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(admin).mintHyperBlogNFT(user1.address, 123);
      expect(await hyperBlogNFT.tokenURI(1)).to.equal(BASE_URI + "1");

      const newURI = "ipfs://QmNew/";
      await hyperBlogNFT.connect(owner).setBaseURI(newURI);

      expect(await hyperBlogNFT.tokenURI(1)).to.equal(newURI + "1");
    });

    it("Should revert for non-existent token", async function () {
      const { hyperBlogNFT } = await loadFixture(deployFixture);

      await expect(hyperBlogNFT.tokenURI(999)).to.be.revertedWithCustomError(hyperBlogNFT, "ERC721NonexistentToken");
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to set admin", async function () {
      const { hyperBlogNFT, owner, user1 } = await loadFixture(deployFixture);

      await hyperBlogNFT.connect(owner).setAdmin(user1.address);

      expect(await hyperBlogNFT.admin()).to.equal(user1.address);
    });

    it("Should emit AdminUpdated event", async function () {
      const { hyperBlogNFT, owner, admin, user1 } = await loadFixture(deployFixture);

      await expect(hyperBlogNFT.connect(owner).setAdmin(user1.address))
        .to.emit(hyperBlogNFT, "AdminUpdated")
        .withArgs(admin.address, user1.address);
    });

    it("Should revert when non-owner tries to set admin", async function () {
      const { hyperBlogNFT, admin, user1 } = await loadFixture(deployFixture);

      await expect(hyperBlogNFT.connect(admin).setAdmin(user1.address))
        .to.be.revertedWithCustomError(hyperBlogNFT, "OwnableUnauthorizedAccount")
        .withArgs(admin.address);
    });

    it("Should allow owner to update base URI", async function () {
      const { hyperBlogNFT, owner } = await loadFixture(deployFixture);

      const newURI = "ipfs://QmNew/";
      await hyperBlogNFT.connect(owner).setBaseURI(newURI);

      // Mint to verify new URI
      const admin = await hyperBlogNFT.admin();
      const adminSigner = await ethers.getSigner(admin);
      const [, , user1] = await ethers.getSigners();
      await hyperBlogNFT.connect(adminSigner).mintHyperBlogNFT(user1.address, 1);

      expect(await hyperBlogNFT.tokenURI(1)).to.equal(newURI + "1");
    });

    it("Should emit BaseURIUpdated event", async function () {
      const { hyperBlogNFT, owner } = await loadFixture(deployFixture);

      const newURI = "ipfs://QmNew/";
      await expect(hyperBlogNFT.connect(owner).setBaseURI(newURI))
        .to.emit(hyperBlogNFT, "BaseURIUpdated")
        .withArgs(BASE_URI, newURI);
    });

    it("Should revert when non-owner tries to update base URI", async function () {
      const { hyperBlogNFT, admin } = await loadFixture(deployFixture);

      await expect(hyperBlogNFT.connect(admin).setBaseURI("ipfs://QmNew/"))
        .to.be.revertedWithCustomError(hyperBlogNFT, "OwnableUnauthorizedAccount")
        .withArgs(admin.address);
    });

    it("Should allow new admin to mint after admin change", async function () {
      const { hyperBlogNFT, owner, admin, user1, user2 } = await loadFixture(deployFixture);

      // Change admin
      await hyperBlogNFT.connect(owner).setAdmin(user1.address);

      // Old admin should not be able to mint
      await expect(hyperBlogNFT.connect(admin).mintHyperBlogNFT(user2.address, 1)).to.be.revertedWithCustomError(
        hyperBlogNFT,
        "NotAdmin",
      );

      // New admin should be able to mint
      await hyperBlogNFT.connect(user1).mintHyperBlogNFT(user2.address, 1);
      expect(await hyperBlogNFT.balanceOf(user2.address)).to.equal(1n);
    });
  });
});
