// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title HyperBlogNFT
 * @notice NFT contract for minting HyperBlog tokens with bidirectional hyperblog-to-token tracking
 * @dev Uses mutable baseURI for metadata resolution. Backend updates pinned IPFS/Arweave content at baseURI/{tokenId}.json
 */
contract HyperBlogNFT is Ownable, ERC721 {
    /// @notice Admin address authorized to mint NFTs
    address public admin;

    /// @notice Counter for generating unique token IDs
    uint256 private _tokenIdCounter;

    /// @notice Mapping from hyperblog ID to token ID
    mapping(uint256 => uint256) private _hyperblogIdToTokenId;

    /// @notice Mapping from token ID to hyperblog ID
    mapping(uint256 => uint256) private _tokenIdToHyperblogId;

    /// @notice Mapping to track which hyperblog IDs have been minted
    mapping(uint256 => bool) private _hyperblogMinted;

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Emitted when a HyperBlog NFT is minted
    event HyperBlogNFTMinted(address indexed recipient, uint256 indexed tokenId, uint256 indexed hyperblogId);

    /// @notice Emitted when admin is updated
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    /// @notice Emitted when base URI is updated
    event BaseURIUpdated(string oldURI, string newURI);

    /// @notice Error when caller is not admin
    error NotAdmin();

    /// @notice Error when hyperblog has already been minted
    error HyperBlogAlreadyMinted(uint256 hyperblogId);

    /// @notice Error when hyperblog ID is invalid (zero)
    error InvalidHyperBlogId();

    /// @notice Error when recipient address is invalid (zero address)
    error InvalidRecipient();

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
     * @param name Token name
     * @param symbol Token symbol
     * @param baseURI Base URI for token metadata
     */
    constructor(
        address _owner,
        address _admin,
        string memory name,
        string memory symbol,
        string memory baseURI
    ) Ownable(_owner) ERC721(name, symbol) {
        admin = _admin;
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Mint a HyperBlog NFT to a recipient
     * @param to Address to receive the NFT
     * @param hyperblogId The hyperblog ID to associate with this NFT
     * @dev Only callable by admin. Each hyperblog can only be minted once.
     */
    function mintHyperBlogNFT(address to, uint256 hyperblogId) external onlyAdmin {
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        if (hyperblogId == 0) {
            revert InvalidHyperBlogId();
        }
        if (_hyperblogMinted[hyperblogId]) {
            revert HyperBlogAlreadyMinted(hyperblogId);
        }

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _hyperblogIdToTokenId[hyperblogId] = tokenId;
        _tokenIdToHyperblogId[tokenId] = hyperblogId;
        _hyperblogMinted[hyperblogId] = true;

        _safeMint(to, tokenId);

        emit HyperBlogNFTMinted(to, tokenId, hyperblogId);
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
     * @notice Get token ID by hyperblog ID
     * @param hyperblogId The hyperblog ID to lookup
     * @return The token ID associated with the hyperblog (0 if not minted)
     */
    function getTokenIdByHyperBlogId(uint256 hyperblogId) external view returns (uint256) {
        return _hyperblogIdToTokenId[hyperblogId];
    }

    /**
     * @notice Get hyperblog ID by token ID
     * @param tokenId The token ID to lookup
     * @return The hyperblog ID associated with the token (0 if not found)
     */
    function getHyperBlogIdByTokenId(uint256 tokenId) external view returns (uint256) {
        return _tokenIdToHyperblogId[tokenId];
    }

    /**
     * @notice Check if a hyperblog has been minted
     * @param hyperblogId The hyperblog ID to check
     * @return True if the hyperblog has been minted
     */
    function hasHyperBlogMinted(uint256 hyperblogId) external view returns (bool) {
        return _hyperblogMinted[hyperblogId];
    }

    /**
     * @notice Get the total number of NFTs minted
     * @return Current token counter value
     */
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @notice Get full information about a HyperBlog NFT
     * @param hyperblogId The hyperblog ID to query
     * @return minted Whether the hyperblog has been minted
     * @return tokenId The token ID (0 if not minted)
     * @return owner The owner address (zero address if not minted)
     * @return uri The token URI (empty if not minted)
     */
    function getHyperBlogNFTInfo(uint256 hyperblogId) external view returns (
        bool minted,
        uint256 tokenId,
        address owner,
        string memory uri
    ) {
        minted = _hyperblogMinted[hyperblogId];
        if (minted) {
            tokenId = _hyperblogIdToTokenId[hyperblogId];
            owner = ownerOf(tokenId);
            uri = tokenURI(tokenId);
        }
    }

    /**
     * @notice Override base URI for token metadata
     * @return Base URI string
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}







