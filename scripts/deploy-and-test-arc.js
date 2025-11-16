import { deploy } from './ethers-lib' // For reference only !
import { ethers } from 'ethers'
// import Web3 from 'web3'

;(async () => { try {
  // 0. Set users, provider & others; 1. Depl mocked $; 2. Depl mocked €; 3. Depl PST; 4. Depl Trez; 5. Mint 1$; 6. Mint 1€;
  const oneUnit = ethers.utils.parseEther("1");
  const halfUnit = ethers.utils.parseEther("0.5");
  const oneAndHalfUnit = ethers.utils.parseEther("1.5");

  const usdCtName = "Wrapped USDC"; const usdCtSymbol = "WUSDC"; // 0
  const eurCtName = "EUR Cicle";    const eurCtSymbol = "EURC";
  const pstCtName = "Pool Share Token"; const pstCtSymbol = "PST";
  // const pk01 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // 0x5B38Da6a701c568545dCfcB03FcB875f56beddC4
  // const pk02 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // 0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2
  // const pk03 = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // 0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db
  // const alice = new ethers.Wallet(pk01, ethers.provider); const signer = alice;
  // const bob   = new ethers.Wallet(pk02, ethers.provider);
  // const charlie=new ethers.Wallet(pk03, ethers.provider);
  const alice = await ethers.getSigner(0); // 0x5B38Da6a701c568545dCfcB03FcB875f56beddC4
  // const bob   = await ethers.getSigner(1); // 0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2
  // const charlie=await ethers.getSigner(2); // 0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db
  console.log(0, alice.address)

  let tx, receipt;
  let aliceAddr = alice.address;

  let mockUsdc; // 1
  mockUsdc = await deploy('MockERC20', [usdCtName, usdCtSymbol]);
  console.log(`mockUsdcAddr: ${mockUsdc.address}`);

  let mockEurc; // 2
  mockEurc = await deploy('MockERC20', [eurCtName, eurCtSymbol]);
  console.log(`mockEurcAddr: ${mockEurc.address}`);

  let pst; // 3
  pst = await deploy('MockERC20', [pstCtName, pstCtSymbol]);
  console.log(`pstAddr: ${pst.address}`);

  // 4 TO BE DEFINED

  tx = await mockUsdc.mint(aliceAddr, oneUnit); // 5
  receipt = await tx.wait(); // const bal = await mockUsdc.balanceOf(aliceAddr); console.log(bal);

  tx = await mockEurc.mint(aliceAddr, oneUnit); // 6
  receipt = await tx.wait(); // const bal = await mockEurc.balanceOf(aliceAddrÍ); // console.log(bal);

  const treasury = await deploy('TreasuryManager', [mockUsdc.address, mockEurc.address, pst.address]);
  console.log(`T: ${treasury.address}`);

  tx = await mockUsdc.approve(treasury.address, oneUnit);
  await tx.wait();

  tx = await mockEurc.approve(treasury.address, oneUnit);
  await tx.wait();

} catch (e) { console.log(e) }

})();
