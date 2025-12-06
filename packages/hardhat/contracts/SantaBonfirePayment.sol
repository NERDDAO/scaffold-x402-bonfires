// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title SantaBonfirePayment
 * @notice Accepts USDC payments via x402 (off-chain verification) and allows admin to mint access NFTs
 * @dev Owner can set admin and withdraw. Admin can mint NFTs.
 */
contract SantaBonfirePayment is Ownable, ERC721 {
    /// @notice USDC token contract (Base mainnet)
    IERC20 public immutable usdc;

    /// @notice Base mainnet USDC address
    address public constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    /// @notice Admin address authorized to mint NFTs
    address public admin;

    /// @notice Mapping of addresses that have minted their NFT
    mapping(address => bool) public hasMinted;

    /// @notice Counter for generating unique token IDs
    uint256 private _tokenIdCounter;

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Emitted when the owner withdraws USDC
    event Withdrawal(address indexed owner, uint256 amount);

    /// @notice Emitted when an NFT is successfully minted
    event NFTMinted(address indexed recipient, uint256 indexed tokenId);

    /// @notice Emitted when base URI is updated
    event BaseURIUpdated(string oldURI, string newURI);

    /// @notice Emitted when admin is updated
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    /// @notice Error when withdrawal fails
    error WithdrawalFailed();

    /// @notice Error when there's nothing to withdraw
    error NothingToWithdraw();

    /// @notice Error when recipient already minted their NFT
    error AlreadyMinted();

    /// @notice Error when caller is not admin
    error NotAdmin();

    /// @notice Modifier to restrict function to admin only
    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert NotAdmin();
        }
        _;
    }

    /**
     * @notice Constructor
     * @param _owner Initial owner address
     * @param _admin Initial admin address
     * @param baseURI Base URI for token metadata
     */
    constructor(
        address _owner,
        address _admin,
        string memory baseURI
    ) Ownable(_owner) ERC721("Santa Bonfire Access", "SANTA") {
        usdc = IERC20(USDC_BASE_MAINNET);
        admin = _admin;
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Admin mints NFT directly to a recipient
     * @param to Address to receive the NFT
     * @dev Only callable by admin. Use after verifying x402 payment off-chain.
     */
    function mint(address to) external onlyAdmin {
        if (hasMinted[to]) {
            revert AlreadyMinted();
        }

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        hasMinted[to] = true;
        _safeMint(to, tokenId);

        emit NFTMinted(to, tokenId);
    }

    /**
     * @notice Admin batch mints NFTs to multiple recipients
     * @param recipients Array of addresses to receive NFTs
     * @dev Only callable by admin. Skips addresses that already minted.
     */
    function mintBatch(address[] calldata recipients) external onlyAdmin {
        for (uint256 i = 0; i < recipients.length; i++) {
            address to = recipients[i];
            if (!hasMinted[to]) {
                _tokenIdCounter++;
                uint256 tokenId = _tokenIdCounter;

                hasMinted[to] = true;
                _safeMint(to, tokenId);

                emit NFTMinted(to, tokenId);
            }
        }
    }

    /**
     * @notice Set admin address
     * @param _admin New admin address
     * @dev Only callable by owner
     */
    function setAdmin(address _admin) external onlyOwner {
        address oldAdmin = admin;
        admin = _admin;
        emit AdminUpdated(oldAdmin, _admin);
    }

    /**
     * @notice Withdraw all USDC proceeds to owner
     * @dev Only callable by owner
     */
    function withdraw() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));

        if (balance == 0) {
            revert NothingToWithdraw();
        }

        bool success = usdc.transfer(owner(), balance);
        if (!success) {
            revert WithdrawalFailed();
        }

        emit Withdrawal(owner(), balance);
    }

    /**
     * @notice Check if an address has minted their NFT
     * @param account Address to check
     * @return True if address has minted
     */
    function hasMintedNFT(address account) external view returns (bool) {
        return hasMinted[account];
    }

    /**
     * @notice Get the total number of NFTs minted
     * @return Current token counter value
     */
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @notice Update base URI for token metadata
     * @param baseURI New base URI
     * @dev Only callable by owner
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        string memory oldURI = _baseTokenURI;
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(oldURI, baseURI);
    }

    /**
     * @notice Get contract's USDC balance
     * @return Current USDC balance
     */
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Override base URI for token metadata
     * @return Base URI string
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
