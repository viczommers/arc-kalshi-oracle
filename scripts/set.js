const { ethers } = require("hardhat");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
dotenv.config({ path: "./.env.deployed" });

const pk = process.env.PK || "";
const contractAddress = process.env.CT_ADDRESS || "0x0000000000000000000000000000000000000000";

async function main() {
  let provider, signer, tx;

  // try {
  //   new ethers.providers.JsonRpcProvider(rpcUrl);
  // } catch (e) { throw new Error(`ProviderErr ${JSON.stringify(e)}`); }

  try {
    provider = ethers.provider;
  } catch (e) { throw new Error(`NetIdErr ${JSON.stringify(e)}`); }

  try {
    netId = (await provider.getNetwork()).chainId;
  } catch (e) { throw new Error(`NetIdErr ${JSON.stringify(e)}`); }

  if (netId === 5042002) { // one only need to fulfill when on DevNet
    console.log("NetworkId_5042002");
    const b = await provider.getBlockNumber();
    console.log("BlockNumber:", b);
    signer = new ethers.Wallet(pk).connect(provider);
    const a = signer.address;
    console.log("Signer:", a);

    const artifact = hre.artifacts.readArtifactSync("KalshiLinkOracle");
    const { abi } = artifact;
    kalshiLinkOracle = new ethers.Contract( contractAddress, abi, signer );

    // function fulfillPredictionMarketDataEurUsd(uint256 _value, uint256 _timestamp, uint256 _resolutionTimestamp) external onlyOwner {
    // ADD LOGIC HERE!
    tx = await kalshiLinkOracle.fulfillPredictionMarketDataEurUsd(1000, 1763162929, 1765497600);
    console.log(tx);

  } else {
    console.error(`UnsupportedNetwork: ${netId}.`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
