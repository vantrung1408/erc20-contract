// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

const contracts = [
  // {
  //   name: "Greeter",
  //   params: ["Hello"],
  // },
  {
    name: "ERC20",
    params: ["1408", "1408", 18, 1000000],
  },
];
async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  for (const { name, params } of contracts) {
    const contractFactory = await ethers.getContractFactory(name);
    const contract = await contractFactory.deploy.apply(
      contractFactory,
      params
    );
    await contract.deployed();
    console.log(`${name} deployed to:`, contract.address);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
