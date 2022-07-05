// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from 'hardhat'
import { utils } from 'ethers'

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  // 1. deploy weth, usdc
  // const wethFactory = await ethers.getContractFactory('WETH')
  // const wethContract = await wethFactory.deploy(18)
  // await wethContract.deployed()
  // const wethAddress = wethContract.address
  // console.log(
  //   `npx hardhat verify --contract contracts/WETH.sol:WETH --network kovan ${wethAddress} 18`
  // )
  // //
  // const usdcFactory = await ethers.getContractFactory('USDC')
  // const usdcContract = await usdcFactory.deploy(18)
  // await usdcContract.deployed()
  // const usdcAddress = usdcContract.address
  // console.log(
  //   `npx hardhat verify --contract contracts/USDC.sol:USDC --network kovan ${usdcAddress} 18`
  // )
  // 2. deploy rdx
  // const rdxFactory = await ethers.getContractFactory('RDX')
  // const rdxContract = await rdxFactory.deploy(
  //   18,
  //   utils.parseUnits('1000000', 18)
  // )
  // await rdxContract.deployed()
  // const rdxAddress = rdxContract.address
  // console.log(
  //   `npx hardhat verify --contract contracts/RDX.sol:RDX --network kovan ${rdxAddress} 18 ${utils.parseUnits(
  //     '1000000',
  //     18
  //   )}`
  // )
  // 3. deploy liquidity pool
  const wethAddress = '0x82b3aC3e827f8858aC1D02EFC21C55eDB853E318',
    usdcAddress = '0x3779C3fDC26EDB10decCb48f9CD5851919810222',
    rdxAddress = '0xb4246F91EFF3EF5E92213bDfb53448E737766f8F'
  const lpFactory = await ethers.getContractFactory('LiquidityPool')
  const lpContract = await lpFactory.deploy(wethAddress, usdcAddress)
  await lpContract.deployed()
  const lpAddress = lpContract.address
  console.log(
    `npx hardhat verify --contract contracts/LiquidityPool.sol:LiquidityPool --network kovan ${lpAddress} ${wethAddress} ${usdcAddress}`
  )
  // 4. deploy masterchef
  const chefFactory = await ethers.getContractFactory('MasterChef')
  const chefContract = await chefFactory.deploy(
    lpAddress,
    rdxAddress,
    utils.parseUnits('0.1', 18)
  )
  await chefContract.deployed()
  const chefAddress = chefContract.address
  console.log(
    `npx hardhat verify --contract contracts/MasterChef.sol:MasterChef --network kovan ${chefAddress} ${lpAddress} ${rdxAddress} ${utils.parseUnits(
      '0.1',
      18
    )}`
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
