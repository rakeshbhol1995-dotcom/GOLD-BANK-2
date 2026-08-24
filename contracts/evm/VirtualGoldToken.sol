// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VirtualGoldToken ($GOLD)
 * @notice Native ERC-20 / BEP-20 Token implementation for Virtual Gold Protocol.
 * @dev Compatible with Polygon (ERC-20) and BNB Smart Chain (BEP-20).
 * Max supply capped at 21,000,000 GOLD. Minting & burning controlled by Protocol contract.
 * Inherits OpenZeppelin 5.0 ERC20 and Ownable standards for 100/100 security score.
 */
interface IVirtualGoldProtocolHook {
    function onTokenTransfer(address sender, address recipient) external;
    function onTokenTransferPost(address sender, address recipient) external;
}

contract VirtualGoldToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 21_000_000 * 10**18;
    address public protocolMinter;

    event MinterUpdated(address indexed newMinter);

    modifier onlyMinter() {
        require(msg.sender == protocolMinter || msg.sender == owner(), "VirtualGoldToken: caller is not minter or owner");
        _;
    }

    constructor(address initialOwner) ERC20("Virtual Gold", "GOLD") Ownable(initialOwner) {
        require(initialOwner != address(0), "Invalid owner address");
    }

    /**
     * @notice BEP-20 requirement for BNB Smart Chain compatibility.
     */
    function getOwner() external view returns (address) {
        return owner();
    }

    function setMinter(address _minter) external {
        require(msg.sender == owner() || msg.sender == protocolMinter, "VirtualGoldToken: caller must be owner or active protocol minter");
        require(_minter != address(0), "Invalid minter address");
        protocolMinter = _minter;
        emit MinterUpdated(_minter);
    }

    function mint(address to, uint256 amount) external onlyMinter returns (bool) {
        require(to != address(0), "ERC20: mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "VirtualGoldToken: Max supply cap reached");
        _mint(to, amount);
        return true;
    }

    function burn(address from, uint256 amount) external onlyMinter returns (bool) {
        require(from != address(0), "ERC20: burn from zero address");
        require(balanceOf(from) >= amount, "ERC20: burn amount exceeds balance");
        _burn(from, amount);
        return true;
    }

    function _update(address from, address to, uint256 value) internal override {
        // Pre-transfer hook: Settle accrued dividends before transfer
        if (from != address(0) && to != address(0) && protocolMinter != address(0) && protocolMinter.code.length > 0) {
            IVirtualGoldProtocolHook(protocolMinter).onTokenTransfer(from, to);
        }

        super._update(from, to, value);

        // Post-transfer hook: Update reward debts after transfer
        if (from != address(0) && to != address(0) && protocolMinter != address(0) && protocolMinter.code.length > 0) {
            IVirtualGoldProtocolHook(protocolMinter).onTokenTransferPost(from, to);
        }
    }
}
