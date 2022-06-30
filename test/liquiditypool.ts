import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, utils, constants } from 'ethers'
import { ethers } from 'hardhat'
import { before } from 'mocha'
import { RDL as ERC20Mintable, LiquidityPool } from '../typechain'

describe('liquidity pool', () => {
  let weth: ERC20Mintable,
    usdc: ERC20Mintable,
    liquidityPool: LiquidityPool,
    owner: SignerWithAddress,
    bob: SignerWithAddress,

  // let assumption we always start with 1weth = 500usdc
  const decimals = 18

  const deploy = async () => {
    // deploy weth
    const wethFactory = await ethers.getContractFactory('RDL')
    weth = await wethFactory.deploy(decimals)
    await weth.deployed()
    weth.mint(constants.MaxUint256)
    // deploy usdc
    const usdcFactory = await ethers.getContractFactory('RDL')
    usdc = await usdcFactory.deploy(decimals)
    await usdc.deployed()
    usdc.mint(constants.MaxUint256)
    // deploy liquidityPool
    const lqFactory = await ethers.getContractFactory('LiquidityPool')
    liquidityPool = await lqFactory.deploy(weth.address, usdc.address)
    await liquidityPool.deployed()
    // approve max for pool
    await weth.approve(liquidityPool.address, constants.MaxUint256)
    await usdc.approve(liquidityPool.address, constants.MaxUint256)
    ;[owner, bob] = await ethers.getSigners()
  }

  beforeEach(deploy)

  it('init pool', async () => {
    await liquidityPool.add(10, 500)
    expect(await liquidityPool.amountA()).eq(10)
    expect(await liquidityPool.amountB()).eq(500)
    expect(await liquidityPool.constantValue()).eq(10 * 500)
    // check balance of pool
    expect(await weth.balanceOf(liquidityPool.address)).eq(10)
    expect(await weth.balanceOf(owner.address)).not.eq(constants.MaxUint256)

    expect(await usdc.balanceOf(liquidityPool.address)).eq(500)
    expect(await usdc.balanceOf(owner.address)).not.eq(constants.MaxUint256)
    // check reward
    expect(await liquidityPool.balanceOf(owner.address)).not.eq(0)
  })

  it('add liquidity 2 times', async () => {
    await liquidityPool.add(10, 10)
    await liquidityPool.connect(bob).add(20, 20)
    expect(await liquidityPool.amountA()).eq(30)
    expect(await liquidityPool.amountB()).eq(30)
    expect(await liquidityPool.constantValue()).eq(900)
  })

  it('get swap info', async () => {
    await liquidityPool.add(10, 20)
    let info = await liquidityPool.getSwapInfo(weth.address, usdc.address, 5)
    // amount out = (10 * 20) / (10 - 5) = 40
    expect(info.outputAmount).eq(40)
    await liquidityPool.add(20, 40)
    info = await liquidityPool.getSwapInfo(usdc.address, weth.address, 10)
    // amount out = (30 * 60) / (60 - 10) = 36
    expect(info.outputAmount).eq(36)
  })

  it('swap', async () => {
    await weth.connect(bob).mint(10)
    await usdc.connect(bob).mint(10)

    await liquidityPool.add(10, 10)
    await liquidityPool.connect(bob).swap(weth.address, usdc.address, 5, 0)
    // bob weth balance -= 5, usdc balance += (10 * 10) / (10 - 5) = 20
    expect(await weth.balanceOf(liquidityPool.address)).eq(15)
    expect(await weth.balanceOf(bob.address)).eq(5)
    expect(await usdc.balanceOf(bob.address)).eq(20)
    expect(await liquidityPool.constantValue()).eq(100)
    // outputAmount = (5 * 20) / (5 - 3) = 50
    await expect(liquidityPool.connect(bob).swap(weth.address, usdc.address, 3, 51)).to.be.reverted
  })

  it('remove liquidity', async () => {
    await weth.connect(bob).mint(10)
    await usdc.connect(bob).mint(10)

    await liquidityPool.connect(bob).add(10, 10)
    await liquidityPool.connect(bob).remove(5, 5)

    expect(await weth.balanceOf(liquidityPool.address)).eq(5)
    expect(await weth.balanceOf(bob.address)).eq(5)

    expect(await usdc.balanceOf(liquidityPool.address)).eq(5)
    expect(await usdc.balanceOf(bob.address)).eq(5)

    expect(await liquidityPool.constantValue()).eq(25)
  })
})
