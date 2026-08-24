// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VirtualGoldProtocol
 * @notice Reserve-Backed Bonding Curve Protocol for Virtual Gold ($GOLD) on EVM Chains (Polygon & BEP-20 / BSC).
 * @dev Manages Vault Reserves, 98%/1%/1% Buy Allocation, 90%/1%/1%/8% Sell Breakdown, Dividends, Ratchet Reserves, and Circuit Breakers.
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

        // Safe ERC-20 transfers for USDT (Handles non-standard Tether boolean returns)
        usdtToken.safeTransferFrom(msg.sender, address(this), vaultDeposit + dividendFee);
        usdtToken.safeTransferFrom(msg.sender, adminTreasury, treasuryFee);

        vaultReserve += vaultDeposit;
        currentEpochMinted += amountToBuy;

        // Distribute dividends with unallocated sweep support
        _distributeDividend(dividendFee);

        // Accrue user dividends before minting
        _updateUserDividends(msg.sender);

        // Mint GOLD to buyer
        require(goldToken.mint(msg.sender, amountToBuy), "Token minting failed");

        // Update reward debt after minting
        uint256 newBalance = goldToken.balanceOf(msg.sender);
        rewardDebt[msg.sender] = (newBalance * accDividendPerShare) / DIVIDEND_PRECISION;

        emit Buy(msg.sender, amountToBuy, grossCost, vaultDeposit);
    }

    function buy(uint256 amountToBuy, uint256 maxCostLimit) external {
        buy(amountToBuy, maxCostLimit, 0);
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

        // ✅ Settle dividends BEFORE burn — captures full pre-burn balance
        _updateUserDividends(msg.sender);

        // Burn user GOLD tokens
        require(goldToken.burn(msg.sender, amountToSell), "Token burn failed");

        vaultReserve -= grossValuation;
        ratchetLockedReserve += ratchetLock;

        // ✅ Distribute new sell-fee dividend to remaining holders
        _distributeDividend(dividendFee);

        // ✅ Update pending dividends for remaining balance after new dividend distribution
        _updateUserDividends(msg.sender);

        // ✅ Set rewardDebt on post-burn balance
        uint256 remBalance = goldToken.balanceOf(msg.sender);
        rewardDebt[msg.sender] = (remBalance * accDividendPerShare) / DIVIDEND_PRECISION;

        // Safe USDT transfers
        usdtToken.safeTransfer(msg.sender, sellerPayout);
        usdtToken.safeTransfer(adminTreasury, treasuryFee);

        emit Sell(msg.sender, amountToSell, sellerPayout, ratchetLock);
    }

    function sell(uint256 amountToSell, uint256 minPayoutLimit) external {
        sell(amountToSell, minPayoutLimit, 0);
    }

    /**
     * @notice Guaranteed Exit: Small holders can exit up to 0.1% supply per epoch at pure reserve value.
     * Enforces both per-user cap and global protocol-wide exit cap per epoch.
     */
    function guaranteedExit(uint256 amountToExit) external nonReentrant whenNotPaused {
        require(amountToExit > 0, "Invalid exit amount");
        uint256 totalSupply = goldToken.totalSupply();
        require(totalSupply > 0, "No supply");

        uint256 currentEpoch = block.timestamp / EPOCH_SECONDS;

        // 1. User Epoch Exit Limit
        if (lastExitEpoch[msg.sender] < currentEpoch) {
            lastExitEpoch[msg.sender] = currentEpoch;
            epochExitedAmount[msg.sender] = 0;
        }
        uint256 userMaxExitAllowed = (totalSupply * USER_GUARANTEED_EXIT_MAX_BPS) / 10000;
        require(epochExitedAmount[msg.sender] + amountToExit <= userMaxExitAllowed, "User guaranteed exit cap exceeded");
        epochExitedAmount[msg.sender] += amountToExit;

        // 2. Global Protocol Epoch Exit Limit (Prevents multi-wallet drain attacks)
        if (lastGlobalExitEpoch < currentEpoch) {
            lastGlobalExitEpoch = currentEpoch;
            globalEpochExitedAmount = 0;
        }
        uint256 globalMaxExitAllowed = (totalSupply * GLOBAL_GUARANTEED_EXIT_MAX_BPS) / 10000;
        require(globalEpochExitedAmount + amountToExit <= globalMaxExitAllowed, "Global protocol exit cap reached for this epoch");
        globalEpochExitedAmount += amountToExit;

        uint256 pureReserveShare = (amountToExit * vaultReserve) / totalSupply;
        require(vaultReserve >= pureReserveShare, "Insufficient vault liquidity");

        _updateUserDividends(msg.sender);

        require(goldToken.burn(msg.sender, amountToExit), "Token burn failed");
        vaultReserve -= pureReserveShare;

        uint256 remBalance = goldToken.balanceOf(msg.sender);
        rewardDebt[msg.sender] = (remBalance * accDividendPerShare) / DIVIDEND_PRECISION;

        usdtToken.safeTransfer(msg.sender, pureReserveShare);
        emit GuaranteedExit(msg.sender, amountToExit, pureReserveShare);
    }

    /**
     * @notice Claim accumulated USDT dividends.
     */
    function claimDividends() external nonReentrant {
        _updateUserDividends(msg.sender);
        uint256 reward = pendingRewards[msg.sender];
        require(reward > 0, "No pending dividends to claim");

        pendingRewards[msg.sender] = 0;
        uint256 balance = goldToken.balanceOf(msg.sender);
        rewardDebt[msg.sender] = (balance * accDividendPerShare) / DIVIDEND_PRECISION;

        dividendPoolBalance = dividendPoolBalance >= reward ? dividendPoolBalance - reward : 0;

        usdtToken.safeTransfer(msg.sender, reward);
        emit DividendClaimed(msg.sender, reward);
    }

    /**
     * @notice View pending dividends for an account.
     */
    function getPendingDividends(address account) external view returns (uint256) {
        uint256 balance = goldToken.balanceOf(account);
        uint256 accumulated = (balance * accDividendPerShare) / DIVIDEND_PRECISION;
        uint256 pending = accumulated > rewardDebt[account] ? accumulated - rewardDebt[account] : 0;
        return pendingRewards[account] + pending;
    }

    // ============================================================================
    // TOKEN TRANSFER HOOKS (Settle Dividends on Direct ERC20 Transfer / TransferFrom)
    // ============================================================================
    /**
     * @notice Hook invoked by VirtualGoldToken before balance updates to settle accrued dividends.
     */
    function onTokenTransfer(address sender, address recipient) external {
        if (msg.sender != address(goldToken)) return;
        if (sender != address(0)) {
            _updateUserDividends(sender);
        }
        if (recipient != address(0)) {
            _updateUserDividends(recipient);
        }
    }

    /**
     * @notice Hook invoked by VirtualGoldToken after balance updates to reset rewardDebt for new balances.
     */
    function onTokenTransferPost(address sender, address recipient) external {
        if (msg.sender != address(goldToken)) return;
        if (sender != address(0)) {
            rewardDebt[sender] = (goldToken.balanceOf(sender) * accDividendPerShare) / DIVIDEND_PRECISION;
        }
        if (recipient != address(0)) {
            rewardDebt[recipient] = (goldToken.balanceOf(recipient) * accDividendPerShare) / DIVIDEND_PRECISION;
        }
    }

    // ============================================================================
    // EXTERNAL YIELD INJECTION & 48-HOUR MULTISIG GOVERNANCE ACTIONS
    // ============================================================================
    /**
     * @notice Injects external yield into the dividend pool.
     */
    function injectExternalYield(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid yield amount");
        usdtToken.safeTransferFrom(msg.sender, address(this), amount);

        totalYieldInjected += amount;
        _distributeDividend(amount);

        emit ExternalYieldInjected(msg.sender, amount);
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
     * @notice Execute a queued proposal AFTER 48-hour timelock delay AND multisig threshold approval.
    uint256 public constant PROPOSAL_EXPIRATION = 7 days;

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
     * @return internalReserve Vault reserve allocated for buy/sell bonding curve liquidity
     * @return ratchetReserve Permanent floor reserve locked in ratchet vault
     * @return dividendPool Pending undistributed dividend balance
     * @return totalTrackedLiabilities Total protocol liabilities (vaultReserve + ratchetLockedReserve + dividendPoolBalance)
     * @return physicalUsdtBalance Physical USDT token balance held by the contract address
     * @return surplusOrDeficit Surplus (+) or Deficit (-) between physical balance and tracked liabilities
     * @return isSolvent True if physical USDT balance is greater than or equal to total tracked liabilities
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
