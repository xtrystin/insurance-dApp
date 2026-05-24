import hre from "hardhat";
import fs from "fs";

async function main() {
  const Insurance = await hre.ethers.getContractFactory("Insurance");
  const insurance = await Insurance.deploy();
  await insurance.waitForDeployment();

  const address = await insurance.getAddress();
  console.log("Insurance deployed to:", address);

  // Save the contract address to the frontend folder automatically
  const addressData = JSON.stringify({ address: address }, null, 2);
  fs.writeFileSync("../frontend/src/abis/contract-address.json", addressData);
  console.log("Address saved to frontend/src/abis/contract-address.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
