// Deployment script for Polygon and BEP-20 (Binance Smart Chain)
// Run with: npx hardhat run contracts/evm/deploy_polygon_bsc.js --network polygon
// Run with: npx hardhat run contracts/evm/deploy_polygon_bsc.js --network bsc
//
// SECURITY NOTES (Audit-Ready):
// - lockMinter() has been REMOVED. Minter rotation is governed by 48-hour multisig governance.
// - Token ownership is NOT transferred to the protocol. The deployer retains token ownership
//   to allow future authorized minter rotation via VirtualGoldProtocol's
//   executeProposal(ActionType.RotateMinter).
// - TREASURY_ADDRESS must be set in .env before deployment.
// - Minimum 2 multisig signers enforced at construction (multisigThreshold >= 2).

const { ethers, network } = require("hardhat");

// Official USDT Contract Addresses on Polygon & BSC
const USDT_ADDRESSES = {
    // Polygon Mainnet USDT (6 decimals)
    polygon: "0xc2132D05D31cEA15646505851710B46714451067",
    // Polygon Amoy Testnet Mock USDT
    polygonAmoy: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    // BSC Mainnet USDT (18 decimals)
    bsc: "0x55d398326f99059fF775485246999027B3197955",
    // BSC Testnet Mock USDT
    bscTestnet: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
};

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=================================================");
    console.log(`Deploying Virtual Gold Protocol to network: ${network.name}`);
    console.log(`Deployer Account: ${deployer.address}`);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Deployer Balance: ${ethers.formatEther(balance)} Native Tokens`);
    console.log("=================================================");

    if (!process.env.TREASURY_ADDRESS) {
        throw new Error("TREASURY_ADDRESS must be set in .env before deployment. Aborting.");
    }

    const usdtRaw = USDT_ADDRESSES[network.name] || USDT_ADDRESSES.polygonAmoy;
    const usdtAddress = ethers.getAddress(usdtRaw.toLowerCase());
    const adminTreasuryAddress = ethers.getAddress(process.env.TREASURY_ADDRESS.toLowerCase());

    console.log(`Using USDT Collateral Address: ${usdtAddress}`);
    console.log(`Using Admin Treasury Address:  ${adminTreasuryAddress}`);

    // 1. Deploy Token — deployer retains ownership for multisig-governed minter rotation
    console.log("\n1. Deploying VirtualGoldToken ($GOLD)...");
    const VirtualGoldToken = await ethers.getContractFactory("contracts/evm/VirtualGoldToken.sol:VirtualGoldToken");
    const goldToken = await VirtualGoldToken.deploy(deployer.address);
    await goldToken.waitForDeployment();
    const tokenAddress = await goldToken.getAddress();
    console.log(`✅ VirtualGoldToken deployed at: ${tokenAddress}`);

    // 2. Deploy Protocol (Passing initial signers & threshold = 2 for 2-of-N multisig)
    console.log("\n2. Deploying VirtualGoldProtocol...");
    const VirtualGoldProtocol = await ethers.getContractFactory("contracts/evm/VirtualGoldProtocol.sol:VirtualGoldProtocol");
    const initialSigners = [deployer.address, adminTreasuryAddress];
    const protocol = await VirtualGoldProtocol.deploy(tokenAddress, usdtAddress, adminTreasuryAddress, initialSigners, 2);
    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();
    console.log(`✅ VirtualGoldProtocol deployed at: ${protocolAddress}`);

    // 3. Grant Minter Role to Protocol (no permanent lock — rotation via 48h multisig governance)
    console.log("\n3. Granting Minter Role to VirtualGoldProtocol...");
    const tx1 = await goldToken.setMinter(protocolAddress);
    await tx1.wait();
    console.log("✅ VirtualGoldProtocol set as authorized minter for VirtualGoldToken.");
    console.log("✅ Token ownership remains with deployer — minter rotation via multisig governance.");

    console.log("\n=================================================");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log(`Network:                 ${network.name}`);
    console.log(`$GOLD Token Address:    ${tokenAddress}`);
    console.log(`Protocol Vault Address: ${protocolAddress}`);
    console.log(`USDT Collateral:        ${usdtAddress}`);
    console.log(`Admin Treasury:         ${adminTreasuryAddress}`);
    console.log("=================================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
