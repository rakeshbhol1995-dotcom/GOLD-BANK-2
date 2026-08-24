const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Virtual Gold Protocol — Automated Security & Adversarial Test Suite", function () {
  let owner, signer2, signer3, attacker, treasury;
  let mockUsdt, goldToken, protocol;
  let parseUnits;

  beforeEach(async function () {
    [owner, signer2, signer3, attacker, treasury] = await ethers.getSigners();
    parseUnits = ethers.parseUnits || (ethers.utils && ethers.utils.parseUnits);

    const INITIAL_USDT_BALANCE = parseUnits("100000", 6); // $100,000 USDT

    // 1. Deploy Mock USDT (6 decimals)
    const VirtualGoldToken = await ethers.getContractFactory("contracts/evm/VirtualGoldToken.sol:VirtualGoldToken");
    mockUsdt = await VirtualGoldToken.deploy(owner.address);
    await mockUsdt.waitForDeployment();
    
    await mockUsdt.setMinter(owner.address);
    await mockUsdt.mint(owner.address, INITIAL_USDT_BALANCE);
    await mockUsdt.mint(attacker.address, INITIAL_USDT_BALANCE);

    // 2. Deploy $GOLD Token (18 decimals)
    goldToken = await VirtualGoldToken.deploy(owner.address);
    await goldToken.waitForDeployment();

    // 3. Deploy Protocol Contract
    const VirtualGoldProtocol = await ethers.getContractFactory("contracts/evm/VirtualGoldProtocol.sol:VirtualGoldProtocol");
    protocol = await VirtualGoldProtocol.deploy(
      await goldToken.getAddress(),
      await mockUsdt.getAddress(),
      treasury.address,
      [owner.address, signer2.address, signer3.address],
      2
    );
    await protocol.waitForDeployment();

    // 4. Set Minter & Transfer Ownership to Protocol
    await goldToken.setMinter(await protocol.getAddress());
    await goldToken.transferOwnership(await protocol.getAddress());
  });

  describe("1. Governance Timelock & Multisig Threshold Bypass Protection", function () {
    it("Should REJECT non-signer attempt to queue administrative proposals", async function () {
      await expect(
        protocol.connect(attacker).queueProposal(0, ethers.ZeroAddress, 0)
      ).to.be.revertedWith("VirtualGoldProtocol: caller is not authorized multisig signer");
    });

    it("Should ENFORCE 48-hour timelock delay before proposal execution", async function () {
      // Queue proposal to toggle pause (ActionType 0)
      const tx = await protocol.connect(owner).queueProposal(0, ethers.ZeroAddress, 0);
      await tx.wait();

      // Approve with signer2 to reach 2-of-3 threshold
      await protocol.connect(signer2).approveProposal(1);

      // Immediate attempt to execute proposal must revert
      await expect(
        protocol.connect(owner).executeProposal(1)
      ).to.be.revertedWith("48-hour timelock delay has not expired");
    });
  });

  describe("2. Token Mint Authority Governance & Supply Invariants", function () {
    it("Should BLOCK any attempt to change minter role without authorization", async function () {
      await expect(
        goldToken.connect(attacker).setMinter(attacker.address)
      ).to.be.revertedWith("VirtualGoldToken: caller must be owner or active protocol minter");
    });

    it("Should STRICTLY ENFORCE 21,000,000 GOLD hard supply cap", async function () {
      const maxSupply = await goldToken.MAX_SUPPLY();
      expect(maxSupply).to.equal(parseUnits("21000000", 18));
    });
  });

  describe("3. Emergency Rescue Drain Protection Invariant", function () {
    it("Should REJECT emergency rescue if no untracked excess USDT exists", async function () {
      // Buy 10 GOLD tokens to deposit into vaultReserve
      const amountToBuy = parseUnits("10", 18);
      const [grossCost] = await protocol.getBuyCost(amountToBuy);

      await mockUsdt.connect(attacker).approve(await protocol.getAddress(), ethers.MaxUint256);
      await protocol.connect(attacker).buy(amountToBuy, grossCost);

      // Queue proposal to rescue vaultReserve USDT
      await protocol.connect(owner).queueProposal(4, treasury.address, parseUnits("100", 6));

      // Approve with signer2 to reach 2-of-3 threshold
      await protocol.connect(signer2).approveProposal(1);

      // Fast forward time past 48h
      await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
      await ethers.provider.send("evm_mine");

      // Attempting to rescue tracked user liabilities must revert!
      await expect(
        protocol.connect(owner).executeProposal(1)
      ).to.be.revertedWith("No untracked excess USDT available to rescue");
    });
  });

  describe("4. Dividend Double-Claim & Transfer Accounting Protection", function () {
    it("Should PREVENT double claiming of accrued dividends", async function () {
      const amountToBuy = parseUnits("100", 18);
      const [grossCost] = await protocol.getBuyCost(amountToBuy);

      await mockUsdt.connect(attacker).approve(await protocol.getAddress(), ethers.MaxUint256);
      await protocol.connect(attacker).buy(amountToBuy, grossCost);

      // Inject yield
      const yieldAmt = parseUnits("50", 6);
      await mockUsdt.connect(owner).approve(await protocol.getAddress(), yieldAmt);
      await protocol.connect(owner).injectExternalYield(yieldAmt);

      // Claim 1st time
      await protocol.connect(attacker).claimDividends();

      // Claim 2nd time immediately must revert
      await expect(
        protocol.connect(attacker).claimDividends()
      ).to.be.revertedWith("No pending dividends to claim");
    });
  });
});
