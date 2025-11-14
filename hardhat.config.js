require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    'arc-testnet': { url: 'https://rpc.testnet.arc.network' },
  },
  defaultNetwork: 'arc-testnet',
  etherscan: {
    apiKey: { 'arc-testnet': 'empty' },
    customChains: [
      {
        network: "arc-testnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
