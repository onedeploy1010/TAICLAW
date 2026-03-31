const hre = require("hardhat");

async function main() {
  const FUND_MANAGER = "0xeb8AbD9b47F9Ca0d20e22636B2004B75E84BdcD9";
  const RECIPIENT = "0xbaB0f5Ab980870789f88807F2987Ca569b875616";
  const USDT = "0x55d398326f99059fF775485246999027B3197955";
  const USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

  const [deployer] = await hre.ethers.getSigners();
  console.log("Operator:", deployer.address);

  const abi = [
    "function setRecipients(address[] _wallets, uint256[] _shares) external",
    "function setAllowedToken(address token, bool allowed) external",
    "function setAuthorizedSource(address source, bool authorized) external",
    "function getRecipientsCount() external view returns (uint256)",
    "function allowedTokens(address) external view returns (bool)",
  ];

  const fm = new hre.ethers.Contract(FUND_MANAGER, abi, deployer);

  // 1. Check current state
  const count = await fm.getRecipientsCount();
  console.log("Current recipients count:", count.toString());

  const usdtAllowed = await fm.allowedTokens(USDT);
  const usdcAllowed = await fm.allowedTokens(USDC);
  console.log("USDT allowed:", usdtAllowed);
  console.log("USDC allowed:", usdcAllowed);

  // 2. Set recipients: 100% to 0xbaB...
  if (count.toString() === "0") {
    console.log("\nSetting recipients...");
    const tx1 = await fm.setRecipients([RECIPIENT], [10000]);
    await tx1.wait();
    console.log("Recipients set! Tx:", tx1.hash);
  } else {
    console.log("\nRecipients already set, skipping.");
  }

  // 3. Ensure USDT/USDC are allowed
  if (!usdtAllowed) {
    console.log("Adding USDT to whitelist...");
    const tx2 = await fm.setAllowedToken(USDT, true);
    await tx2.wait();
    console.log("USDT allowed! Tx:", tx2.hash);
  }

  if (!usdcAllowed) {
    console.log("Adding USDC to whitelist...");
    const tx3 = await fm.setAllowedToken(USDC, true);
    await tx3.wait();
    console.log("USDC allowed! Tx:", tx3.hash);
  }

  console.log("\nFundManager setup complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
