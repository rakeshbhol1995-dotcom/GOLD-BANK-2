/** @type import('hardhat/config').HardhatUserConfig */
require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

function getPrivateKey() {
  let key = (process.env.PRIVATE_KEY || "").trim().replace(/^["']|["']$/g, '');
  if (!key || /^0x0+$/.test(key) || key.length < 10) {
    console.warn("⚠️ WARNING: PRIVATE_KEY in .env is missing or all zeros! Please update .env file with your actual wallet Private Key.");
    return "0x0000000000000000000000000000000000000000000000000000000000000001";
  }
  if (!key.startsWith("0x")) {
    key = "0x" + key;
  }
  return key;
}

const PRIVATE_KEY = getPrivateKey();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts/evm",
    tests: "./test/evm",
    cache: "./cache_hardhat",
    artifacts: "./artifacts_hardhat",
  },
  networks: {
    hardhat: {},
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com",
      accounts: [PRIVATE_KEY],
      chainId: 137,
    },
    polygonAmoy: {
      url: (!process.env.POLYGON_AMOY_RPC_URL || process.env.POLYGON_AMOY_RPC_URL.includes("rpc-amoy.polygon.technology"))
        ? "https://polygon-amoy.drpc.org"
        : process.env.POLYGON_AMOY_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002,
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
      accounts: [PRIVATE_KEY],
      chainId: 56,
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [PRIVATE_KEY],
      chainId: 97,
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
    },
  },
};
