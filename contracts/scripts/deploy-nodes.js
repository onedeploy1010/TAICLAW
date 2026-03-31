const hre = require("hardhat");

async function main() {
  const FUND_DISTRIBUTOR = "0xeb8AbD9b47F9Ca0d20e22636B2004B75E84BdcD9";
  const USDT = "0x55d398326f99059fF775485246999027B3197955";
  const USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

  console.log("Deploying CoinMaxNodes to BSC mainnet...");
  console.log("Fund Distributor:", FUND_DISTRIBUTOR);
  console.log("USDT:", USDT);
  console.log("USDC:", USDC);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "BNB");

  const CoinMaxNodes = await hre.ethers.getContractFactory("CoinMaxNodes");
  const nodes = await CoinMaxNodes.deploy(FUND_DISTRIBUTOR, USDT, USDC);
  await nodes.waitForDeployment();

  const address = await nodes.getAddress();
  console.log("CoinMaxNodes deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
