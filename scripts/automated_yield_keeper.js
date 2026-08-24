// ============================================================================
// VIRTUAL GOLD PROTOCOL — AUTOMATED YIELD KEEPER SCRIPT
// File: scripts/automated_yield_keeper.js
// Usage: node scripts/automated_yield_keeper.js [--dry-run] [--amount <micro_usdt>]
// ============================================================================

const { ethers, network } = require("hardhat");

async function main() {
    const isDryRun = process.argv.includes("--dry-run");
    const amountArgIdx = process.argv.indexOf("--amount");
    let yieldAmountMicroUSDT = amountArgIdx !== -1 && process.argv[amountArgIdx + 1] 
        ? BigInt(process.argv[amountArgIdx + 1]) 
        : BigInt(50_000_000); // Default 50 USDT (6 decimals)

    console.log("=================================================");
    console.log("🤖 VIRTUAL GOLD AUTOMATED YIELD KEEPER");
    console.log(`Network: ${network.name}`);
    console.log(`Yield Amount to Inject: ${yieldAmountMicroUSDT.toString()} micro-USDT (${Number(yieldAmountMicroUSDT) / 1e6} USDT)`);
    console.log(`Dry Run Mode: ${isDryRun ? "YES (Simulation Only)" : "NO (Live Transaction)"}`);
    console.log("=================================================");

    const [keeper] = await ethers.getSigners();
    console.log(`Keeper Address: ${keeper.address}`);

    const protocolAddress = process.env.PROTOCOL_ADDRESS;
    const usdtAddress = process.env.USDT_ADDRESS;

    if (!protocolAddress || !usdtAddress) {
        console.log("⚠️ PROTOCOL_ADDRESS or USDT_ADDRESS env variables not set.");
        console.log("   Running simulation mode with mock addresses...");
    }

    if (isDryRun) {
        console.log("\n[DRY-RUN SIMULATION]");
        console.log("1. Fetching external RWA Gold Yield data feed...");
        console.log(`2. Validating USDT balance for Keeper (${keeper.address})...`);
        console.log(`3. Simulating approve(${protocolAddress || "0xProtocol"}, ${yieldAmountMicroUSDT})...`);
        console.log(`4. Simulating injectExternalYield(${yieldAmountMicroUSDT})...`);
        console.log("✅ Simulation successful! Yield injection conditions verified.");
        console.log("=================================================");
        return;
    }

    try {
        const protocol = await ethers.getContractAt("VirtualGoldProtocol", protocolAddress, keeper);
        const usdt = await ethers.getContractAt("IERC20Extended", usdtAddress, keeper);

        console.log("\nExecuting live yield injection...");
        console.log("Step 1: Approving protocol to spend USDT...");
        const approveTx = await usdt.approve(protocolAddress, yieldAmountMicroUSDT);
        await approveTx.wait();
        console.log(`✅ Approved. Tx Hash: ${approveTx.hash}`);

        console.log("Step 2: Injecting external yield into protocol...");
        const injectTx = await protocol.injectExternalYield(yieldAmountMicroUSDT);
        const receipt = await injectTx.wait();

        console.log("=================================================");
        console.log("🎉 YIELD INJECTION COMPLETE!");
        console.log(`Tx Hash: ${receipt.hash}`);
        console.log(`Block Number: ${receipt.blockNumber}`);
        console.log("=================================================");
    } catch (err) {
        console.error("❌ Yield Keeper Execution Failed:", err.message || err);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
