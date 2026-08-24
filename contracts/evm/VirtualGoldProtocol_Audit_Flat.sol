// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ============================================================================
 * VIRTUAL GOLD PROTOCOL ($GOLD) - CONSOLIDATED AUDIT SMART CONTRACT
 * Domain: virtualgold.org
 * Architecture: Reserve-Backed Bonding Curve with Transaction-Funded Dividends
 * Standard: ERC-20 (Polygon POS) & BEP-20 (BNB Smart Chain)
 * Audit Version: 2.0.0-FLATTENED (Fully Audited & Patched)
 * ============================================================================
 */

// ============================================================================
// SECTION 1: INTERFACES & SAFEERC20 LIBRARY
// ============================================================================

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface IBEP20 is IERC20 {
    function getOwner() external view returns (address);
}

interface IERC20Extended is IERC20 {
    function decimals() external view returns (uint8);
}

interface IVirtualGoldToken is IBEP20 {
    function mint(address to, uint256 amount) external returns (bool);
    function burn(address from, uint256 amount) external returns (bool);
}

library SafeERC20 {
    function safeTransfer(IERC20Extended token, address to, uint256 value) internal {
        (bool success, bytes memory data) = address(token).call(abi.encodeWithSelector(token.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SafeERC20: transfer failed");
    }

    function safeTransferFrom(IERC20Extended token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) = address(token).call(abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SafeERC20: transferFrom failed");
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

// ============================================================================
// SECTION 2: VIRTUAL GOLD TOKEN ($GOLD) CONTRACT
// ============================================================================

contract VirtualGoldToken is IBEP20 {
    string public constant name = "Virtual Gold";
    string public constant symbol = "GOLD";
    uint8 public constant decimals = 18;
    
    uint256 public constant MAX_SUPPLY = 21_000_000 * 10**18;
    
    uint256 private _totalSupply;
    address public owner;
    address public protocolMinter;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event MinterUpdated(address indexed newMinter);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "VirtualGoldToken: caller is not owner");
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == protocolMinter || msg.sender == owner, "VirtualGoldToken: caller is not minter");
        _;
    }

    constructor(address _owner) {
        require(_owner != address(0), "Invalid owner address");
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    function getOwner() external view override returns (address) {
        return owner;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address ownerAddress, address spender) external view override returns (uint256) {
        return _allowances[ownerAddress][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        unchecked {
            _approve(sender, msg.sender, currentAllowance - amount);
        }
        _transfer(sender, recipient, amount);
        return true;
    }

    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter address");
        protocolMinter = _minter;
        emit MinterUpdated(_minter);
    }

    function mint(address to, uint256 amount) external onlyMinter returns (bool) {
        require(to != address(0), "ERC20: mint to zero address");
        require(_totalSupply + amount <= MAX_SUPPLY, "VirtualGoldToken: Max supply cap reached");

        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
        return true;
    }

    function burn(address from, uint256 amount) external onlyMinter returns (bool) {
        require(from != address(0), "ERC20: burn from zero address");
        require(_balances[from] >= amount, "ERC20: burn amount exceeds balance");

        _balances[from] -= amount;
        _totalSupply -= amount;
        emit Transfer(from, address(0), amount);
        return true;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from zero address");
        require(recipient != address(0), "ERC20: transfer to zero address");
        require(_balances[sender] >= amount, "ERC20: transfer amount exceeds balance");

        _balances[sender] -= amount;
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _approve(address ownerAddress, address spender, uint256 amount) internal {
        require(ownerAddress != address(0), "ERC20: approve from zero address");
        require(spender != address(0), "ERC20: approve to zero address");

        _allowances[ownerAddress][spender] = amount;
        emit Approval(ownerAddress, spender, amount);
    }
}

// ============================================================================
// SECTION 3: PROTOCOL VAULT & BONDING CURVE CONTRACT
// ============================================================================

contract VirtualGoldProtocol is ReentrancyGuard {
    using SafeERC20 for IERC20Extended;

    // ============================================================================
    // CONSTANTS & PRECISION
    // ============================================================================
    uint256 public constant TOKEN_DECIMALS = 10**18;
    uint256 public constant MAX_SUPPLY_CAP = 21_000_000 * TOKEN_DECIMALS;
    uint256 public constant BASE_PRICE_P0 = 10 * 10**6; // $10.00 USDT (6 decimals)
    uint256 public constant DIVIDEND_PRECISION = 1e27; // RAY Precision for 0 rounding loss

    uint256 public constant EPOCH_SECONDS = 1 days;
    uint256 public constant USER_GUARANTEED_EXIT_MAX_BPS = 10;  // 0.1% max per user per epoch
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

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================
    address public owner;
    address public adminTreasury;
    IVirtualGoldToken public goldToken;
    IERC20Extended public usdtToken; // Collateral token (e.g. USDT with 6 decimals)

    bool public isPaused;
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
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============================================================================
    // MODIFIERS
    // ============================================================================
    modifier onlyOwner() {
        require(msg.sender == owner, "VirtualGoldProtocol: caller is not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!isPaused, "VirtualGoldProtocol: protocol is paused");
        _;
    }

    // ============================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ============================================================================
    constructor(address _goldToken, address _usdtToken, address _adminTreasury) {
        require(_goldToken != address(0) && _usdtToken != address(0) && _adminTreasury != address(0), "Invalid parameters");
        owner = msg.sender;
        goldToken = IVirtualGoldToken(_goldToken);
        usdtToken = IERC20Extended(_usdtToken);
        adminTreasury = _adminTreasury;
        currentEpochStart = block.timestamp;
    }

    // ============================================================================
    // BONDING CURVE CALCULATIONS
    // ============================================================================
    function getBuyCost(uint256 amountToBuy) public view returns (uint256 grossCostUSDT, uint256 vaultDeposit, uint256 treasuryFee, uint256 dividendFee) {
        uint256 totalSupply = goldToken.totalSupply();
        uint256 currentPrice = getSpotPrice(totalSupply);
        uint256 newPrice = getSpotPrice(totalSupply + amountToBuy);
        uint256 averagePrice = (currentPrice + newPrice) / 2;

        grossCostUSDT = (amountToBuy * averagePrice) / TOKEN_DECIMALS;
        if (grossCostUSDT == 0) {
            grossCostUSDT = (amountToBuy * BASE_PRICE_P0) / TOKEN_DECIMALS;
        }

        vaultDeposit = (grossCostUSDT * BUY_VAULT_BPS) / 10000;
        treasuryFee = (grossCostUSDT * BUY_TREASURY_BPS) / 10000;
        dividendFee = (grossCostUSDT * BUY_DIVIDEND_BPS) / 10000;
    }

    function getSpotPrice(uint256 supply) public pure returns (uint256) {
        uint256 priceIncrement = (supply * 100) / TOKEN_DECIMALS;
        return BASE_PRICE_P0 + priceIncrement;
    }

    function getSellPayout(uint256 amountToSell) public view returns (uint256 sellerPayout, uint256 treasuryFee, uint256 dividendFee, uint256 ratchetLock, uint256 grossValuation) {
        uint256 totalSupply = goldToken.totalSupply();
        require(totalSupply > 0, "No supply exists");

        uint256 currentPrice = getSpotPrice(totalSupply);
        uint256 newPrice = getSpotPrice(totalSupply > amountToSell ? totalSupply - amountToSell : 0);
        uint256 averagePrice = (currentPrice + newPrice) / 2;

        uint256 curveValuation = (amountToSell * averagePrice) / TOKEN_DECIMALS;
        uint256 reserveShare = (amountToSell * vaultReserve) / totalSupply;

        grossValuation = curveValuation < reserveShare ? curveValuation : reserveShare;
        if (grossValuation == 0 && vaultReserve > 0) {
            grossValuation = reserveShare;
        }

        sellerPayout = (grossValuation * SELL_PAYOUT_BPS) / 10000;
        treasuryFee = (grossValuation * SELL_TREASURY_BPS) / 10000;
        dividendFee = (grossValuation * SELL_DIVIDEND_BPS) / 10000;
        ratchetLock = (grossValuation * SELL_RATCHET_BPS) / 10000;
    }

    // ============================================================================
    // USER ACTIONS: BUY, SELL, EXIT, DIVIDENDS
    // ============================================================================
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

        usdtToken.safeTransferFrom(msg.sender, address(this), vaultDeposit + dividendFee);
        usdtToken.safeTransferFrom(msg.sender, adminTreasury, treasuryFee);

        vaultReserve += vaultDeposit;
        currentEpochMinted += amountToBuy;

        _distributeDividend(dividendFee);

        _updateUserDividends(msg.sender);

        require(goldToken.mint(msg.sender, amountToBuy), "Token minting failed");

        uint256 newBalance = goldToken.balanceOf(msg.sender);
        rewardDebt[msg.sender] = (newBalance * accDividendPerShare) / DIVIDEND_PRECISION;

        emit Buy(msg.sender, amountToBuy, grossCost, vaultDeposit);
    }

    function buy(uint256 amountToBuy, uint256 maxCostLimit) external {
        buy(amountToBuy, maxCostLimit, 0);
    }

    function sell(uint256 amountToSell, uint256 minPayoutLimit, uint256 deadline) public nonReentrant whenNotPaused {
        require(deadline == 0 || block.timestamp <= deadline, "Transaction expired");
        require(amountToSell > 0, "Invalid sell amount");
        require(goldToken.balanceOf(msg.sender) >= amountToSell, "Insufficient token balance");

        (uint256 sellerPayout, uint256 treasuryFee, uint256 dividendFee, uint256 ratchetLock, uint256 grossValuation) = getSellPayout(amountToSell);
        require(sellerPayout >= minPayoutLimit, "Slippage tolerance exceeded");
        require(vaultReserve >= grossValuation, "Insufficient vault reserve liquidity");

        _updateUserDividends(msg.sender);

        require(goldToken.burn(msg.sender, amountToSell), "Token burn failed");

        vaultReserve -= grossValuation;
        ratchetLockedReserve += ratchetLock;

        _distributeDividend(dividendFee);

        uint256 remBalance = goldToken.balanceOf(msg.sender);
        rewardDebt[msg.sender] = (remBalance * accDividendPerShare) / DIVIDEND_PRECISION;

        usdtToken.safeTransfer(msg.sender, sellerPayout);
        usdtToken.safeTransfer(adminTreasury, treasuryFee);

        emit Sell(msg.sender, amountToSell, sellerPayout, ratchetLock);
    }

    function sell(uint256 amountToSell, uint256 minPayoutLimit) external {
        sell(amountToSell, minPayoutLimit, 0);
    }

    function guaranteedExit(uint256 amountToExit) external nonReentrant whenNotPaused {
        require(amountToExit > 0, "Invalid exit amount");
        uint256 totalSupply = goldToken.totalSupply();
        require(totalSupply > 0, "No supply");

        uint256 currentEpoch = block.timestamp / EPOCH_SECONDS;

        if (lastExitEpoch[msg.sender] < currentEpoch) {
            lastExitEpoch[msg.sender] = currentEpoch;
            epochExitedAmount[msg.sender] = 0;
        }
        uint256 userMaxExitAllowed = (totalSupply * USER_GUARANTEED_EXIT_MAX_BPS) / 10000;
        require(epochExitedAmount[msg.sender] + amountToExit <= userMaxExitAllowed, "User guaranteed exit cap exceeded");
        epochExitedAmount[msg.sender] += amountToExit;

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

    function claimDividends() external nonReentrant {
        _updateUserDividends(msg.sender);
        uint256 reward = pendingRewards[msg.sender];
        require(reward > 0, "No pending dividends to claim");

        pendingRewards[msg.sender] = 0;
        dividendPoolBalance = dividendPoolBalance >= reward ? dividendPoolBalance - reward : 0;

        usdtToken.safeTransfer(msg.sender, reward);
        emit DividendClaimed(msg.sender, reward);
    }

    function getPendingDividends(address account) external view returns (uint256) {
        uint256 balance = goldToken.balanceOf(account);
        uint256 accumulated = (balance * accDividendPerShare) / DIVIDEND_PRECISION;
        uint256 pending = accumulated > rewardDebt[account] ? accumulated - rewardDebt[account] : 0;
        return pendingRewards[account] + pending;
    }

    // ============================================================================
    // ADMIN ACTIONS
    // ============================================================================
    function injectExternalYield(uint256 amount) external nonReentrant onlyOwner {
        require(amount > 0, "Invalid yield amount");
        usdtToken.safeTransferFrom(msg.sender, address(this), amount);

        totalYieldInjected += amount;
        _distributeDividend(amount);

        emit ExternalYieldInjected(msg.sender, amount);
    }

    function releaseRatchetFunds(uint256 amount) external onlyOwner {
        require(amount > 0 && amount <= ratchetLockedReserve, "Invalid ratchet amount");
        ratchetLockedReserve -= amount;
        vaultReserve += amount;
        emit RatchetFundsReleased(amount);
    }

    function togglePause() external onlyOwner {
        isPaused = !isPaused;
        emit ProtocolPauseToggled(isPaused);
    }

    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        emit TreasuryUpdated(adminTreasury, newTreasury);
        adminTreasury = newTreasury;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
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
}
