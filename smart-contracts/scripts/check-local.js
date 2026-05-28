import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deploymentsPath = path.resolve(__dirname, "../../frontend/src/contracts/deployments.json");

async function main() {
  const { chainId } = await hre.ethers.provider.getNetwork();
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const deployment = deployments[chainId.toString()]?.Insurance;

  if (!deployment) {
    throw new Error(`No Insurance deployment for chain ${chainId.toString()}`);
  }

  const code = await hre.ethers.provider.getCode(deployment.address);
  const actualHash = code === "0x" ? null : hre.ethers.keccak256(code);
  const [deployer] = await hre.ethers.getSigners();
  const insurance = await hre.ethers.getContractAt("Insurance", deployment.address);

  console.log("chainId:", chainId.toString());
  console.log("address:", deployment.address);
  console.log("expected bytecode hash:", deployment.deployedBytecodeHash);
  console.log("actual bytecode hash:  ", actualHash);
  console.log("bytecode matches:", actualHash === deployment.deployedBytecodeHash);
  console.log("deployer/admin:", deployer.address);
  console.log("is admin:", await insurance.admins(deployer.address));
  console.log("contract balance:", hre.ethers.formatEther(await insurance.getContractBalance()), "ETH");
  console.log("policies:", (await insurance.getPolicies()).length);

  const fundTx = await insurance.fund.populateTransaction({ value: hre.ethers.parseEther("10") });
  const estimatedGas = await deployer.estimateGas({ ...fundTx, to: deployment.address });
  console.log("fund() gas estimate:", estimatedGas.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
