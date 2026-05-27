import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendContractsDir = path.resolve(__dirname, "../../frontend/src/contracts");
const deploymentsPath = path.join(frontendContractsDir, "deployments.json");

async function main() {
  const Insurance = await hre.ethers.getContractFactory("Insurance");
  const insurance = await Insurance.deploy();
  await insurance.waitForDeployment();

  const address = await insurance.getAddress();
  const { chainId } = await hre.ethers.provider.getNetwork();
  const deployedCode = await hre.ethers.provider.getCode(address);
  const deployedBytecodeHash = hre.ethers.keccak256(deployedCode);
  console.log("Insurance deployed to:", address);

  const artifact = await hre.artifacts.readArtifact("Insurance");
  const existingDeployments = fs.existsSync(deploymentsPath)
    ? JSON.parse(fs.readFileSync(deploymentsPath, "utf8"))
    : {};

  const chainKey = chainId.toString();
  const deployments = {
    ...existingDeployments,
    [chainKey]: {
      ...(existingDeployments[chainKey] || {}),
      Insurance: {
        address,
        deployedBytecodeHash,
        abi: artifact.abi,
      },
    },
  };

  fs.mkdirSync(frontendContractsDir, { recursive: true });
  fs.writeFileSync(deploymentsPath, `${JSON.stringify(deployments, null, 2)}\n`);
  console.log(`Deployment saved to ${path.relative(process.cwd(), deploymentsPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
