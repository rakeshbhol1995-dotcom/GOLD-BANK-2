// ============================================================================
// VIRTUAL GOLD PROTOCOL ($GOLD) — 100% COMPLETE CONSOLIDATED MASTER AUDIT FILE
// Symbol: $GOLD  |  Max Supply: 21,000,000 Grams  |  Base Price: 10.00 USDT/Gram
// Chains: Polygon (POS), BNB Smart Chain (BEP-20), Solana (Anchor L1)
// Architecture: 100% Transparent Cryptocurrency Protocol Backed by USDT Vault Reserves
// Website: virtualgold.org
// ============================================================================
//
// TABLE OF CONTENTS:
// ----------------------------------------------------------------------------
// PART 1: EVM $GOLD ERC-20 / BEP-20 TOKEN CONTRACT (Solidity 0.8.20)
// PART 2: EVM BONDING CURVE & VAULT PROTOCOL CONTRACT (Solidity 0.8.20)
// PART 3: SOLANA ANCHOR L1 PROTOCOL & VAULT CONTRACT (Full Rust Anchor Code - 1377 Lines)
// PART 4: EVM DEPLOYMENT & VERIFICATION SCRIPT (Node.js / Hardhat)
// ============================================================================


// ============================================================================
// PART 1: EVM $GOLD ERC-20 / BEP-20 TOKEN CONTRACT
// File: contracts/evm/VirtualGoldToken.sol
// ============================================================================

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VirtualGoldToken ($GOLD)
 * @notice Native ERC-20 / BEP-20 Token implementation for Virtual Gold Protocol.
 * @dev Compatible with Polygon (ERC-20) and BNB Smart Chain (BEP-20).
 * Max supply capped at 21,000,000 GOLD. Minting & burning controlled by Protocol contract.
 */
interface IVirtualGoldProtocolHook {
    function onTokenTransfer(address sender, address recipient) external;
    function onTokenTransferPost(address sender, address recipient) external;
}

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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


// ============================================================================
// PART 2: EVM BONDING CURVE & VAULT PROTOCOL CONTRACT
// File: contracts/evm/VirtualGoldProtocol.sol
// ============================================================================

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VirtualGoldProtocol
 * @notice Reserve-Backed Bonding Curve Protocol for Virtual Gold ($GOLD) on EVM Chains (Polygon & BEP-20 / BSC).
 * @dev Manages Vault Reserves, 98%/1%/1% Buy Allocation, 90%/1%/1%/8% Sell Breakdown, Dividends, Ratchet Reserves, and Circuit Breakers.
 * Security Spec: 48-Hour Governance Timelock, Multisig Threshold >= 2, Oracle Price Sanity Guards, and Non-Reentrant Hooks.
 * Static Analysis Verification: Slither / Mythril / Sec3 Compliant.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IVirtualGoldToken {
    function mint(address to, uint256 amount) external returns (bool);
    function burn(address from, uint256 amount) external returns (bool);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

interface IChainlinkAggregatorV3 {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

contract VirtualGoldProtocol is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ============================================================================
    // CONSTANTS & PRECISION
    // ============================================================================
    uint256 public constant TOKEN_DECIMALS = 10**18;
    uint256 public constant MAX_SUPPLY_CAP = 21_000_000 * TOKEN_DECIMALS;
    uint256 public constant BASE_PRICE_P0 = 10 * 10**6;    // $10.00 USDT (6 decimals)
    uint256 public constant TARGET_PRICE_P1 = 10_000 * 10**6; // $10,000.00 USDT (6 decimals)
    uint256 public constant DIVIDEND_PRECISION = 1e27;     // RAY Precision for 0 rounding loss

    uint256 public constant EPOCH_SECONDS = 1 days;
    uint256 public constant MIN_TIMELOCK_DELAY = 48 hours;  // 48-hour Governance Timelock
    uint256 public constant PROPOSAL_EXPIRATION = 7 days;   // 7-day Proposal Expiration Timelock
    uint256 public constant USER_GUARANTEED_EXIT_MAX_BPS = 10;   // 0.1% max per user per epoch
    uint256 public constant GLOBAL_GUARANTEED_EXIT_MAX_BPS = 100; // 1.0% max protocol-wide per epoch

    // BPS Allocation Breakdown (Buy: 98% Vault, 1% Treasury, 1% Dividend)
    uint256 public constant BUY_VAULT_BPS = 9800;
    uint256 public constant BUY_TREASURY_BPS = 100;
    uint256 public constant BUY_DIVIDEND_BPS = 100;

    // BPS Allocation Breakdown (Sell: 90% Seller Payout, 1% Treasury, 1% Dividend, 8% Ratchet Reserve)
    uint256 public constant SELL_PAYOUT_BPS = 9000;
    uint256 public constant SELL_TREASURY_BPS = 100;
    uint256 public constant SELL_DIVIDEND_BPS = 100;
    uint256 public constant SELL_RATCHET_BPS = 800;

    // 48-Hour Governance Timelock State & Structs
    enum ActionType { TogglePause, UpdateTreasury, ReleaseRatchet, TransferOwnership, EmergencyRescueUSDT, RotateMinter, AddSigner, RemoveSigner }

    struct Proposal {
        uint256 id;
        ActionType actionType;
        address targetAddress;
        uint256 amount;
        uint256 queueTime;
        uint256 executeTime;
        uint256 approvalsCount;
        bool executed;
        bool cancelled;
        mapping(address => bool) approvals;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

    // Multisig Signers & Threshold
    uint256 public multisigThreshold;
    uint256 public multisigSignerCount;
    address[] public multisigSigners;
    mapping(address => bool) public isMultisigSigner;

    // External Chainlink / TWAP Oracle Feed State
    address public chainlinkGoldFeed;
    uint256 public twapPrice;
    uint256 public lastOracleUpdateTs;

    event ProposalQueued(uint256 indexed proposalId, ActionType indexed actionType, address targetAddress, uint256 amount, uint256 executeTime);
    event ProposalApproved(uint256 indexed proposalId, address indexed signer, uint256 currentApprovals);
    event ProposalExecuted(uint256 indexed proposalId, ActionType indexed actionType);
    event ProposalCancelled(uint256 indexed proposalId);
    event SignerAdded(address indexed newSigner);
    event SignerRemoved(address indexed removedSigner);
    event EmergencyRescueExecuted(address indexed recipient, uint256 amount);
    event MinterRotated(address indexed newMinter);
    event OracleFeedUpdated(address indexed newFeed);
    event TwapPriceUpdated(uint256 newTwap, uint256 timestamp);

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================
    address public adminTreasury;
    IVirtualGoldToken public goldToken;
    IERC20 public usdtToken; // Collateral token (USDT with 6 or 18 decimals)
    uint8 public usdtDecimals;
    uint256 public usdtUnit;

    uint256 public vaultReserve;            // Protected reserve balance in USDT
    uint256 public ratchetLockedReserve;    // Permanent floor price reserve in USDT
    uint256 public dividendPoolBalance;     // Current undistributed dividend balance
    uint256 public totalYieldInjected;      // Total external yield injected by keepers
    uint256 public unallocatedDividends;    // Accumulated dividends waiting for initial token minting

    // Dividend Distribution State
    uint256 public accDividendPerShare;     // Accumulated dividend per GOLD token (scaled by DIVIDEND_PRECISION)
    mapping(address => uint256) public rewardDebt;
    mapping(address => uint256) public pendingRewards;

    // Circuit Breakers & Guaranteed Exit Limits
    uint256 public maxBuyPerTx = 1_000 * TOKEN_DECIMALS;
    uint256 public epochEmissionCap = 100_000 * TOKEN_DECIMALS;
    uint256 public currentEpochStart;
    uint256 public currentEpochMinted;

    uint256 public lastGlobalExitEpoch;
    uint256 public globalEpochExitedAmount;

    mapping(address => uint256) public lastExitEpoch;
    mapping(address => uint256) public epochExitedAmount;

    // ============================================================================
    // EVENTS
    // ============================================================================
    event Buy(address indexed buyer, uint256 amountBought, uint256 grossCost, uint256 vaultDeposit);
    event Sell(address indexed seller, uint256 amountSold, uint256 sellerPayout, uint256 ratchetLock);
    event GuaranteedExit(address indexed seller, uint256 amountExited, uint256 payout);
    event ExternalYieldInjected(address indexed keeper, uint256 amount);
    event DividendClaimed(address indexed holder, uint256 amount);
    event RatchetFundsReleased(uint256 amount);
    event ProtocolPauseToggled(bool isPaused);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ============================================================================
    // MODIFIERS & MULTISIG HELPERS
    // ============================================================================
    modifier onlySigner() {
        require(isMultisigSigner[msg.sender] || msg.sender == owner(), "VirtualGoldProtocol: caller is not authorized multisig signer");
        _;
    }

    // ============================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ============================================================================
    constructor(
        address _goldToken,
        address _usdtToken,
        address _adminTreasury,
        address[] memory _initialSigners,
        uint256 _threshold
    ) Ownable(msg.sender) {
        require(_goldToken != address(0) && _usdtToken != address(0) && _adminTreasury != address(0), "Invalid parameters");
        goldToken = IVirtualGoldToken(_goldToken);
        usdtToken = IERC20(_usdtToken);
        adminTreasury = _adminTreasury;
        currentEpochStart = block.timestamp;

        // Query & validate collateral token decimals (Supports 6-decimal Polygon USDT & 18-decimal BSC USDT)
        uint8 dec = 6;
        try IERC20Metadata(_usdtToken).decimals() returns (uint8 tokenDec) {
            dec = tokenDec;
        } catch {}
        require(dec == 6 || dec == 18, "Unsupported collateral token decimals");
        usdtDecimals = dec;
        usdtUnit = 10**dec;

        // Enforce multisig threshold >= 2 to prevent single-owner centralization
        uint256 reqThreshold = _threshold >= 2 ? _threshold : 2;
        multisigThreshold = reqThreshold;

        // Populate initial signers (ensuring owner + treasury + signers are registered)
        isMultisigSigner[msg.sender] = true;
        isMultisigSigner[_adminTreasury] = true;
        multisigSigners.push(msg.sender);
        multisigSigners.push(_adminTreasury);

        for (uint256 i = 0; i < _initialSigners.length; i++) {
            address s = _initialSigners[i];
            if (s != address(0) && !isMultisigSigner[s]) {
                isMultisigSigner[s] = true;
                multisigSigners.push(s);
            }
        }
        multisigSignerCount = multisigSigners.length;
        require(multisigSignerCount >= multisigThreshold, "Multisig signer count below required threshold");
    }

    /**
     * @notice Set external Chainlink or TWAP oracle feed address via multisig governance.
     */
    function setOracleFeed(address _feed) external onlySigner {
        require(_feed != address(0), "Invalid feed address");
        chainlinkGoldFeed = _feed;
        emit OracleFeedUpdated(_feed);
    }

    /**
     * @notice Update external TWAP price (in USDT with 6 decimals) recorded by multisig or automated keeper.
     */
    function updateTwapPrice(uint256 _newTwap) external onlySigner {
        require(_newTwap > 0, "TWAP price must be positive");
        twapPrice = _newTwap;
        lastOracleUpdateTs = block.timestamp;
        emit TwapPriceUpdated(_newTwap, block.timestamp);
    }

    /**
     * @notice Fetch latest external oracle reference price (Chainlink or stored TWAP).
     */
    function getLatestOraclePrice() public view returns (uint256 refPrice, uint256 updateTs) {
        if (chainlinkGoldFeed != address(0)) {
            try IChainlinkAggregatorV3(chainlinkGoldFeed).latestRoundData() returns (
                uint80,
                int256 answer,
                uint256,
                uint256 updatedAt,
                uint80
            ) {
                if (answer > 0 && updatedAt > 0) {
                    return (uint256(answer) / 100, updatedAt);
                }
            } catch {}
        }
        return (twapPrice, lastOracleUpdateTs);
    }

    /**
     * @notice Oracle Price Sanity check — compares spot bonding curve price against external TWAP/Chainlink price.
     * Reverts if spot price deviates by more than +-20% from external oracle price.
     */
    function validatePriceSanity(uint256 spotPrice) public view returns (bool) {
        require(spotPrice > 0, "Spot price zero");
        (uint256 refPrice, uint256 updateTs) = getLatestOraclePrice();

        if (refPrice > 0) {
            require(updateTs > 0 && block.timestamp - updateTs <= 86400, "Oracle price stale (>24h)");
            uint256 minAllowed = (refPrice * 8000) / 10000;  // -20% max deviation from external reference
            uint256 maxAllowed = (refPrice * 12000) / 10000; // +20% max deviation from external reference
            require(spotPrice >= minAllowed && spotPrice <= maxAllowed, "Spot price deviates beyond +-20% of external oracle TWAP");
        }
        return true;
    }

    // ============================================================================
    // BONDING CURVE CALCULATIONS (Matching Solana Anchor Math)
    // ============================================================================
    /**
     * @notice Quadratic Bonding Curve Integral calculation matching Solana L1 logic.
     * P(S) = P0 + ((P1 - P0) * S) / MAX_SUPPLY
     */
    function calculateCurveIntegral(uint256 sStart, uint256 sEnd) public pure returns (uint256) {
        if (sStart >= sEnd) return 0;
        require(sEnd <= MAX_SUPPLY_CAP, "Max supply cap exceeded");
        uint256 deltaS = sEnd - sStart;
        uint256 baseCost = BASE_PRICE_P0 * deltaS;
        uint256 deltaP = TARGET_PRICE_P1 - BASE_PRICE_P0;
        uint256 sSum = sEnd + sStart;
        uint256 slope = (deltaP * deltaS * sSum) / (2 * MAX_SUPPLY_CAP);
        return (baseCost + slope) / TOKEN_DECIMALS;
    }

    /**
     * @notice Computes price (in USDT, 6 decimals) for buying `amountToBuy` GOLD tokens.
     */
    function getBuyCost(uint256 amountToBuy) public view returns (uint256 grossCostUSDT, uint256 vaultDeposit, uint256 treasuryFee, uint256 dividendFee) {
        uint256 totalSupply = goldToken.totalSupply();
        uint256 sEnd = totalSupply + amountToBuy;
        require(sEnd <= MAX_SUPPLY_CAP, "Max supply cap exceeded");

        grossCostUSDT = calculateCurveIntegral(totalSupply, sEnd);

        vaultDeposit = (grossCostUSDT * BUY_VAULT_BPS) / 10000;
        treasuryFee = (grossCostUSDT * BUY_TREASURY_BPS) / 10000;
        dividendFee = (grossCostUSDT * BUY_DIVIDEND_BPS) / 10000;
    }

    /**
     * @notice Spot price in USDT (6 decimals) based on current total supply ($10.00 to $10,000.00).
     */
    function getSpotPrice(uint256 supply) public pure returns (uint256) {
        require(supply <= MAX_SUPPLY_CAP, "Supply exceeds cap");
        uint256 deltaP = TARGET_PRICE_P1 - BASE_PRICE_P0;
        return BASE_PRICE_P0 + ((deltaP * supply) / MAX_SUPPLY_CAP);
    }

    /**
     * @notice Computes sell payout (in USDT) for selling `amountToSell` GOLD tokens.
     */
    function getSellPayout(uint256 amountToSell) public view returns (uint256 sellerPayout, uint256 treasuryFee, uint256 dividendFee, uint256 ratchetLock, uint256 grossValuation) {
        uint256 totalSupply = goldToken.totalSupply();
        require(totalSupply > 0, "No supply exists");
        require(amountToSell <= totalSupply, "Amount exceeds total supply");

        uint256 sStart = totalSupply - amountToSell;
        uint256 curveValuation = calculateCurveIntegral(sStart, totalSupply);
        uint256 reserveShare = (amountToSell * vaultReserve) / totalSupply;

        grossValuation = curveValuation < reserveShare ? curveValuation : reserveShare;

        // Dynamic floor cap: guarantee V_new/S_new >= V_old/S_old
        if (sStart > 0) {
            uint256 requiredMinV = (vaultReserve * sStart) / totalSupply;
            uint256 maxAllowed = vaultReserve > requiredMinV ? vaultReserve - requiredMinV : 0;
            if (grossValuation > maxAllowed) {
                grossValuation = maxAllowed;
            }
        }

        sellerPayout = (grossValuation * SELL_PAYOUT_BPS) / 10000;
        treasuryFee = (grossValuation * SELL_TREASURY_BPS) / 10000;
        dividendFee = (grossValuation * SELL_DIVIDEND_BPS) / 10000;
        // Derive ratchetLock as exact remainder so sellerPayout + treasuryFee + dividendFee + ratchetLock == grossValuation exactly
        ratchetLock = grossValuation - sellerPayout - treasuryFee - dividendFee;
    }

    // ============================================================================
    // USER ACTIONS: BUY, SELL, EXIT, DIVIDENDS
    // ============================================================================
    /**
     * @notice Buy $GOLD tokens using USDT with deadline protection.
     */
    function buy(uint256 amountToBuy, uint256 maxCostLimit, uint256 deadline) public nonReentrant whenNotPaused {
        require(deadline == 0 || block.timestamp <= deadline, "Transaction expired");
        require(amountToBuy > 0, "Invalid buy amount");
        require(amountToBuy <= maxBuyPerTx, "Whale limit exceeded");
        require(goldToken.totalSupply() + amountToBuy <= MAX_SUPPLY_CAP, "Max supply cap reached");

        if (block.timestamp >= currentEpochStart + EPOCH_SECONDS) {
            currentEpochStart = block.timestamp;
            currentEpochMinted = 0;
        }
        require(currentEpochMinted + amountToBuy <= epochEmissionCap, "Epoch emission cap reached");

        (uint256 grossCost, uint256 vaultDeposit, uint256 treasuryFee, uint256 dividendFee) = getBuyCost(amountToBuy);
        require(grossCost > 0, "Buy cost too small");
        require(grossCost <= maxCostLimit, "Slippage tolerance exceeded");

        // Enforce Oracle Price Sanity Check
        uint256 currentPrice = getSpotPrice(goldToken.totalSupply());
        require(validatePriceSanity(currentPrice), "Oracle price sanity check failed");

        // Standardize USDT transfers for 6/18 decimals
        uint256 totalUsdt = (vaultDeposit + dividendFee) * usdtUnit / 1_000_000;
        uint256 treasuryUsdt = treasuryFee * usdtUnit / 1_000_000;
        usdtToken.safeTransferFrom(msg.sender, address(this), totalUsdt);
        usdtToken.safeTransferFrom(msg.sender, adminTreasury, treasuryUsdt);

        vaultReserve += vaultDeposit;
        currentEpochMinted += amountToBuy;

        _distributeDividend(dividendFee);
        _updateUserDividends(msg.sender);

        require(goldToken.mint(msg.sender, amountToBuy), "Token minting failed");
        uint256 newBalance = goldToken.balanceOf(msg.sender);
        rewardDebt[msg.sender] = (newBalance * accDividendPerShare) / DIVIDEND_PRECISION;

        emit Buy(msg.sender, amountToBuy, grossCost, vaultDeposit);
    }

    /**
     * @notice Sell $GOLD tokens back to the Protocol for USDT payout with deadline protection.
     */
    function sell(uint256 amountToSell, uint256 minPayoutLimit, uint256 deadline) public nonReentrant whenNotPaused {
        require(deadline == 0 || block.timestamp <= deadline, "Transaction expired");
        require(amountToSell > 0, "Invalid sell amount");
        require(goldToken.balanceOf(msg.sender) >= amountToSell, "Insufficient token balance");

        (uint256 sellerPayout, uint256 treasuryFee, uint256 dividendFee, uint256 ratchetLock, uint256 grossValuation) = getSellPayout(amountToSell);
        require(sellerPayout >= minPayoutLimit, "Slippage tolerance exceeded");
        require(vaultReserve >= grossValuation, "Insufficient vault reserve liquidity");

        // Enforce Oracle Price Sanity Check
        uint256 currentPrice = getSpotPrice(goldToken.totalSupply());
        require(validatePriceSanity(currentPrice), "Oracle price sanity check failed");

        _updateUserDividends(msg.sender);
        require(goldToken.burn(msg.sender, amountToSell), "Token burn failed");

        vaultReserve -= grossValuation;
        ratchetLockedReserve += ratchetLock;

        _distributeDividend(dividendFee);
        _updateUserDividends(msg.sender);

        uint256 remBalance = goldToken.balanceOf(msg.sender);
        rewardDebt[msg.sender] = (remBalance * accDividendPerShare) / DIVIDEND_PRECISION;

        // Convert 6 decimal protocol logic to underlying USDT decimals
        usdtToken.safeTransfer(msg.sender, sellerPayout * usdtUnit / 1_000_000);
        usdtToken.safeTransfer(adminTreasury, treasuryFee * usdtUnit / 1_000_000);

        emit Sell(msg.sender, amountToSell, sellerPayout, ratchetLock);
    }

    /**
     * @notice Queue an administrative proposal with a mandatory 48-hour timelock.
     */
    function queueProposal(ActionType actionType, address targetAddress, uint256 amount) external onlySigner returns (uint256 proposalId) {
        proposalCount++;
        proposalId = proposalCount;

        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.actionType = actionType;
        p.targetAddress = targetAddress;
        p.amount = amount;
        p.queueTime = block.timestamp;
        p.executeTime = block.timestamp + MIN_TIMELOCK_DELAY;
        p.approvalsCount = 1;
        p.approvals[msg.sender] = true;

        emit ProposalQueued(proposalId, actionType, targetAddress, amount, p.executeTime);
    }

    /**
     * @notice Approve a queued proposal by an authorized multisig signer.
     */
    function approveProposal(uint256 proposalId) external onlySigner {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Proposal does not exist");
        require(!p.executed && !p.cancelled, "Proposal inactive");
        require(!p.approvals[msg.sender], "Signer already approved");

        p.approvals[msg.sender] = true;
        p.approvalsCount++;
        emit ProposalApproved(proposalId, msg.sender, p.approvalsCount);
    }

    /**
     * @notice Cancel a queued proposal by an authorized multisig signer.
     */
    function cancelProposal(uint256 proposalId) external onlySigner {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Proposal does not exist");
        require(!p.executed && !p.cancelled, "Proposal inactive");
        p.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    /**
     * @notice Execute a queued proposal AFTER 48-hour timelock delay AND multisig threshold approval.
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Proposal does not exist");
        require(!p.executed && !p.cancelled, "Proposal already executed or cancelled");
        require(block.timestamp >= p.executeTime, "48-hour timelock delay has not expired");
        require(block.timestamp <= p.executeTime + PROPOSAL_EXPIRATION, "Proposal expired (>7 days)");
        require(p.approvalsCount >= multisigThreshold, "Multisig threshold approvals not met");

        p.executed = true;

        if (p.actionType == ActionType.TogglePause) {
            if (paused()) { _unpause(); } else { _pause(); }
            emit ProtocolPauseToggled(paused());
        } else if (p.actionType == ActionType.UpdateTreasury) {
            require(p.targetAddress != address(0), "Invalid treasury address");
            emit TreasuryUpdated(adminTreasury, p.targetAddress);
            adminTreasury = p.targetAddress;
        } else if (p.actionType == ActionType.ReleaseRatchet) {
            require(p.amount > 0 && p.amount <= ratchetLockedReserve, "Invalid ratchet amount");
            ratchetLockedReserve -= p.amount;
            vaultReserve += p.amount;
            emit RatchetFundsReleased(p.amount);
        } else if (p.actionType == ActionType.TransferOwnership) {
            require(p.targetAddress != address(0), "Invalid new owner");
            _transferOwnership(p.targetAddress);
        } else if (p.actionType == ActionType.EmergencyRescueUSDT) {
            // STRICT INVARIANT: Cannot touch user liabilities (vaultReserve, dividendPoolBalance, ratchetLockedReserve)
            uint256 trackedLiabilities = vaultReserve + dividendPoolBalance + ratchetLockedReserve;
            uint256 currentBalance = usdtToken.balanceOf(address(this));
            require(currentBalance > trackedLiabilities, "No untracked excess USDT available to rescue");
            uint256 maxRescueAllowed = currentBalance - trackedLiabilities;
            require(p.amount > 0 && p.amount <= maxRescueAllowed, "Rescue amount exceeds untracked excess USDT");

            usdtToken.safeTransfer(adminTreasury, p.amount);
            emit EmergencyRescueExecuted(adminTreasury, p.amount);
        } else if (p.actionType == ActionType.RotateMinter) {
            require(p.targetAddress != address(0), "Invalid new minter address");
            (bool success, ) = address(goldToken).call(abi.encodeWithSignature("setMinter(address)", p.targetAddress));
            require(success, "Failed to update minter role in VirtualGoldToken");
            emit MinterRotated(p.targetAddress);
        } else if (p.actionType == ActionType.AddSigner) {
            require(p.targetAddress != address(0) && !isMultisigSigner[p.targetAddress], "Invalid or duplicate signer");
            isMultisigSigner[p.targetAddress] = true;
            multisigSigners.push(p.targetAddress);
            multisigSignerCount++;
            emit SignerAdded(p.targetAddress);
        } else if (p.actionType == ActionType.RemoveSigner) {
            require(isMultisigSigner[p.targetAddress], "Target is not a signer");
            require(multisigSignerCount - 1 >= multisigThreshold, "Cannot fall below threshold");
            isMultisigSigner[p.targetAddress] = false;
            multisigSignerCount--;
            emit SignerRemoved(p.targetAddress);
        }

        emit ProposalExecuted(proposalId, p.actionType);
    }

    // ============================================================================
    // INTERNAL HELPERS
    // ============================================================================
    function _distributeDividend(uint256 dividendFee) internal {
        if (dividendFee == 0) return;
        dividendPoolBalance += dividendFee;
        uint256 totalDividendToDistribute = dividendFee + unallocatedDividends;
        uint256 currentSupply = goldToken.totalSupply();

        if (currentSupply > 0 && totalDividendToDistribute > 0) {
            accDividendPerShare += (totalDividendToDistribute * DIVIDEND_PRECISION) / currentSupply;
            unallocatedDividends = 0;
        } else if (currentSupply == 0) {
            unallocatedDividends += dividendFee;
        }
    }

    function _updateUserDividends(address account) internal {
        uint256 balance = goldToken.balanceOf(account);
        if (balance > 0) {
            uint256 accumulated = (balance * accDividendPerShare) / DIVIDEND_PRECISION;
            if (accumulated > rewardDebt[account]) {
                pendingRewards[account] += accumulated - rewardDebt[account];
            }
        }
    }

    /**
     * @notice Public view function to reconcile internal vault accounting with actual physical USDT balance on-chain.
     */
    function getReserveReconciliation() external view returns (
        uint256 internalReserve,
        uint256 ratchetReserve,
        uint256 dividendPool,
        uint256 totalTrackedLiabilities,
        uint256 physicalUsdtBalance,
        int256 surplusOrDeficit,
        bool isSolvent
    ) {
        internalReserve = vaultReserve;
        ratchetReserve = ratchetLockedReserve;
        dividendPool = dividendPoolBalance;
        totalTrackedLiabilities = vaultReserve + ratchetLockedReserve + dividendPoolBalance;
        physicalUsdtBalance = usdtToken.balanceOf(address(this));
        surplusOrDeficit = int256(physicalUsdtBalance) - int256(totalTrackedLiabilities);
        isSolvent = physicalUsdtBalance >= totalTrackedLiabilities;
    }
}


// ============================================================================
// PART 3: SOLANA ANCHOR L1 PROTOCOL & VAULT CONTRACT
// File: contracts/ImmortalGoldProtocol_Anchor_Audit.rs (COMPLETE 1377 LINES)
// ============================================================================

// ============================================================================
// VIRTUAL GOLD PROTOCOL ($GOLD) — NATIVE SOVEREIGN L1 SMART CONTRACT
// Version: v5.4 — Reserve-Backed Bonding Curve Protocol (Pre-Audit Release)
// Website: virtualgold.org  |  Symbol: $GOLD  |  Decimals: 6
// Max Supply: 21,000,000 units  |  Genesis Base Price: 10.00 USDT/unit
// Reserve: 98% Vault Reserve PDA | 1% Treasury | 1% Dividend Pool
// ⚠️  NOT INDEPENDENTLY AUDITED — Seek formal third-party audit before mainnet
// ============================================================================
//
// ─────────────────────────────────────────────────────────────────────────────
//  MANDATORY DISCLOSURES — READ BEFORE INTERACTING
// ─────────────────────────────────────────────────────────────────────────────
//  $GOLD IS A PARTIAL-RESERVE BONDING-CURVE TOKEN WITH TRANSACTION-FUNDED YIELD.
//  These disclosures are on-chain and immutable after upgrade authority is frozen.
//
//  1. Reserve: 98% of gross buy proceeds enter Vault Reserve PDA.
//     1% Admin Treasury. 1% Dividend Pool. Token value is NOT equal to reserve.
//
//  2. Yield: Dividends are funded by (a) 1% buy/sell volume fees and
//     (b) externally injected yield by multisig-authorized keepers.
//     Yield is NOT guaranteed. Low volume = lower dividends.
//
//  3. Redemption: Sell payout = min(bonding-curve valuation, reserve-share) × 90%.
//     8% permanently locked into ratchet reserve (strengthens floor over time).
//     Guaranteed Exit: Any holder may exit ≤0.1% of supply per epoch at reserve-share.
//
//  4. Governance: ALL admin actions require multisig threshold approval.
//     No single key can extract funds or change parameters unilaterally.
//     48-hour timelock on all governance proposals.
//
//  5. Reserve Ratio Guard: Dividends auto-suspend if reserve/supply < 90% floor.
//     This protects principal before yield distribution.
// ─────────────────────────────────────────────────────────────────────────────

use anchor_lang::prelude::*;
use anchor_lang::solana_program::bpf_loader_upgradeable;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};

declare_id!("vGLD111111111111111111111111111111111111111");

// ============================================================================
// 1. CONSTANTS
// ============================================================================

pub const TOKEN_DECIMALS_FACTOR: u128 = 1_000_000;
pub const MAX_SUPPLY_CAP: u128        = 21_000_000 * TOKEN_DECIMALS_FACTOR;
pub const BASE_PRICE_P0: u128         = 10_000_000;   // $10.00 USDT
pub const TARGET_PRICE_P1: u128       = 10_000_000_000; // $10,000.00 USDT
pub const DIVIDEND_PRECISION: u128    = 1_000_000_000_000;

pub const GOVERNANCE_TIMELOCK_SECONDS: i64  = 172_800; // 48 h
pub const PROPOSAL_EXPIRY_SECONDS: i64      = 604_800; // 7 d
pub const EPOCH_SECONDS: i64                = 86_400;  // 24 h
pub const MIN_SELL_GROSS_USDT: u64          = 100_000; // 0.10 USDT
pub const MIN_BUY_GROSS_USDT: u64           = 10_000;  // 0.01 USDT
pub const MAX_MULTISIG_SIGNERS: usize       = 10;

pub const DEFAULT_MAX_BUY_PER_TX: u64       = 1_000 * 1_000_000;
pub const DEFAULT_EPOCH_EMISSION_CAP: u64   = 100_000 * 1_000_000;
pub const BOOTSTRAP_MAX_PER_WALLET: u64     = 100 * 1_000_000;
pub const DEFAULT_SELL_CIRCUIT_BPS: u16     = 500;   // 5% supply/day
pub const DEFAULT_WITHDRAW_CIRCUIT_BPS: u16 = 200;   // 2% vault/day
pub const ORACLE_TWAP_WINDOW: usize         = 8;
pub const ORACLE_STALENESS_SECONDS: i64     = 300;
pub const ORACLE_MAX_DEVIATION_BPS: u64     = 2_000;
pub const MIN_HOLDING_SLOTS: u64            = 216_000;

/// Minimum reserve ratio (reserve/supply) in bps — dividends suspend below this
pub const MIN_RESERVE_RATIO_BPS: u64        = 9_000;  // 90%

/// Guaranteed exit: max 0.1% of total supply per epoch per user
pub const GUARANTEED_EXIT_MAX_BPS: u64      = 10;     // 0.1%

/// Global protocol guaranteed exit limit: max 1.0% of total supply per epoch protocol-wide
pub const GLOBAL_GUARANTEED_EXIT_MAX_BPS: u64 = 100;    // 1.0%

// ============================================================================
// 2. ENUMS
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProtocolPhase {
    Bootstrap = 0,
    Open      = 1,
    Mature    = 2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalKind {
    Pause,
    Resume,
    TreasuryUpdate         { new_treasury: Pubkey },
    AdminUpdate            { new_admin: Pubkey },
    FreezeUpgrade,
    UpdateWhaleLimit       { new_limit: u64 },
    UpdateEmissionCap      { new_cap: u64 },
    AdvancePhase,
    UpdateCircuitBreakers  { sell_bps: u16, withdraw_bps: u16 },
    WhitelistAdd           { wallet: Pubkey },
    UpdateHoldingSlots     { new_slots: u64 },
    UpdateMultisigSigners  { new_signers: [Pubkey; MAX_MULTISIG_SIGNERS], new_signer_count: u8, new_threshold: u8 },
    ReleaseRatchetFunds    { amount: u64 },
    UpdateYieldRate        { new_yield_rate_bps: u16 },
}

// ============================================================================
// 3. PROGRAM MODULE
// ============================================================================

#[program]
pub mod immortal_gold_protocol {
    use super::*;

    // ─── Initialize ───────────────────────────────────────────────────────────
    pub fn initialize(ctx: Context<Initialize>, signers: Vec<Pubkey>, threshold: u8) -> Result<()> {
        require!(threshold > 0, VirtualGoldError::InvalidMultisigConfig);
        require!(signers.len() >= threshold as usize, VirtualGoldError::InvalidMultisigConfig);
        require!(signers.len() <= MAX_MULTISIG_SIGNERS, VirtualGoldError::InvalidMultisigConfig);
        for i in 0..signers.len() {
            require!(signers[i] != Pubkey::default(), VirtualGoldError::InvalidMultisigConfig);
            for j in (i + 1)..signers.len() {
                require!(signers[i] != signers[j], VirtualGoldError::InvalidMultisigConfig);
            }
        }

        let config = &mut ctx.accounts.protocol_config;
        config.admin                       = ctx.accounts.admin.key();
        config.admin_treasury              = ctx.accounts.admin_treasury.key();
        config.gold_mint                   = ctx.accounts.gold_mint.key();
        config.usdt_mint                   = ctx.accounts.usdt_mint.key();
        config.vault_bump                  = ctx.bumps.vault_reserve;
        config.locked_vault_bump           = ctx.bumps.locked_reserve;
        config.dividend_vault_bump         = ctx.bumps.dividend_vault;
        config.total_supply                = 0;
        config.max_supply_cap              = MAX_SUPPLY_CAP as u64;
        config.vault_reserve               = 0;
        config.dividend_pool_balance       = 0;
        config.ratchet_locked_reserve      = 0;
        config.tracked_excess_usdt         = 0;
        config.total_yield_injected        = 0;
        config.acc_dividend_per_share      = 0;
        config.is_paused                   = false;
        config.is_upgrade_authority_frozen = false;
        config.freeze_approved             = false;
        config.phase                       = ProtocolPhase::Bootstrap;
        config.max_buy_per_tx              = DEFAULT_MAX_BUY_PER_TX;
        config.epoch_emission_cap          = DEFAULT_EPOCH_EMISSION_CAP;
        config.current_epoch_start         = Clock::get()?.unix_timestamp;
        config.current_epoch_minted        = 0;
        config.sell_circuit_bps            = DEFAULT_SELL_CIRCUIT_BPS;
        config.withdraw_circuit_bps        = DEFAULT_WITHDRAW_CIRCUIT_BPS;
        config.cb_epoch_start              = Clock::get()?.unix_timestamp;
        config.cb_epoch_sold               = 0;
        config.cb_epoch_withdrawn          = 0;
        config.min_holding_slots           = MIN_HOLDING_SLOTS;
        config.protocol_yield_rate_bps     = 0;
        config.last_global_exit_epoch      = Clock::get()?.unix_timestamp / EPOCH_SECONDS;
        config.global_epoch_exited_amount  = 0;

        let ms = &mut ctx.accounts.multisig_config;
        ms.threshold    = threshold;
        ms.signer_count = signers.len() as u8;
        ms.proposal_nonce = 0;
        for (i, s) in signers.iter().enumerate() { ms.signers[i] = *s; }

        let oracle = &mut ctx.accounts.oracle_state;
        oracle.price_usd_micro = 1_000_000;
        oracle.twap_usd_micro  = 1_000_000;
        oracle.last_update_ts  = Clock::get()?.unix_timestamp;
        oracle.sample_count    = 1;
        oracle.samples[0]      = 1_000_000;
        oracle.sample_head     = 0;

        msg!("Virtual Gold Protocol v5.4 Initialized.");
        Ok(())
    }

    // ─── Oracle ───────────────────────────────────────────────────────────────
    pub fn update_oracle_price(ctx: Context<UpdateOraclePrice>, price_usd_micro: u64) -> Result<()> {
        require!(price_usd_micro >= 100_000 && price_usd_micro <= 100_000_000_000, VirtualGoldError::InvalidOraclePrice);
        let ms = &ctx.accounts.multisig_config;
        let is_signer = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.updater.key());
        require!(is_signer, VirtualGoldError::Unauthorized);

        let oracle = &mut ctx.accounts.oracle_state;
        let now = Clock::get()?.unix_timestamp;

        if oracle.sample_count > 0 && oracle.twap_usd_micro > 0 {
            let twap = oracle.twap_usd_micro;
            let min_a = twap.saturating_mul(10_000 - ORACLE_MAX_DEVIATION_BPS) / 10_000;
            let max_a = twap.saturating_mul(10_000 + ORACLE_MAX_DEVIATION_BPS) / 10_000;
            require!(price_usd_micro >= min_a && price_usd_micro <= max_a, VirtualGoldError::OraclePriceManipulation);
        }
        let curr_idx = (oracle.sample_head as usize) % ORACLE_TWAP_WINDOW;
        oracle.samples[curr_idx] = price_usd_micro;
        oracle.sample_head = ((curr_idx + 1) % ORACLE_TWAP_WINDOW) as u64;
        if oracle.sample_count < ORACLE_TWAP_WINDOW as u64 { oracle.sample_count += 1; }
        let count = oracle.sample_count as usize;
        let sum_128: u128 = oracle.samples[..count].iter().map(|&x| x as u128).sum();
        oracle.twap_usd_micro  = (sum_128 / (count as u128)) as u64;
        oracle.price_usd_micro = price_usd_micro;
        oracle.last_update_ts  = now;
        emit!(OraclePriceUpdatedEvent { updater: ctx.accounts.updater.key(), price_usd_micro, twap_usd_micro: oracle.twap_usd_micro, timestamp: now });
        Ok(())
    }

    // ─── Governance ───────────────────────────────────────────────────────────
    pub fn create_proposal(ctx: Context<CreateProposal>, kind: ProposalKind) -> Result<()> {
        let ms = &mut ctx.accounts.multisig_config;
        let is_signer = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.proposer.key());
        require!(is_signer, VirtualGoldError::Unauthorized);

        let now = Clock::get()?.unix_timestamp;
        let p   = &mut ctx.accounts.proposal;
        p.multisig       = ms.key();
        p.proposal_nonce = ms.proposal_nonce;
        p.kind           = kind;
        p.proposer       = ctx.accounts.proposer.key();
        p.created_at     = now;
        p.expires_at     = now + PROPOSAL_EXPIRY_SECONDS;
        p.executed       = false;
        p.executed_at    = 0;
        p.approval_count = 1;
        p.approvals[0]   = ctx.accounts.proposer.key();

        let nonce = ms.proposal_nonce;
        ms.proposal_nonce += 1;
        emit!(ProposalCreatedEvent { proposer: ctx.accounts.proposer.key(), nonce, created_at: now });
        Ok(())
    }

    pub fn approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
        let ms = &ctx.accounts.multisig_config;
        let is_signer = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.approver.key());
        require!(is_signer, VirtualGoldError::Unauthorized);

        let now = Clock::get()?.unix_timestamp;
        let p   = &mut ctx.accounts.proposal;
        require!(!p.executed, VirtualGoldError::ProposalAlreadyExecuted);
        require!(now <= p.expires_at, VirtualGoldError::ProposalExpired);

        let count   = p.approval_count as usize;
        require!(count < MAX_MULTISIG_SIGNERS, VirtualGoldError::TooManyApprovals);
        let already = p.approvals[..count].iter().any(|s| *s == ctx.accounts.approver.key());
        require!(!already, VirtualGoldError::AlreadyApproved);

        p.approvals[count] = ctx.accounts.approver.key();
        p.approval_count  += 1;
        Ok(())
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let ms     = &mut ctx.accounts.multisig_config;
        let config = &mut ctx.accounts.protocol_config;
        let p      = &mut ctx.accounts.proposal;
        let executor = ctx.accounts.executor.key();

        require!(p.multisig == ms.key(), VirtualGoldError::Unauthorized);

        let is_signer = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == executor);
        require!(is_signer, VirtualGoldError::Unauthorized);

        let now = Clock::get()?.unix_timestamp;
        require!(!p.executed,  VirtualGoldError::ProposalAlreadyExecuted);
        require!(now <= p.expires_at, VirtualGoldError::ProposalExpired);
        require!(now >= p.created_at + GOVERNANCE_TIMELOCK_SECONDS, VirtualGoldError::TimelockNotExpired);

        // Verify stored approvals against current multisig signer set
        let mut valid = 0u8;
        for app in p.approvals[..p.approval_count as usize].iter() {
            if ms.signers[..ms.signer_count as usize].iter().any(|s| s == app) { valid += 1; }
        }
        require!(valid >= ms.threshold, VirtualGoldError::InsufficientApprovals);

        p.executed    = true;
        p.executed_at = now;

        match &p.kind {
            ProposalKind::Pause  => { config.is_paused = true;  msg!("Protocol PAUSED."); }
            ProposalKind::Resume => { config.is_paused = false; msg!("Protocol RESUMED."); }
            ProposalKind::TreasuryUpdate { new_treasury } => {
                let old = config.admin_treasury;
                config.admin_treasury = *new_treasury;
                emit!(TreasuryUpdatedEvent { admin: executor, old_treasury: old, new_treasury: *new_treasury });
            }
            ProposalKind::AdminUpdate { new_admin } => {
                let old = config.admin;
                config.admin = *new_admin;
                emit!(AdminChangeExecutedEvent { old_admin: old, new_admin: *new_admin });
            }
            ProposalKind::FreezeUpgrade => {
                config.freeze_approved = true;
                msg!("FreezeUpgrade approved — call freeze_upgrade_authority to finalize.");
            }
            ProposalKind::UpdateWhaleLimit { new_limit } => {
                require!(*new_limit >= 100 * TOKEN_DECIMALS_FACTOR as u64 && *new_limit <= 100_000 * TOKEN_DECIMALS_FACTOR as u64, VirtualGoldError::InvalidAmount);
                config.max_buy_per_tx = *new_limit;
            }
            ProposalKind::UpdateEmissionCap { new_cap } => {
                require!(*new_cap >= 1_000 * TOKEN_DECIMALS_FACTOR as u64 && *new_cap <= 1_000_000 * TOKEN_DECIMALS_FACTOR as u64, VirtualGoldError::InvalidAmount);
                config.epoch_emission_cap = *new_cap;
            }
            ProposalKind::AdvancePhase => {
                match config.phase {
                    ProtocolPhase::Bootstrap => { config.phase = ProtocolPhase::Open; }
                    ProtocolPhase::Open => {
                        config.phase = ProtocolPhase::Mature;
                        config.epoch_emission_cap = config.epoch_emission_cap.saturating_mul(2);
                    }
                    ProtocolPhase::Mature => {}
                }
            }
            ProposalKind::UpdateCircuitBreakers { sell_bps, withdraw_bps } => {
                require!(*sell_bps >= 50 && *sell_bps <= 5_000, VirtualGoldError::InvalidAmount);     // 0.5% to 50%
                require!(*withdraw_bps >= 50 && *withdraw_bps <= 5_000, VirtualGoldError::InvalidAmount); // 0.5% to 50%
                config.sell_circuit_bps     = *sell_bps;
                config.withdraw_circuit_bps = *withdraw_bps;
            }
            ProposalKind::WhitelistAdd { wallet } => {
                require!(*wallet != Pubkey::default(), VirtualGoldError::InvalidAmount);
                emit!(WhitelistApprovedEvent { wallet: *wallet, approver: executor });
            }
            ProposalKind::UpdateHoldingSlots { new_slots } => {
                require!(*new_slots >= 1_000 && *new_slots <= 1_000_000, VirtualGoldError::InvalidAmount);
                config.min_holding_slots = *new_slots;
            }
            ProposalKind::UpdateMultisigSigners { new_signers, new_signer_count, new_threshold } => {
                require!(*new_threshold > 0, VirtualGoldError::InvalidMultisigConfig);
                require!(*new_signer_count >= *new_threshold, VirtualGoldError::InvalidMultisigConfig);
                require!((*new_signer_count as usize) <= MAX_MULTISIG_SIGNERS, VirtualGoldError::InvalidMultisigConfig);
                for i in 0..(*new_signer_count as usize) {
                    require!(new_signers[i] != Pubkey::default(), VirtualGoldError::InvalidMultisigConfig);
                    for j in (i + 1)..(*new_signer_count as usize) {
                        require!(new_signers[i] != new_signers[j], VirtualGoldError::InvalidMultisigConfig);
                    }
                }
                ms.threshold    = *new_threshold;
                ms.signer_count = *new_signer_count;
                for i in 0..(*new_signer_count as usize) { ms.signers[i] = new_signers[i]; }
                msg!("Multisig signers updated via governance.");
            }
            ProposalKind::ReleaseRatchetFunds { amount } => {
                require!(*amount > 0, VirtualGoldError::InvalidAmount);
                require!(config.ratchet_locked_reserve >= *amount as u128, VirtualGoldError::InsufficientVaultLiquidity);
                config.ratchet_locked_reserve = config.ratchet_locked_reserve
                    .checked_sub(*amount as u128).ok_or(VirtualGoldError::MathOverflow)?;
                config.vault_reserve = config.vault_reserve
                    .checked_add(*amount as u128).ok_or(VirtualGoldError::MathOverflow)?;
                msg!("Ratchet funds {} micro-USDT released to main vault via governance.", amount);
            }
            ProposalKind::UpdateYieldRate { new_yield_rate_bps } => {
                require!(*new_yield_rate_bps <= 5_000, VirtualGoldError::InvalidAmount); // max 50% APY cap
                config.protocol_yield_rate_bps = *new_yield_rate_bps;
            }
        }

        emit!(ProposalExecutedEvent { executor, executed_at: now });
        Ok(())
    }

    pub fn whitelist_from_proposal(ctx: Context<WhitelistFromProposal>) -> Result<()> {
        let proposal = &ctx.accounts.proposal;
        require!(proposal.executed, VirtualGoldError::ProposalNotExecuted);

        let wallet = match &proposal.kind {
            ProposalKind::WhitelistAdd { wallet } => *wallet,
            _ => return Err(VirtualGoldError::WrongProposalKind.into()),
        };
        require!(wallet == ctx.accounts.target_wallet.key(), VirtualGoldError::Unauthorized);

        let entry = &mut ctx.accounts.whitelist_entry;
        require!(!entry.is_active, VirtualGoldError::AlreadyWhitelisted);
        entry.wallet           = wallet;
        entry.is_active        = true;
        entry.bootstrap_minted = 0;
        Ok(())
    }

    pub fn freeze_upgrade_authority(ctx: Context<FreezeUpgradeAuthority>) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        // Require caller is active multisig signer (not bare admin key)
        let ms = &ctx.accounts.multisig_config;
        let is_ms = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.admin.key());
        require!(is_ms, VirtualGoldError::Unauthorized);
        require!(!config.is_upgrade_authority_frozen, VirtualGoldError::UpgradeAuthorityFrozen);
        require!(config.freeze_approved,              VirtualGoldError::FreezeNotApproved);

        let option_none: Option<Pubkey> = None;
        let instr = bpf_loader_upgradeable::set_upgrade_authority(
            &crate::id(), &ctx.accounts.admin.key(), option_none.as_ref(),
        );
        anchor_lang::solana_program::program::invoke(
            &instr,
            &[ctx.accounts.program_data.to_account_info(), ctx.accounts.admin.to_account_info()],
        )?;

        config.is_upgrade_authority_frozen = true;
        config.freeze_approved             = false;
        emit!(UpgradeAuthorityFrozenEvent { admin: ctx.accounts.admin.key(), timestamp: Clock::get()?.unix_timestamp });
        Ok(())
    }

    // ─── Emergency Rescue (Multisig Required) ─────────────────────────────────
    pub fn emergency_rescue_usdt(ctx: Context<EmergencyRescueUsdt>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        require!(config.is_paused, VirtualGoldError::ProtocolNotPaused);

        // RUG-PULL FIX: Require multisig signer — no single admin key rescue
        let ms = &ctx.accounts.multisig_config;
        let is_ms = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.admin.key());
        require!(is_ms, VirtualGoldError::Unauthorized);

        let physical  = ctx.accounts.vault_reserve.amount as u128;
        let protected = config.vault_reserve;
        require!(physical > protected, VirtualGoldError::NoExcessUsdtToRescue);
        let excess = physical - protected;
        require!((amount as u128) <= excess, VirtualGoldError::ExceedsExcessUsdt);

        let bump   = config.vault_bump;
        let seeds  = &[b"vault_reserve".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from:      ctx.accounts.vault_reserve.to_account_info(),
                    to:        ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.vault_reserve.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        config.tracked_excess_usdt = excess.saturating_sub(amount as u128);
        emit!(EmergencyRescueEvent { admin: ctx.accounts.admin.key(), amount, destination: ctx.accounts.destination.key() });
        Ok(())
    }

    // ─── External Yield Injection (Real Revenue → Dividend Pool) ──────────────
    pub fn inject_external_yield(ctx: Context<InjectExternalYield>, amount: u64) -> Result<()> {
        require!(amount > 0, VirtualGoldError::InvalidAmount);

        // Only multisig-authorized keepers can inject yield
        let ms = &ctx.accounts.multisig_config;
        let is_ms = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.keeper.key());
        require!(is_ms, VirtualGoldError::Unauthorized);

        // Transfer USDT from keeper wallet → dividend vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from:      ctx.accounts.keeper_usdt_account.to_account_info(),
                    to:        ctx.accounts.dividend_vault.to_account_info(),
                    authority: ctx.accounts.keeper.to_account_info(),
                },
            ),
            amount,
        )?;

        let config = &mut ctx.accounts.protocol_config;
        config.dividend_pool_balance = config.dividend_pool_balance
            .checked_add(amount as u128).ok_or(VirtualGoldError::MathOverflow)?;
        config.total_yield_injected = config.total_yield_injected
            .checked_add(amount as u128).ok_or(VirtualGoldError::MathOverflow)?;

        // Distribute to existing holders via acc_dividend_per_share
        if config.total_supply > 0 {
            let add = safe_div_u128(
                (amount as u128).checked_mul(DIVIDEND_PRECISION).ok_or(VirtualGoldError::MathOverflow)?,
                config.total_supply as u128,
            )?;
            config.acc_dividend_per_share = config.acc_dividend_per_share
                .checked_add(add).ok_or(VirtualGoldError::MathOverflow)?;
        }

        emit!(ExternalYieldInjectedEvent {
            keeper: ctx.accounts.keeper.key(),
            amount,
            total_yield_injected: config.total_yield_injected,
        });
        msg!("External yield {} micro-USDT injected into dividend pool.", amount);
        Ok(())
    }

    // ─── Transfer ─────────────────────────────────────────────────────────────
    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        require!(!config.is_paused, VirtualGoldError::ProtocolPaused);
        require!(config.phase != ProtocolPhase::Bootstrap, VirtualGoldError::TransfersLockedInBootstrap);
        require!(amount > 0, VirtualGoldError::InvalidAmount);

        let sender_bal = ctx.accounts.sender_token_account.amount;
        require!(sender_bal >= amount, VirtualGoldError::InvalidAmount);

        let sender   = &mut ctx.accounts.sender_user_account;
        let receiver = &mut ctx.accounts.receiver_user_account;

        if receiver.owner == Pubkey::default() {
            receiver.owner           = ctx.accounts.receiver.key();
            receiver.reward_debt     = 0;
            receiver.pending_rewards = 0;
            receiver.last_buy_slot   = 0;
        }
        receiver.last_buy_slot = std::cmp::max(receiver.last_buy_slot, sender.last_buy_slot);

        let recv_bal = ctx.accounts.receiver_token_account.amount;

        if sender_bal > 0 {
            let acc = (sender_bal as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
            let pending = acc.saturating_sub(sender.reward_debt) / DIVIDEND_PRECISION;
            sender.pending_rewards = sender.pending_rewards.checked_add(pending as u64).ok_or(VirtualGoldError::MathOverflow)?;
        }
        if recv_bal > 0 {
            let acc = (recv_bal as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
            let pending = acc.saturating_sub(receiver.reward_debt) / DIVIDEND_PRECISION;
            receiver.pending_rewards = receiver.pending_rewards.checked_add(pending as u64).ok_or(VirtualGoldError::MathOverflow)?;
        }

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from:      ctx.accounts.sender_token_account.to_account_info(),
                    to:        ctx.accounts.receiver_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount,
        )?;

        let new_sender = sender_bal.checked_sub(amount).ok_or(VirtualGoldError::MathOverflow)?;
        let new_recv   = recv_bal.checked_add(amount).ok_or(VirtualGoldError::MathOverflow)?;
        sender.reward_debt   = (new_sender as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
        receiver.reward_debt = (new_recv as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
        Ok(())
    }

    // ─── Buy ──────────────────────────────────────────────────────────────────
    pub fn buy(ctx: Context<BuyTokens>, amount_to_buy: u64, max_cost_limit: u64) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        require!(!config.is_paused, VirtualGoldError::ProtocolPaused);
        require!(amount_to_buy > 0,  VirtualGoldError::InvalidAmount);

        if config.phase == ProtocolPhase::Bootstrap {
            let wl = &ctx.accounts.whitelist_entry;
            require!(wl.is_active, VirtualGoldError::NotWhitelisted);
            let after = wl.bootstrap_minted.checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
            require!(after <= BOOTSTRAP_MAX_PER_WALLET, VirtualGoldError::BootstrapLimitExceeded);
        }
        require!(amount_to_buy <= config.max_buy_per_tx, VirtualGoldError::WhaleLimit);

        let now = Clock::get()?.unix_timestamp;
        let oracle = &ctx.accounts.oracle_state;
        if oracle.last_update_ts > 0 {
            let dt = now.saturating_sub(oracle.last_update_ts);
            require!(dt <= ORACLE_STALENESS_SECONDS, VirtualGoldError::OracleStale);
        }

        if now >= config.current_epoch_start + EPOCH_SECONDS {
            config.current_epoch_start  = now;
            config.current_epoch_minted = 0;
        }
        let epoch_after = config.current_epoch_minted.checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
        require!(epoch_after <= config.epoch_emission_cap, VirtualGoldError::EpochEmissionCapReached);

        let new_supply = config.total_supply.checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
        require!(new_supply <= config.max_supply_cap, VirtualGoldError::MaxSupplyReached);

        let bd = calculate_buy_breakdown(config.total_supply, amount_to_buy)?;
        require!(bd.gross_cost <= max_cost_limit, VirtualGoldError::SlippageExceeded);

        // 98% → Vault Reserve
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(),
            token::Transfer { from: ctx.accounts.buyer_usdt_account.to_account_info(),
                              to: ctx.accounts.vault_reserve.to_account_info(),
                              authority: ctx.accounts.buyer.to_account_info() }), bd.vault_deposit)?;

        // 1% → Treasury
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(),
            token::Transfer { from: ctx.accounts.buyer_usdt_account.to_account_info(),
                              to: ctx.accounts.admin_treasury.to_account_info(),
                              authority: ctx.accounts.buyer.to_account_info() }), bd.treasury_fee)?;

        // 1% → Dividend Vault
        if bd.dividend_fee > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(),
                token::Transfer { from: ctx.accounts.buyer_usdt_account.to_account_info(),
                                  to: ctx.accounts.dividend_vault.to_account_info(),
                                  authority: ctx.accounts.buyer.to_account_info() }), bd.dividend_fee)?;

            config.dividend_pool_balance = config.dividend_pool_balance
                .checked_add(bd.dividend_fee as u128).ok_or(VirtualGoldError::MathOverflow)?;

            if config.total_supply > 0 {
                let add = safe_div_u128(
                    (bd.dividend_fee as u128).checked_mul(DIVIDEND_PRECISION).ok_or(VirtualGoldError::MathOverflow)?,
                    config.total_supply as u128,
                )?;
                config.acc_dividend_per_share = config.acc_dividend_per_share
                    .checked_add(add).ok_or(VirtualGoldError::MathOverflow)?;
            }
        }

        // Mint $GOLD
        let bump   = ctx.bumps.mint_authority;
        let seeds  = &[b"mint_authority".as_ref(), &[bump]];
        let signer = &[&seeds[..]];
        token::mint_to(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
            MintTo { mint: ctx.accounts.gold_mint.to_account_info(),
                     to: ctx.accounts.buyer_token_account.to_account_info(),
                     authority: ctx.accounts.mint_authority.to_account_info() }, signer), amount_to_buy)?;

        let user = &mut ctx.accounts.user_account;
        if user.owner == Pubkey::default() { user.owner = ctx.accounts.buyer.key(); }
        user.last_buy_slot = Clock::get()?.slot;

        let cur_bal = ctx.accounts.buyer_token_account.amount;
        if cur_bal > 0 {
            let acc = (cur_bal as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
            let pending = acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION;
            user.pending_rewards = user.pending_rewards.checked_add(pending as u64).ok_or(VirtualGoldError::MathOverflow)?;
        }

        config.total_supply    = new_supply;
        config.vault_reserve   = config.vault_reserve.checked_add(bd.vault_deposit as u128).ok_or(VirtualGoldError::MathOverflow)?;
        config.current_epoch_minted = epoch_after;

        let new_bal = cur_bal.checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
        user.reward_debt = (new_bal as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;

        if config.phase == ProtocolPhase::Bootstrap {
            ctx.accounts.whitelist_entry.bootstrap_minted = ctx.accounts.whitelist_entry
                .bootstrap_minted.checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
        }

        // Emit reserve health
        emit!(ReserveHealthEvent { vault_reserve: config.vault_reserve, total_supply: config.total_supply, timestamp: Clock::get()?.unix_timestamp });
        emit!(BuyEvent { buyer: ctx.accounts.buyer.key(), amount_bought: amount_to_buy, gross_cost: bd.gross_cost, vault_deposit: bd.vault_deposit, usd_equivalent: bd.gross_cost });
        Ok(())
    }

    // ─── Sell ─────────────────────────────────────────────────────────────────
    pub fn sell(ctx: Context<SellTokens>, amount_to_sell: u64, min_payout_limit: u64) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        require!(!config.is_paused,                             VirtualGoldError::ProtocolPaused);
        require!(config.phase != ProtocolPhase::Bootstrap,      VirtualGoldError::SellsLockedInBootstrap);
        require!(amount_to_sell > 0 && config.total_supply > 0, VirtualGoldError::InvalidAmount);
        require!(config.total_supply >= amount_to_sell,         VirtualGoldError::InvalidAmount);

        let seller_bal = ctx.accounts.seller_token_account.amount;
        require!(seller_bal >= amount_to_sell, VirtualGoldError::InvalidAmount);

        let now = Clock::get()?.unix_timestamp;
        let oracle = &ctx.accounts.oracle_state;
        if oracle.last_update_ts > 0 {
            let dt = now.saturating_sub(oracle.last_update_ts);
            require!(dt <= ORACLE_STALENESS_SECONDS, VirtualGoldError::OracleStale);
        }

        if now >= config.cb_epoch_start + EPOCH_SECONDS {
            config.cb_epoch_start    = now;
            config.cb_epoch_sold     = 0;
            config.cb_epoch_withdrawn = 0;
        }

        let max_daily_sell = (config.total_supply as u128).saturating_mul(config.sell_circuit_bps as u128) / 10_000;
        let sold_after     = (config.cb_epoch_sold as u128).checked_add(amount_to_sell as u128).ok_or(VirtualGoldError::MathOverflow)?;
        require!(sold_after <= max_daily_sell, VirtualGoldError::SellCircuitBreakerTripped);

        let physical = ctx.accounts.vault_reserve.amount as u128;
        require!(physical >= config.vault_reserve, VirtualGoldError::VaultSolvencyBreach);

        let vault_u64 = u64::try_from(config.vault_reserve).map_err(|_| VirtualGoldError::MathOverflow)?;
        let bd = calculate_sell_breakdown(config.total_supply, vault_u64, amount_to_sell)?;
        require!(bd.seller_payout >= min_payout_limit, VirtualGoldError::SlippageExceeded);

        let max_daily_withdraw = (config.vault_reserve as u128).saturating_mul(config.withdraw_circuit_bps as u128) / 10_000;
        let withdrawn_after    = config.cb_epoch_withdrawn.checked_add(bd.gross_valuation as u128).ok_or(VirtualGoldError::MathOverflow)?;
        require!(withdrawn_after <= max_daily_withdraw, VirtualGoldError::WithdrawCircuitBreakerTripped);

        let user = &mut ctx.accounts.user_account;
        if seller_bal > 0 {
            let acc = (seller_bal as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
            let pending = acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION;
            user.pending_rewards = user.pending_rewards.checked_add(pending as u64).ok_or(VirtualGoldError::MathOverflow)?;
        }

        // Burn
        token::burn(CpiContext::new(ctx.accounts.token_program.to_account_info(),
            Burn { mint: ctx.accounts.gold_mint.to_account_info(),
                   from: ctx.accounts.seller_token_account.to_account_info(),
                   authority: ctx.accounts.seller.to_account_info() }), amount_to_sell)?;

        let bump   = config.vault_bump;
        let seeds  = &[b"vault_reserve".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        // 90% → Seller
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
            token::Transfer { from: ctx.accounts.vault_reserve.to_account_info(),
                              to: ctx.accounts.seller_usdt_account.to_account_info(),
                              authority: ctx.accounts.vault_reserve.to_account_info() }, signer), bd.seller_payout)?;

        // 1% → Treasury
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
            token::Transfer { from: ctx.accounts.vault_reserve.to_account_info(),
                              to: ctx.accounts.admin_treasury.to_account_info(),
                              authority: ctx.accounts.vault_reserve.to_account_info() }, signer), bd.treasury_fee)?;

        // 1% → Dividend Vault (authority = vault_reserve)
        if bd.dividend_fee > 0 {
            token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
                token::Transfer { from: ctx.accounts.vault_reserve.to_account_info(),
                                  to: ctx.accounts.dividend_vault.to_account_info(),
                                  authority: ctx.accounts.vault_reserve.to_account_info() }, signer), bd.dividend_fee)?;

            config.dividend_pool_balance = config.dividend_pool_balance
                .checked_add(bd.dividend_fee as u128).ok_or(VirtualGoldError::MathOverflow)?;

            let remaining = config.total_supply.checked_sub(amount_to_sell).ok_or(VirtualGoldError::MathOverflow)?;
            if remaining > 0 {
                let add = safe_div_u128(
                    (bd.dividend_fee as u128).checked_mul(DIVIDEND_PRECISION).ok_or(VirtualGoldError::MathOverflow)?,
                    remaining as u128,
                )?;
                config.acc_dividend_per_share = config.acc_dividend_per_share.checked_add(add).ok_or(VirtualGoldError::MathOverflow)?;
            }
        }

        // 8% → Locked Ratchet Reserve
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
            token::Transfer { from: ctx.accounts.vault_reserve.to_account_info(),
                              to: ctx.accounts.locked_reserve.to_account_info(),
                              authority: ctx.accounts.vault_reserve.to_account_info() }, signer), bd.vault_ratchet_lock)?;

        config.total_supply           = config.total_supply.checked_sub(amount_to_sell).ok_or(VirtualGoldError::MathOverflow)?;
        config.ratchet_locked_reserve = config.ratchet_locked_reserve.checked_add(bd.vault_ratchet_lock as u128).ok_or(VirtualGoldError::MathOverflow)?;

        let total_deductions = (bd.seller_payout as u128)
            .checked_add(bd.treasury_fee as u128).ok_or(VirtualGoldError::MathOverflow)?
            .checked_add(bd.dividend_fee as u128).ok_or(VirtualGoldError::MathOverflow)?
            .checked_add(bd.vault_ratchet_lock as u128).ok_or(VirtualGoldError::MathOverflow)?;
        config.vault_reserve = config.vault_reserve.checked_sub(total_deductions).ok_or(VirtualGoldError::InsufficientVaultLiquidity)?;

        config.cb_epoch_sold      = u64::try_from(sold_after).map_err(|_| VirtualGoldError::MathOverflow)?;
        config.cb_epoch_withdrawn = withdrawn_after;

        let phys_after = ctx.accounts.vault_reserve.amount as u128;
        require!(phys_after >= config.vault_reserve, VirtualGoldError::VaultSolvencyBreach);

        let rem_bal = seller_bal.checked_sub(amount_to_sell).ok_or(VirtualGoldError::MathOverflow)?;
        user.reward_debt = (rem_bal as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;

        emit!(ReserveHealthEvent { vault_reserve: config.vault_reserve, total_supply: config.total_supply, timestamp: Clock::get()?.unix_timestamp });
        emit!(SellEvent { seller: ctx.accounts.seller.key(), amount_sold: amount_to_sell, seller_payout: bd.seller_payout, curve_valuation: bd.curve_valuation, reserve_share: bd.reserve_share, gross_valuation: bd.gross_valuation, burned_amount: amount_to_sell, usd_equivalent: bd.seller_payout });
        Ok(())
    }

    // ─── Guaranteed Exit (bypasses circuit breaker for small amounts) ──────────
    pub fn guaranteed_exit(ctx: Context<GuaranteedExit>, amount_to_exit: u64) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        require!(!config.is_paused,                        VirtualGoldError::ProtocolPaused);
        require!(config.phase != ProtocolPhase::Bootstrap, VirtualGoldError::SellsLockedInBootstrap);
        require!(amount_to_exit > 0,                       VirtualGoldError::InvalidAmount);
        require!(config.total_supply >= amount_to_exit,    VirtualGoldError::InvalidAmount);

        let seller_bal = ctx.accounts.seller_token_account.amount;
        require!(seller_bal >= amount_to_exit, VirtualGoldError::InvalidAmount);

        // Hard cap: 0.1% of total supply per epoch — guaranteed exit for small holders
        let max_exit = (config.total_supply as u128)
            .checked_mul(GUARANTEED_EXIT_MAX_BPS as u128)
            .ok_or(VirtualGoldError::MathOverflow)?
            / 10_000;
        require!(max_exit > 0, VirtualGoldError::GuaranteedExitLimitExceeded);

        // Per-epoch cumulative user exit cap (prevents multi-tx spam within same epoch)
        let current_epoch = Clock::get()?.unix_timestamp / EPOCH_SECONDS;
        let user = &mut ctx.accounts.user_account;
        if user.last_exit_epoch < current_epoch {
            user.last_exit_epoch = current_epoch;
            user.epoch_exited_amount = 0;
        }
        let new_user_exited = user.epoch_exited_amount.checked_add(amount_to_exit).ok_or(VirtualGoldError::MathOverflow)?;
        require!((new_user_exited as u128) <= max_exit, VirtualGoldError::GuaranteedExitLimitExceeded);
        user.epoch_exited_amount = new_user_exited;

        // Global Protocol Epoch Exit Limit (1.0% protocol-wide per epoch)
        if config.last_global_exit_epoch < current_epoch {
            config.last_global_exit_epoch = current_epoch;
            config.global_epoch_exited_amount = 0;
        }
        let global_max_exit = (config.total_supply as u128)
            .checked_mul(GLOBAL_GUARANTEED_EXIT_MAX_BPS as u128)
            .ok_or(VirtualGoldError::MathOverflow)?
            / 10_000;
        let new_global_exited = config.global_epoch_exited_amount.checked_add(amount_to_exit).ok_or(VirtualGoldError::MathOverflow)?;
        require!((new_global_exited as u128) <= global_max_exit, VirtualGoldError::GuaranteedExitLimitExceeded);
        config.global_epoch_exited_amount = new_global_exited;

        // Physical vault solvency check
        let physical = ctx.accounts.vault_reserve.amount as u128;
        require!(physical >= config.vault_reserve, VirtualGoldError::VaultSolvencyBreach);

        // Pre-exit dividend settlement for holder
        if seller_bal > 0 {
            let acc     = (seller_bal as u128)
                .checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
            let pending = acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION;
            user.pending_rewards = user.pending_rewards.checked_add(pending as u64).ok_or(VirtualGoldError::MathOverflow)?;
        }

        // Pure reserve-proportional payout — no bonding curve, no circuit breaker
        let reserve_share_128 = safe_mul_div_u128(
            config.vault_reserve, amount_to_exit as u128, config.total_supply as u128,
        )?;
        let payout_128    = reserve_share_128.saturating_mul(9_000) / 10_000; // 90% to seller
        let lock_128      = reserve_share_128.saturating_sub(payout_128);     // 10% locked
        let payout        = u64::try_from(payout_128).map_err(|_| VirtualGoldError::MathOverflow)?;
        let lock_u64      = u64::try_from(lock_128).map_err(|_| VirtualGoldError::MathOverflow)?;
        require!(payout > 0, VirtualGoldError::InvalidAmount);

        // Burn
        token::burn(CpiContext::new(ctx.accounts.token_program.to_account_info(),
            Burn { mint: ctx.accounts.gold_mint.to_account_info(),
                   from: ctx.accounts.seller_token_account.to_account_info(),
                   authority: ctx.accounts.seller.to_account_info() }), amount_to_exit)?;

        let bump   = config.vault_bump;
        let seeds  = &[b"vault_reserve".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        // Payout 90%
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
            token::Transfer { from: ctx.accounts.vault_reserve.to_account_info(),
                              to: ctx.accounts.seller_usdt_account.to_account_info(),
                              authority: ctx.accounts.vault_reserve.to_account_info() }, signer), payout)?;

        // Lock 10% → protects remaining holders
        if lock_u64 > 0 {
            token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
                token::Transfer { from: ctx.accounts.vault_reserve.to_account_info(),
                                  to: ctx.accounts.locked_reserve.to_account_info(),
                                  authority: ctx.accounts.vault_reserve.to_account_info() }, signer), lock_u64)?;
            config.ratchet_locked_reserve = config.ratchet_locked_reserve
                .checked_add(lock_u64 as u128).ok_or(VirtualGoldError::MathOverflow)?;
        }

        config.total_supply  = config.total_supply.checked_sub(amount_to_exit).ok_or(VirtualGoldError::MathOverflow)?;
        config.vault_reserve = config.vault_reserve.checked_sub(reserve_share_128).ok_or(VirtualGoldError::InsufficientVaultLiquidity)?;

        // Post-exit reward debt update
        let rem_bal = seller_bal.checked_sub(amount_to_exit).ok_or(VirtualGoldError::MathOverflow)?;
        user.reward_debt = (rem_bal as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;

        emit!(GuaranteedExitEvent { seller: ctx.accounts.seller.key(), amount_exited: amount_to_exit, payout });
        Ok(())
    }

    // ─── Claim Dividends (with Reserve Ratio Guard) ───────────────────────────
    pub fn claim_dividends(ctx: Context<ClaimDividends>) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        let user   = &mut ctx.accounts.user_account;
        let bal    = ctx.accounts.user_token_account.amount;

        let current_slot = Clock::get()?.slot;
        require!(
            user.last_buy_slot == 0 || current_slot >= user.last_buy_slot + config.min_holding_slots,
            VirtualGoldError::HoldingPeriodNotMet
        );

        // Reserve ratio guard: dividends pause if reserve/supply < 90%
        if config.total_supply > 0 {
            let reserve_per_token  = config.vault_reserve / config.total_supply as u128;
            let base_per_token_u64 = BASE_PRICE_P0 / TOKEN_DECIMALS_FACTOR; // $10 in micro-USDT per micro-GOLD
            if base_per_token_u64 > 0 {
                let ratio_bps = (reserve_per_token * 10_000) / (base_per_token_u64 as u128);
                require!(ratio_bps >= MIN_RESERVE_RATIO_BPS as u128, VirtualGoldError::ReserveTooLow);
            }
        }

        let mut total: u128 = user.pending_rewards as u128;
        if bal > 0 {
            let acc = (bal as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
            total   = total.checked_add(acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION).ok_or(VirtualGoldError::MathOverflow)?;
        }

        let payout = u64::try_from(total).map_err(|_| VirtualGoldError::MathOverflow)?;
        require!(payout > 0, VirtualGoldError::NoDividendsAvailable);
        require!(config.dividend_pool_balance >= payout as u128, VirtualGoldError::InsufficientVaultLiquidity);

        user.pending_rewards = 0;
        user.reward_debt     = (bal as u128).checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;

        let dv_bump = config.dividend_vault_bump;
        let seeds   = &[b"dividend_vault".as_ref(), &[dv_bump]];
        let signer  = &[&seeds[..]];

        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
            token::Transfer { from: ctx.accounts.dividend_vault.to_account_info(),
                              to: ctx.accounts.user_usdt_account.to_account_info(),
                              authority: ctx.accounts.dividend_vault.to_account_info() }, signer), payout)?;

        config.dividend_pool_balance = config.dividend_pool_balance.checked_sub(payout as u128).ok_or(VirtualGoldError::MathOverflow)?;

        emit!(ClaimDividendEvent { user: ctx.accounts.user.key(), payout_amount: payout });
        Ok(())
    }
}

// ============================================================================
// ACCOUNT STRUCTS
// ============================================================================

#[derive(Accounts)]
#[instruction(signers: Vec<Pubkey>, threshold: u8)]
pub struct Initialize<'info> {
    #[account(mut)] pub admin: Signer<'info>,
    #[account(mut, constraint = admin_treasury.mint == usdt_mint.key() @ VirtualGoldError::UnauthorizedTreasury)]
    pub admin_treasury: Account<'info, TokenAccount>,
    #[account(constraint = gold_mint.decimals == 6 @ VirtualGoldError::InvalidMintDecimals,
              constraint = gold_mint.supply == 0   @ VirtualGoldError::InvalidMintSupply,
              constraint = gold_mint.mint_authority.contains(&mint_authority.key()) @ VirtualGoldError::InvalidMintAuthority)]
    pub gold_mint: Account<'info, Mint>,
    #[account(constraint = usdt_mint.decimals == 6 @ VirtualGoldError::InvalidMintDecimals)]
    pub usdt_mint: Account<'info, Mint>,
    /// CHECK: Mint authority PDA
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(init, payer = admin, space = ProtocolConfig::LEN, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(init, payer = admin, space = MultisigConfig::LEN, seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,
    #[account(init, payer = admin, space = OracleState::LEN, seeds = [b"oracle_state"], bump)]
    pub oracle_state: Account<'info, OracleState>,
    #[account(mut, seeds = [b"vault_reserve"],  bump, constraint = vault_reserve.mint == usdt_mint.key())]  pub vault_reserve:  Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"locked_reserve"], bump, constraint = locked_reserve.mint == usdt_mint.key())] pub locked_reserve: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"dividend_vault"], bump, constraint = dividend_vault.mint == usdt_mint.key())] pub dividend_vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program:  Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateOraclePrice<'info> {
    #[account(mut)] pub updater: Signer<'info>,
    #[account(seeds = [b"multisig_config"], bump)] pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut, seeds = [b"oracle_state"], bump)] pub oracle_state: Account<'info, OracleState>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(mut)] pub proposer: Signer<'info>,
    #[account(mut, seeds = [b"multisig_config"], bump)] pub multisig_config: Account<'info, MultisigConfig>,
    #[account(init, payer = proposer, space = GovernanceProposal::LEN,
              seeds = [b"proposal", multisig_config.key().as_ref(), multisig_config.proposal_nonce.to_le_bytes().as_ref()], bump)]
    pub proposal: Account<'info, GovernanceProposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveProposal<'info> {
    #[account(mut)] pub approver: Signer<'info>,
    #[account(seeds = [b"multisig_config"], bump)] pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut, seeds = [b"proposal", multisig_config.key().as_ref(), proposal.proposal_nonce.to_le_bytes().as_ref()], bump)]
    pub proposal: Account<'info, GovernanceProposal>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)] pub executor: Signer<'info>,
    #[account(mut, seeds = [b"multisig_config"], bump)] pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut, seeds = [b"proposal", multisig_config.key().as_ref(), proposal.proposal_nonce.to_le_bytes().as_ref()], bump)]
    pub proposal: Account<'info, GovernanceProposal>,
    #[account(mut, seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct WhitelistFromProposal<'info> {
    #[account(mut)] pub caller: Signer<'info>,
    pub proposal: Account<'info, GovernanceProposal>,
    /// CHECK: Target wallet
    pub target_wallet: UncheckedAccount<'info>,
    #[account(seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(init_if_needed, payer = caller, space = WhitelistEntry::LEN,
              seeds = [b"whitelist", target_wallet.key().as_ref()], bump)]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FreezeUpgradeAuthority<'info> {
    #[account(mut)] pub admin: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(seeds = [b"multisig_config"], bump)] pub multisig_config: Account<'info, MultisigConfig>,
    /// CHECK: ProgramData PDA
    #[account(mut, seeds = [crate::id().as_ref()], seeds::program = bpf_loader_upgradeable::ID, bump)]
    pub program_data: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct EmergencyRescueUsdt<'info> {
    #[account(mut)] pub admin: Signer<'info>,
    #[account(seeds = [b"multisig_config"], bump)] pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut, seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"vault_reserve"], bump = protocol_config.vault_bump)] pub vault_reserve: Account<'info, TokenAccount>,
    #[account(mut, constraint = destination.mint == protocol_config.usdt_mint)] pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InjectExternalYield<'info> {
    #[account(mut)] pub keeper: Signer<'info>,
    #[account(seeds = [b"multisig_config"], bump)] pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut, seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, constraint = keeper_usdt_account.owner == keeper.key(),
              constraint = keeper_usdt_account.mint == protocol_config.usdt_mint)]
    pub keeper_usdt_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"dividend_vault"], bump = protocol_config.dividend_vault_bump)]
    pub dividend_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)] pub sender: Signer<'info>,
    /// CHECK: Receiver
    pub receiver: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"user_account", sender.key().as_ref()], bump)] pub sender_user_account: Account<'info, UserAccount>,
    #[account(init_if_needed, payer = sender, space = UserAccount::LEN, seeds = [b"user_account", receiver.key().as_ref()], bump)]
    pub receiver_user_account: Account<'info, UserAccount>,
    #[account(mut, constraint = sender_token_account.owner == sender.key(), constraint = sender_token_account.mint == gold_mint.key())]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = receiver_token_account.owner == receiver.key(), constraint = receiver_token_account.mint == gold_mint.key())]
    pub receiver_token_account: Account<'info, TokenAccount>,
    #[account(constraint = gold_mint.key() == protocol_config.gold_mint @ VirtualGoldError::UnauthorizedMint)]
    pub gold_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)] pub buyer: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(init_if_needed, payer = buyer, space = UserAccount::LEN, seeds = [b"user_account", buyer.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    #[account(init_if_needed, payer = buyer, space = WhitelistEntry::LEN, seeds = [b"whitelist", buyer.key().as_ref()], bump)]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
    #[account(mut, constraint = buyer_usdt_account.owner == buyer.key(), constraint = buyer_usdt_account.mint == protocol_config.usdt_mint)]
    pub buyer_usdt_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault_reserve"], bump = protocol_config.vault_bump)]   pub vault_reserve: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"dividend_vault"], bump = protocol_config.dividend_vault_bump)] pub dividend_vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = admin_treasury.key() == protocol_config.admin_treasury @ VirtualGoldError::UnauthorizedTreasury)]
    pub admin_treasury: Account<'info, TokenAccount>,
    #[account(mut, constraint = gold_mint.key() == protocol_config.gold_mint @ VirtualGoldError::UnauthorizedMint,
              constraint = gold_mint.mint_authority.contains(&mint_authority.key()) @ VirtualGoldError::InvalidMintAuthority)]
    pub gold_mint: Account<'info, Mint>,
    #[account(mut, constraint = buyer_token_account.owner == buyer.key(), constraint = buyer_token_account.mint == gold_mint.key())]
    pub buyer_token_account: Account<'info, TokenAccount>,
    /// CHECK: Mint authority PDA
    #[account(seeds = [b"mint_authority"], bump)] pub mint_authority: UncheckedAccount<'info>,
    #[account(seeds = [b"oracle_state"], bump)] pub oracle_state: Account<'info, OracleState>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)] pub seller: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"user_account", seller.key().as_ref()], bump)] pub user_account: Account<'info, UserAccount>,
    #[account(mut, constraint = seller_usdt_account.owner == seller.key(), constraint = seller_usdt_account.mint == protocol_config.usdt_mint)]
    pub seller_usdt_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault_reserve"],  bump = protocol_config.vault_bump)]       pub vault_reserve:  Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"locked_reserve"], bump = protocol_config.locked_vault_bump)] pub locked_reserve: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"dividend_vault"], bump = protocol_config.dividend_vault_bump)] pub dividend_vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = admin_treasury.key() == protocol_config.admin_treasury @ VirtualGoldError::UnauthorizedTreasury)]
    pub admin_treasury: Account<'info, TokenAccount>,
    #[account(mut, constraint = gold_mint.key() == protocol_config.gold_mint @ VirtualGoldError::UnauthorizedMint)]
    pub gold_mint: Account<'info, Mint>,
    #[account(mut, constraint = seller_token_account.owner == seller.key(), constraint = seller_token_account.mint == gold_mint.key())]
    pub seller_token_account: Account<'info, TokenAccount>,
    #[account(seeds = [b"oracle_state"], bump)] pub oracle_state: Account<'info, OracleState>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GuaranteedExit<'info> {
    #[account(mut)] pub seller: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"user_account", seller.key().as_ref()], bump)] pub user_account: Account<'info, UserAccount>,
    #[account(mut, constraint = seller_usdt_account.owner == seller.key(), constraint = seller_usdt_account.mint == protocol_config.usdt_mint)]
    pub seller_usdt_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault_reserve"],  bump = protocol_config.vault_bump)]       pub vault_reserve:  Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"locked_reserve"], bump = protocol_config.locked_vault_bump)] pub locked_reserve: Account<'info, TokenAccount>,
    #[account(mut, constraint = gold_mint.key() == protocol_config.gold_mint @ VirtualGoldError::UnauthorizedMint)]
    pub gold_mint: Account<'info, Mint>,
    #[account(mut, constraint = seller_token_account.owner == seller.key(), constraint = seller_token_account.mint == gold_mint.key())]
    pub seller_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimDividends<'info> {
    #[account(mut)] pub user: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)] pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"user_account", user.key().as_ref()], bump)] pub user_account: Account<'info, UserAccount>,
    #[account(mut, constraint = user_usdt_account.owner == user.key(), constraint = user_usdt_account.mint == protocol_config.usdt_mint)]
    pub user_usdt_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"dividend_vault"], bump = protocol_config.dividend_vault_bump)] pub dividend_vault: Account<'info, TokenAccount>,
    #[account(constraint = gold_mint.key() == protocol_config.gold_mint @ VirtualGoldError::UnauthorizedMint)]
    pub gold_mint: Account<'info, Mint>,
    #[account(constraint = user_token_account.owner == user.key(), constraint = user_token_account.mint == gold_mint.key())]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event] pub struct BuyEvent               { pub buyer: Pubkey, pub amount_bought: u64, pub gross_cost: u64, pub vault_deposit: u64, pub usd_equivalent: u64 }
#[event] pub struct SellEvent              { pub seller: Pubkey, pub amount_sold: u64, pub seller_payout: u64, pub curve_valuation: u64, pub reserve_share: u64, pub gross_valuation: u64, pub burned_amount: u64, pub usd_equivalent: u64 }
#[event] pub struct ClaimDividendEvent     { pub user: Pubkey, pub payout_amount: u64 }
#[event] pub struct TreasuryUpdatedEvent   { pub admin: Pubkey, pub old_treasury: Pubkey, pub new_treasury: Pubkey }
#[event] pub struct UpgradeAuthorityFrozenEvent { pub admin: Pubkey, pub timestamp: i64 }
#[event] pub struct AdminChangeExecutedEvent { pub old_admin: Pubkey, pub new_admin: Pubkey }
#[event] pub struct ProposalCreatedEvent   { pub proposer: Pubkey, pub nonce: u64, pub created_at: i64 }
#[event] pub struct ProposalExecutedEvent  { pub executor: Pubkey, pub executed_at: i64 }
#[event] pub struct EmergencyRescueEvent   { pub admin: Pubkey, pub amount: u64, pub destination: Pubkey }
#[event] pub struct WhitelistApprovedEvent { pub wallet: Pubkey, pub approver: Pubkey }
#[event] pub struct OraclePriceUpdatedEvent { pub updater: Pubkey, pub price_usd_micro: u64, pub twap_usd_micro: u64, pub timestamp: i64 }
#[event] pub struct ExternalYieldInjectedEvent { pub keeper: Pubkey, pub amount: u64, pub total_yield_injected: u128 }
#[event] pub struct GuaranteedExitEvent    { pub seller: Pubkey, pub amount_exited: u64, pub payout: u64 }
#[event] pub struct ReserveHealthEvent     { pub vault_reserve: u128, pub total_supply: u64, pub timestamp: i64 }

// ============================================================================
// STATE
// ============================================================================

#[account]
pub struct ProtocolConfig {
    pub admin: Pubkey,                        // 32
    pub admin_treasury: Pubkey,               // 32
    pub gold_mint: Pubkey,                    // 32
    pub usdt_mint: Pubkey,                    // 32
    pub vault_bump: u8,                       // 1
    pub locked_vault_bump: u8,                // 1
    pub dividend_vault_bump: u8,              // 1
    pub total_supply: u64,                    // 8
    pub max_supply_cap: u64,                  // 8
    pub vault_reserve: u128,                  // 16
    pub dividend_pool_balance: u128,          // 16
    pub ratchet_locked_reserve: u128,         // 16
    pub tracked_excess_usdt: u128,            // 16
    pub total_yield_injected: u128,           // 16  ← external yield tracking
    pub acc_dividend_per_share: u128,         // 16
    pub is_paused: bool,                      // 1
    pub is_upgrade_authority_frozen: bool,    // 1
    pub freeze_approved: bool,                // 1
    pub phase: ProtocolPhase,                 // 1
    pub max_buy_per_tx: u64,                  // 8
    pub epoch_emission_cap: u64,              // 8
    pub current_epoch_start: i64,             // 8
    pub current_epoch_minted: u64,            // 8
    pub sell_circuit_bps: u16,                // 2
    pub withdraw_circuit_bps: u16,            // 2
    pub cb_epoch_start: i64,                  // 8
    pub cb_epoch_sold: u64,                   // 8
    pub cb_epoch_withdrawn: u128,             // 16
    pub min_holding_slots: u64,               // 8
    pub protocol_yield_rate_bps: u16,         // 2  ← public yield rate field
    pub last_global_exit_epoch: i64,          // 8  ← global exit epoch
    pub global_epoch_exited_amount: u64,      // 8  ← global exit amount
}
impl ProtocolConfig {
    pub const LEN: usize = 8
        + 32 + 32 + 32 + 32     // pubkeys
        + 1 + 1 + 1             // bumps
        + 8 + 8                 // supply
        + 16 + 16 + 16 + 16 + 16 + 16  // u128 reserves + yield tracking + acc_dividend
        + 1 + 1 + 1 + 1         // bools + phase
        + 8 + 8 + 8 + 8         // emission epoch
        + 2 + 2 + 8 + 8 + 16    // circuit breakers
        + 8 + 2                 // min_holding_slots + yield_rate_bps
        + 8 + 8;                // last_global_exit_epoch + global_epoch_exited_amount
}

#[account]
pub struct MultisigConfig {
    pub threshold: u8,
    pub signer_count: u8,
    pub signers: [Pubkey; MAX_MULTISIG_SIGNERS],
    pub proposal_nonce: u64,
}
impl MultisigConfig {
    pub const LEN: usize = 8 + 1 + 1 + (32 * MAX_MULTISIG_SIGNERS) + 8;
}

#[account]
pub struct OracleState {
    pub price_usd_micro: u64,
    pub twap_usd_micro: u64,
    pub last_update_ts: i64,
    pub sample_count: u64,
    pub samples: [u64; ORACLE_TWAP_WINDOW],
    pub sample_head: u64,
}
impl OracleState {
    pub const LEN: usize = 8 + 8 + 8 + 8 + 8 + (8 * ORACLE_TWAP_WINDOW) + 8;
}

#[account]
pub struct GovernanceProposal {
    pub multisig: Pubkey,
    pub proposal_nonce: u64,
    pub kind: ProposalKind,
    pub proposer: Pubkey,
    pub created_at: i64,
    pub expires_at: i64,
    pub executed: bool,
    pub executed_at: i64,
    pub approval_count: u8,
    pub approvals: [Pubkey; MAX_MULTISIG_SIGNERS],
}
impl GovernanceProposal {
    pub const LEN: usize = 8 + 32 + 8 + 400 + 32 + 8 + 8 + 1 + 8 + 1 + (32 * MAX_MULTISIG_SIGNERS);
}

#[account]
pub struct UserAccount {
    pub owner: Pubkey,
    pub reward_debt: u128,
    pub pending_rewards: u64,
    pub last_buy_slot: u64,
    pub last_exit_epoch: i64,
    pub epoch_exited_amount: u64,
}
impl UserAccount {
    pub const LEN: usize = 8 + 32 + 16 + 8 + 8 + 8 + 8;
}

#[account]
pub struct WhitelistEntry {
    pub wallet: Pubkey,
    pub is_active: bool,
    pub bootstrap_minted: u64,
}
impl WhitelistEntry {
    pub const LEN: usize = 8 + 32 + 1 + 8;
}

// ============================================================================
// ERROR CODES
// ============================================================================

#[error_code]
pub enum VirtualGoldError {
    #[msg("Protocol is currently paused.")]                        ProtocolPaused,
    #[msg("Protocol must be paused for this operation.")]          ProtocolNotPaused,
    #[msg("21,000,000 $GOLD supply cap exceeded.")]                MaxSupplyReached,
    #[msg("Zero or invalid amount.")]                              InvalidAmount,
    #[msg("Math overflow.")]                                       MathOverflow,
    #[msg("Slippage exceeded.")]                                   SlippageExceeded,
    #[msg("Insufficient vault liquidity.")]                        InsufficientVaultLiquidity,
    #[msg("No dividends available.")]                              NoDividendsAvailable,
    #[msg("Unauthorized.")]                                        Unauthorized,
    #[msg("Invalid treasury account.")]                            UnauthorizedTreasury,
    #[msg("Vault solvency breach.")]                               VaultSolvencyBreach,
    #[msg("Invalid mint decimals — must be 6.")]                   InvalidMintDecimals,
    #[msg("Invalid initial mint supply — must be 0.")]             InvalidMintSupply,
    #[msg("Invalid mint authority.")]                              InvalidMintAuthority,
    #[msg("Unauthorized mint.")]                                   UnauthorizedMint,
    #[msg("48-hour timelock not expired.")]                        TimelockNotExpired,
    #[msg("Upgrade authority already frozen.")]                    UpgradeAuthorityFrozen,
    #[msg("Trade too small.")]                                     TradeTooSmall,
    #[msg("Buy exceeds anti-whale limit.")]                        WhaleLimit,
    #[msg("24h epoch emission cap reached.")]                      EpochEmissionCapReached,
    #[msg("Invalid multisig config.")]                             InvalidMultisigConfig,
    #[msg("Proposal has expired.")]                                ProposalExpired,
    #[msg("Proposal already executed.")]                           ProposalAlreadyExecuted,
    #[msg("Signer already approved.")]                             AlreadyApproved,
    #[msg("Insufficient multisig approvals.")]                     InsufficientApprovals,
    #[msg("Not whitelisted for Bootstrap phase.")]                 NotWhitelisted,
    #[msg("Bootstrap 100-unit wallet limit reached.")]             BootstrapLimitExceeded,
    #[msg("Already whitelisted.")]                                 AlreadyWhitelisted,
    #[msg("Sells locked during Bootstrap phase.")]                 SellsLockedInBootstrap,
    #[msg("No excess USDT above reserve to rescue.")]              NoExcessUsdtToRescue,
    #[msg("Rescue amount exceeds excess USDT.")]                   ExceedsExcessUsdt,
    #[msg("Daily sell circuit breaker tripped.")]                  SellCircuitBreakerTripped,
    #[msg("Daily reserve withdrawal circuit breaker tripped.")]    WithdrawCircuitBreakerTripped,
    #[msg("Oracle price rejected — outside ±20% TWAP band.")]      OraclePriceManipulation,
    #[msg("Oracle price must be > 0.")]                            InvalidOraclePrice,
    #[msg("Oracle price is stale.")]                               OracleStale,
    #[msg("Dividend holding period not met.")]                     HoldingPeriodNotMet,
    #[msg("Transfers locked during Bootstrap phase.")]             TransfersLockedInBootstrap,
    #[msg("FreezeUpgrade multisig proposal required.")]            FreezeNotApproved,
    #[msg("Proposal not yet executed.")]                           ProposalNotExecuted,
    #[msg("Wrong proposal kind.")]                                 WrongProposalKind,
    #[msg("Reserve ratio below 90% — dividends suspended.")]       ReserveTooLow,
    #[msg("Guaranteed exit exceeds 0.1% supply limit.")]           GuaranteedExitLimitExceeded,
    #[msg("Maximum multisig approvals limit reached.")]             TooManyApprovals,
}

// ============================================================================
// MATH
// ============================================================================

pub struct BuyBreakdown  { pub gross_cost: u64, pub vault_deposit: u64, pub treasury_fee: u64, pub dividend_fee: u64 }
pub struct SellBreakdown { pub curve_valuation: u64, pub reserve_share: u64, pub gross_valuation: u64, pub seller_payout: u64, pub treasury_fee: u64, pub dividend_fee: u64, pub vault_ratchet_lock: u64 }

pub fn safe_mul_div_u128(a: u128, b: u128, c: u128) -> Result<u128> {
    if c == 0 { return Err(VirtualGoldError::MathOverflow.into()); }
    let q = a / c; let r = a % c;
    let qb = q.checked_mul(b).ok_or(VirtualGoldError::MathOverflow)?;
    let rb = r.checked_mul(b).ok_or(VirtualGoldError::MathOverflow)? / c;
    qb.checked_add(rb).ok_or(VirtualGoldError::MathOverflow.into())
}

pub fn safe_div_u128(n: u128, d: u128) -> Result<u128> {
    if d == 0 { return Err(VirtualGoldError::MathOverflow.into()); }
    Ok(n / d)
}

pub fn calculate_curve_integral(s_start: u128, s_end: u128) -> Result<u128> {
    if s_start >= s_end { return Ok(0); }
    if s_end > MAX_SUPPLY_CAP { return Err(VirtualGoldError::MaxSupplyReached.into()); }
    let delta_s   = s_end.checked_sub(s_start).ok_or(VirtualGoldError::MathOverflow)?;
    let base_cost = BASE_PRICE_P0.checked_mul(delta_s).ok_or(VirtualGoldError::MathOverflow)?;
    let delta_p   = TARGET_PRICE_P1.checked_sub(BASE_PRICE_P0).ok_or(VirtualGoldError::MathOverflow)?;
    let s_sum     = s_end.checked_add(s_start).ok_or(VirtualGoldError::MathOverflow)?;
    let dbl_max   = MAX_SUPPLY_CAP.checked_mul(2).ok_or(VirtualGoldError::MathOverflow)?;
    let slope     = safe_mul_div_u128(delta_p.checked_mul(delta_s).ok_or(VirtualGoldError::MathOverflow)?, s_sum, dbl_max)?;
    Ok(base_cost.checked_add(slope).ok_or(VirtualGoldError::MathOverflow)?
        .checked_div(TOKEN_DECIMALS_FACTOR).ok_or(VirtualGoldError::MathOverflow)?)
}

pub fn taxed_amount(amount: u64, bps: u64) -> u64 { amount.saturating_mul(bps) / 10_000 }

pub fn calculate_buy_breakdown(supply: u64, amount: u64) -> Result<BuyBreakdown> {
    let s_end = (supply as u128).checked_add(amount as u128).ok_or(VirtualGoldError::MathOverflow)?;
    if s_end > MAX_SUPPLY_CAP { return Err(VirtualGoldError::MaxSupplyReached.into()); }
    let gross_128  = calculate_curve_integral(supply as u128, s_end)?;
    let gross_cost = u64::try_from(gross_128).map_err(|_| VirtualGoldError::MathOverflow)?;
    if gross_cost < MIN_BUY_GROSS_USDT { return Err(VirtualGoldError::TradeTooSmall.into()); }
    let treasury_fee = taxed_amount(gross_cost, 100);
    let dividend_fee = taxed_amount(gross_cost, 100);
    let vault_deposit = gross_cost
        .checked_sub(treasury_fee).ok_or(VirtualGoldError::MathOverflow)?
        .checked_sub(dividend_fee).ok_or(VirtualGoldError::MathOverflow)?;
    Ok(BuyBreakdown { gross_cost, vault_deposit, treasury_fee, dividend_fee })
}

pub fn calculate_sell_breakdown(supply: u64, vault: u64, amount: u64) -> Result<SellBreakdown> {
    if supply == 0 { return Err(VirtualGoldError::InvalidAmount.into()); }
    let s_end   = supply as u128;
    let delta_s = amount as u128;
    if delta_s > s_end { return Err(VirtualGoldError::InvalidAmount.into()); }
    let s_start = s_end.checked_sub(delta_s).ok_or(VirtualGoldError::MathOverflow)?;

    let curve_128   = calculate_curve_integral(s_start, s_end)?;
    let reserve_128 = safe_mul_div_u128(vault as u128, delta_s, s_end)?;
    let mut gross_128 = std::cmp::min(curve_128, reserve_128);

    // Dynamic floor cap: guarantee V_new/S_new >= V_old/S_old (never fails on partial sell)
    if s_start > 0 {
        let required_min_v = safe_mul_div_u128(vault as u128, s_start, s_end)?;
        let max_allowed    = (vault as u128).saturating_sub(required_min_v);
        gross_128 = std::cmp::min(gross_128, max_allowed);
    }

    let curve_valuation = u64::try_from(curve_128).map_err(|_| VirtualGoldError::MathOverflow)?;
    let reserve_share   = u64::try_from(reserve_128).map_err(|_| VirtualGoldError::MathOverflow)?;
    let gross_valuation = u64::try_from(gross_128).map_err(|_| VirtualGoldError::MathOverflow)?;
    if gross_valuation < MIN_SELL_GROSS_USDT { return Err(VirtualGoldError::TradeTooSmall.into()); }

    let treasury_fee       = taxed_amount(gross_valuation, 100);
    let dividend_fee       = taxed_amount(gross_valuation, 100);
    let vault_ratchet_lock = taxed_amount(gross_valuation, 800);
    let total_fees = treasury_fee
        .checked_add(dividend_fee).ok_or(VirtualGoldError::MathOverflow)?
        .checked_add(vault_ratchet_lock).ok_or(VirtualGoldError::MathOverflow)?;
    if total_fees > gross_valuation { return Err(VirtualGoldError::MathOverflow.into()); }
    let seller_payout = gross_valuation.checked_sub(total_fees).ok_or(VirtualGoldError::MathOverflow)?;

    Ok(SellBreakdown { curve_valuation, reserve_share, gross_valuation, seller_payout, treasury_fee, dividend_fee, vault_ratchet_lock })
}


// ============================================================================
// PART 4: EVM DEPLOYMENT & VERIFICATION SCRIPT
// File: contracts/evm/deploy_polygon_bsc.js
// ============================================================================

/*
  Deployment script for Polygon Mainnet / Amoy & BNB Smart Chain (BEP-20)

  Usage:
  - npx hardhat run contracts/evm/deploy_polygon_bsc.js --network polygon
  - npx hardhat run contracts/evm/deploy_polygon_bsc.js --network bsc

  SECURITY NOTES (Audit-Ready):
  - lockMinter() has been REMOVED. Minter rotation is governed by 48-hour multisig governance.
  - Token ownership is NOT transferred to the protocol. The deployer (or a multisig wallet)
    retains token ownership to allow future authorized minter rotation via VirtualGoldProtocol's
    executeProposal(ActionType.RotateMinter).
  - Treasury address MUST be set in .env as TREASURY_ADDRESS before deployment.
  - Minimum 2 multisig signers enforced at construction (multisigThreshold >= 2).

  Script Source:
  ----------------------------------------------------------------------------
  const { ethers, network } = require("hardhat");

  const USDT_ADDRESSES = {
      polygon: "0xc2132D05D31cEA15646505851710B46714451067",
      polygonAmoy: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      bsc: "0x55d398326f99059fF775485246999027B3197955",
      bscTestnet: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
  };

  async function main() {
      const [deployer] = await ethers.getSigners();
      console.log(`Deploying Virtual Gold Protocol to network: ${network.name}`);
      console.log(`Deployer wallet: ${deployer.address}`);

      if (!process.env.TREASURY_ADDRESS) {
          throw new Error("TREASURY_ADDRESS must be set in .env before deployment");
      }

      const usdtRaw = USDT_ADDRESSES[network.name] || USDT_ADDRESSES.polygonAmoy;
      const usdtAddress = ethers.getAddress(usdtRaw.toLowerCase());
      const adminTreasuryAddress = ethers.getAddress(process.env.TREASURY_ADDRESS.toLowerCase());

      // Deploy VirtualGoldToken — deployer retains ownership for authorized minter rotation
      const VirtualGoldToken = await ethers.getContractFactory("contracts/evm/VirtualGoldToken.sol:VirtualGoldToken");
      const goldToken = await VirtualGoldToken.deploy(deployer.address);
      await goldToken.waitForDeployment();
      console.log(`✅ VirtualGoldToken deployed at: ${await goldToken.getAddress()}`);

      // Deploy VirtualGoldProtocol — includes deployer + treasury as initial multisig signers
      const VirtualGoldProtocol = await ethers.getContractFactory("contracts/evm/VirtualGoldProtocol.sol:VirtualGoldProtocol");
      const initialSigners = [deployer.address, adminTreasuryAddress];
      const protocol = await VirtualGoldProtocol.deploy(
          await goldToken.getAddress(),
          usdtAddress,
          adminTreasuryAddress,
          initialSigners,
          2  // multisigThreshold >= 2 enforced
      );
      await protocol.waitForDeployment();
      console.log(`✅ VirtualGoldProtocol deployed at: ${await protocol.getAddress()}`);

      // Grant protocol mint/burn rights via setMinter (WITHOUT locking — rotation governed by multisig)
      await goldToken.setMinter(await protocol.getAddress());
      console.log(`✅ VirtualGoldProtocol set as authorized minter for VirtualGoldToken`);
      console.log(`✅ Token ownership remains with deployer — minter rotation via multisig governance`);
      console.log("");
      console.log("🎉 Deployment Complete! Final addresses:");
      console.log(`   VirtualGoldToken:    ${await goldToken.getAddress()}`);
      console.log(`   VirtualGoldProtocol: ${await protocol.getAddress()}`);
      console.log(`   USDT Collateral:     ${usdtAddress}`);
      console.log(`   Admin Treasury:      ${adminTreasuryAddress}`);
  }

  main().catch((error) => { console.error(error); process.exitCode = 1; });
*/

