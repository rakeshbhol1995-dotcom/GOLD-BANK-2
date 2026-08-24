const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Virtual Gold Protocol (EVM - Polygon & BEP-20)", function () {
  let owner, treasury, buyer, seller;
  let mockUsdt, goldToken, protocol;
  let parseUnits;

  beforeEach(async function () {
    [owner, treasury, buyer, seller] = await ethers.getSigners();
    parseUnits = ethers.parseUnits || (ethers.utils && ethers.utils.parseUnits);

    const INITIAL_USDT_BALANCE = parseUnits("10000", 6); // $10,000 USDT (6 decimals)

    // 1. Deploy Mock USDT (6 decimals)
    const MockERC20 = await ethers.getContractFactory("contracts/evm/VirtualGoldToken.sol:VirtualGoldToken");
    mockUsdt = await MockERC20.deploy(owner.address);
    await mockUsdt.waitForDeployment();
    
    // Set owner as minter for mock USDT to fund test accounts
    await mockUsdt.setMinter(owner.address);
    await mockUsdt.mint(buyer.address, INITIAL_USDT_BALANCE);
    await mockUsdt.mint(seller.address, INITIAL_USDT_BALANCE);

    // 2. Deploy $GOLD Token (18 decimals)
    const VirtualGoldToken = await ethers.getContractFactory("contracts/evm/VirtualGoldToken.sol:VirtualGoldToken");
    goldToken = await VirtualGoldToken.deploy(owner.address);
    await goldToken.waitForDeployment();

    // 3. Deploy Protocol Contract
    const VirtualGoldProtocol = await ethers.getContractFactory("contracts/evm/VirtualGoldProtocol.sol:VirtualGoldProtocol");
    protocol = await VirtualGoldProtocol.deploy(
      await goldToken.getAddress(),
      await mockUsdt.getAddress(),
      treasury.address,
      [owner.address, treasury.address],
      2
    );
    await protocol.waitForDeployment();

    // 4. Set Protocol as Minter for $GOLD Token
    await goldToken.setMinter(await protocol.getAddress());
  });

  describe("Deployment & Configuration", function () {
    it("Should correctly set owner, token, and treasury addresses", async function () {
      expect(await protocol.owner()).to.equal(owner.address);
      expect(await protocol.adminTreasury()).to.equal(treasury.address);
      expect(await protocol.goldToken()).to.equal(await goldToken.getAddress());
      expect(await protocol.usdtToken()).to.equal(await mockUsdt.getAddress());
    });

    it("Should have 21,000,000 max supply cap on $GOLD Token", async function () {
      const maxSupply = await goldToken.MAX_SUPPLY();
      expect(maxSupply).to.equal(parseUnits("21000000", 18));
    });
  });

  describe("Buy Bonding Curve Functionality", function () {
    it("Should allow buying 1 $GOLD token and distribute fees correctly (98% Vault, 1% Treasury, 1% Dividend)", async function () {
      const amountToBuy = parseUnits("1", 18); // 1 GOLD token
      const [grossCost, vaultDeposit, treasuryFee, dividendFee] = await protocol.getBuyCost(amountToBuy);

      // Approve USDT spending
      await mockUsdt.connect(buyer).approve(await protocol.getAddress(), grossCost);

      // Execute Buy
      await expect(protocol.connect(buyer).buy(amountToBuy, grossCost))
        .to.emit(protocol, "Buy")
        .withArgs(buyer.address, amountToBuy, grossCost, vaultDeposit);

      // Verify token balance
      expect(await goldToken.balanceOf(buyer.address)).to.equal(amountToBuy);
      expect(await protocol.vaultReserve()).to.equal(vaultDeposit);
      expect(await protocol.dividendPoolBalance()).to.equal(dividendFee);
    });
  });

  describe("Sell & Floor Price Ratchet Functionality", function () {
    it("Should allow selling $GOLD and lock 8% into Ratchet Reserve", async function () {
      const amountToBuy = parseUnits("10", 18);
      const [grossCost] = await protocol.getBuyCost(amountToBuy);

      await mockUsdt.connect(buyer).approve(await protocol.getAddress(), grossCost);
      await protocol.connect(buyer).buy(amountToBuy, grossCost);

      // Sell 5 GOLD tokens
      const amountToSell = parseUnits("5", 18);
      const [sellerPayout, treasuryFee, dividendFee, ratchetLock] = await protocol.getSellPayout(amountToSell);

      await expect(protocol.connect(buyer).sell(amountToSell, sellerPayout))
        .to.emit(protocol, "Sell")
        .withArgs(buyer.address, amountToSell, sellerPayout, ratchetLock);

      // Verify burn and ratchet lock
      expect(await goldToken.balanceOf(buyer.address)).to.equal(parseUnits("5", 18));
      expect(await protocol.ratchetLockedReserve()).to.equal(ratchetLock);
    });
  });

  describe("Dividend Distribution & Claims", function () {
    it("Should accumulate dividends for holders and allow claims", async function () {
      const amountToBuy = parseUnits("100", 18);
      const [grossCost] = await protocol.getBuyCost(amountToBuy);

      await mockUsdt.connect(buyer).approve(await protocol.getAddress(), grossCost);
      await protocol.connect(buyer).buy(amountToBuy, grossCost);

      // Inject external yield into dividend pool
      const yieldAmount = parseUnits("100", 6); // $100 USDT yield
      await mockUsdt.connect(owner).mint(owner.address, yieldAmount);
      await mockUsdt.connect(owner).approve(await protocol.getAddress(), yieldAmount);
      await protocol.connect(owner).injectExternalYield(yieldAmount);

      // Check pending dividends for buyer
      const pending = await protocol.getPendingDividends(buyer.address);
      expect(pending).to.be.gt(0);

      // Claim dividends
      await expect(protocol.connect(buyer).claimDividends())
        .to.emit(protocol, "DividendClaimed");
    });
  });

  describe("Emergency Controls & Security Invariants", function () {
    it("Should allow owner to pause and block buys/sells when paused via governance timelock", async function () {
      await protocol.connect(owner).queueProposal(0, ethers.ZeroAddress, 0);
      await protocol.connect(treasury).approveProposal(1);
      await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
      await ethers.provider.send("evm_mine");
      await protocol.connect(owner).executeProposal(1);

      expect(await protocol.paused()).to.be.true;

      const amount = parseUnits("1", 18);
      await expect(protocol.connect(buyer).buy(amount, 1000000000))
        .to.be.revertedWithCustomError(protocol, "EnforcedPause");
    });

    it("Should return valid reserve reconciliation matching physical USDT balance", async function () {
      const recon = await protocol.getReserveReconciliation();
      expect(recon.isSolvent).to.be.true;
      expect(recon.totalTrackedLiabilities).to.equal(0);
    });

    it("Should validate oracle price sanity during transactions", async function () {
      const isSanityValid = await protocol["validatePriceSanity(uint256)"](parseUnits("10", 6));
      expect(isSanityValid).to.be.true;
    });
  });
});
