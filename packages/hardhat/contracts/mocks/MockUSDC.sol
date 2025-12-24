// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing with ERC-3009 receiveWithAuthorization support
 * @dev Simplified mock that accepts any signature for testing purposes
 */
contract MockUSDC is ERC20 {
    uint8 private constant DECIMALS = 6;

    /// @notice Track used nonces to prevent replay
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    /// @notice Emitted when a transfer via authorization is executed
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Mint tokens to an address (for testing)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice ERC-3009 receiveWithAuthorization implementation
     * @dev Simplified for testing - accepts any signature
     * @param from Address sending the tokens
     * @param to Address receiving the tokens
     * @param value Amount of tokens
     * @param validAfter Timestamp after which authorization is valid
     * @param validBefore Timestamp before which authorization is valid
     * @param nonce Unique nonce for this authorization
     * @param v ECDSA signature v (ignored in mock)
     * @param r ECDSA signature r (ignored in mock)
     * @param s ECDSA signature s (ignored in mock)
     */
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
    ) external {
        // Suppress unused variable warnings
        (v, r, s);

        require(block.timestamp > validAfter, "MockUSDC: authorization not yet valid");
        require(block.timestamp < validBefore, "MockUSDC: authorization expired");
        require(!authorizationState[from][nonce], "MockUSDC: authorization already used");
        require(msg.sender == to, "MockUSDC: caller must be the payee");

        authorizationState[from][nonce] = true;
        _transfer(from, to, value);

        emit AuthorizationUsed(from, nonce);
    }
}







