// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title IERC3009
 * @notice Minimal interface for ERC-3009 receiveWithAuthorization
 */
interface IERC3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/**
 * @title SantaBonfirePayment
 * @notice Accepts USDC payments via ERC-3009 receiveWithAuthorization, maintains a whitelist of paid addresses,
 *         and allows paid users to mint an access NFT
 * @dev Uses OpenZeppelin Ownable for access control and ERC721 for NFT functionality
 */
contract SantaBonfirePayment is Ownable, ERC721 {
    /// @notice USDC token contract (Base mainnet)
    IERC20 public immutable usdc;

    /// @notice ERC-3009 interface for USDC
    IERC3009 public immutable usdc3009;

    /// @notice Base mainnet USDC address
    address public constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    /// @notice Minimum payment amount required (in USDC smallest units, 6 decimals)
    uint256 public minimumPayment;

    /// @notice Mapping of addresses that have paid
    mapping(address => bool) public hasPaid;

    /// @notice Mapping of addresses that have minted their NFT
    mapping(address => bool) public hasMinted;

    /// @notice Counter for generating unique token IDs
    uint256 private _tokenIdCounter;

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Emitted when a payment is received
    event PaymentReceived(address indexed payer, uint256 amount);

    /// @notice Emitted when the owner withdraws USDC
    event Withdrawal(address indexed owner, uint256 amount);

    /// @notice Emitted when minimum payment is updated
    event MinimumPaymentUpdated(uint256 oldAmount, uint256 newAmount);

    /// @notice Emitted when an NFT is successfully minted
    event NFTMinted(address indexed recipient, uint256 indexed tokenId);

    /// @notice Emitted when base URI is updated
    event BaseURIUpdated(string oldURI, string newURI);

    /// @notice Error when payment amount is below minimum
    error PaymentBelowMinimum(uint256 sent, uint256 required);

    /// @notice Error when withdrawal fails
    error WithdrawalFailed();

    /// @notice Error when there's nothing to withdraw
    error NothingToWithdraw();

    /// @notice Error when caller hasn't paid
    error NotWhitelisted();

    /// @notice Error when caller already minted their NFT
    error AlreadyMinted();

    /**
     * @notice Constructor
     * @param _owner Initial owner address
     * @param _minimumPayment Minimum payment amount in USDC (6 decimals)
     * @param baseURI Base URI for token metadata
     */
    constructor(
        address _owner,
        uint256 _minimumPayment,
        string memory baseURI
    ) Ownable(_owner) ERC721("Santa Bonfire Access", "SANTA") {
        usdc = IERC20(USDC_BASE_MAINNET);
        usdc3009 = IERC3009(USDC_BASE_MAINNET);
        minimumPayment = _minimumPayment;
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Receive USDC payment via ERC-3009 receiveWithAuthorization
     * @param from Address sending the USDC
     * @param value Amount of USDC to transfer (6 decimals)
     * @param validAfter Timestamp after which the authorization is valid
     * @param validBefore Timestamp before which the authorization is valid
     * @param nonce Unique nonce for the authorization
     * @param v ECDSA signature v component
     * @param r ECDSA signature r component
     * @param s ECDSA signature s component
     */
    function receivePayment(
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (value < minimumPayment) {
            revert PaymentBelowMinimum(value, minimumPayment);
        }

        // Call USDC's receiveWithAuthorization - transfers tokens to this contract
        usdc3009.receiveWithAuthorization(
            from,
            address(this),
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        // Add payer to whitelist
        hasPaid[from] = true;

        emit PaymentReceived(from, value);
    }

    /**
     * @notice Mint an access NFT for whitelisted addresses
     * @dev Caller must have paid and not already minted
     */
    function mintAccessNFT() external {
        if (!hasPaid[msg.sender]) {
            revert NotWhitelisted();
        }

        if (hasMinted[msg.sender]) {
            revert AlreadyMinted();
        }

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(msg.sender, tokenId);
        hasMinted[msg.sender] = true;

        emit NFTMinted(msg.sender, tokenId);
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
     * @notice Check if an address is whitelisted (has paid)
     * @param account Address to check
     * @return True if address has paid
     */
    function isWhitelisted(address account) external view returns (bool) {
        return hasPaid[account];
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
     * @notice Check if an address can mint an NFT
     * @param account Address to check
     * @return True if account has paid but not yet minted
     */
    function canMint(address account) external view returns (bool) {
        return hasPaid[account] && !hasMinted[account];
    }

    /**
     * @notice Update minimum payment amount
     * @param _minimumPayment New minimum payment amount
     * @dev Only callable by owner
     */
    function setMinimumPayment(uint256 _minimumPayment) external onlyOwner {
        uint256 oldAmount = minimumPayment;
        minimumPayment = _minimumPayment;
        emit MinimumPaymentUpdated(oldAmount, _minimumPayment);
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
