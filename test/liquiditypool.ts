import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, constants, utils } from 'ethers'
import { ethers } from 'hardhat'
import { USDC, WETH, LiquidityPool } from '../typechain'

describe('liquidity pool', () => {
  let weth: WETH,
    usdc: USDC,
    liquidityPool: LiquidityPool,
    owner: SignerWithAddress,
    bob: SignerWithAddress,
    alice: SignerWithAddress

  // let assumption we always start with 1weth = 500usdc
  const decimals = 18

  const deploy = async () => {
    // deploy weth
    const wethFactory = await ethers.getContractFactory('WETH')
    weth = await wethFactory.deploy(decimals)
    await weth.deployed()
    weth.mint(constants.MaxUint256)
    // deploy usdc
    const usdcFactory = await ethers.getContractFactory('USDC')
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
    ;[owner, bob, alice] = await ethers.getSigners()

    weth.approve(liquidityPool.address, constants.MaxUint256)
    usdc.approve(liquidityPool.address, constants.MaxUint256)

    weth.connect(bob).approve(liquidityPool.address, constants.MaxUint256)
    usdc.connect(bob).approve(liquidityPool.address, constants.MaxUint256)
  }

  beforeEach(deploy)

  it('init pool', async () => {
    await liquidityPool.add(10, 500)
    expect(await liquidityPool.amountA()).eq(10)
    expect(await liquidityPool.amountB()).eq(500)
    expect(await liquidityPool.k()).eq(10 * 500)
    // check balance of pool
    expect(await weth.balanceOf(liquidityPool.address)).eq(10)
    expect(await weth.balanceOf(owner.address)).not.eq(constants.MaxUint256)

    expect(await usdc.balanceOf(liquidityPool.address)).eq(500)
    expect(await usdc.balanceOf(owner.address)).not.eq(constants.MaxUint256)
    // check reward
    expect(await liquidityPool.balanceOf(owner.address)).not.eq(0)
  })

  it('add liquidity', async () => {
    await weth.transfer(bob.address, 20)
    await usdc.transfer(bob.address, 20)

    await liquidityPool.add(10, 10)
    await liquidityPool.connect(bob).add(20, 20)
    expect(await liquidityPool.amountA()).eq(30)
    expect(await liquidityPool.amountB()).eq(30)
    expect(await liquidityPool.k()).eq(900)
    // add amount not match ratio
    await liquidityPool.add(10, 20)
    expect(await liquidityPool.amountA()).eq(40)
    expect(await liquidityPool.amountB()).eq(40)
    expect(await liquidityPool.k()).eq(1600)

    await liquidityPool.add(20, 10)
    expect(await liquidityPool.amountA()).eq(50)
    expect(await liquidityPool.amountB()).eq(50)
    expect(await liquidityPool.k()).eq(2500)
  })

  it('reward when add', async () => {
    const initialLp = await liquidityPool.INITIAL_LP()
    // expect initial reward to be distributed to first one who deposited
    let balance = BigNumber.from(initialLp)
    await liquidityPool.add(10, 10)
    expect(await liquidityPool.balanceOf(owner.address)).eq(balance)
    // in the next time add liquidity, reward will calculate based on ratio
    balance = balance.add(initialLp)
    await liquidityPool.add(10, 10)
    expect(await liquidityPool.balanceOf(owner.address)).eq(balance)

    balance = balance.add(initialLp.div(5))
    await liquidityPool.add(2, 2)
    expect(await liquidityPool.balanceOf(owner.address)).eq(balance)
  })

  it('reward when swap', async () => {
    const initialLp = await liquidityPool.INITIAL_LP()
    await liquidityPool.add(10000, 10000)
    await liquidityPool.swap(weth.address, usdc.address, 3000, 0)
    let reward = initialLp.div(10000).mul(3000).div(1000).mul(3)
    expect(await liquidityPool.balanceOf(liquidityPool.address)).eq(reward)
    // in pool: weth = 13000, usdc = 7693
    const { outputAmount } = await liquidityPool.getSwapInfo(
      usdc.address,
      weth.address,
      3000
    )
    liquidityPool.swap(usdc.address, weth.address, 3000, 0)
    reward = reward.add(initialLp.div(10000).mul(outputAmount).div(1000).mul(3))
    expect(await liquidityPool.balanceOf(liquidityPool.address)).eq(reward)
  })

  it('get swap info', async () => {
    await liquidityPool.add(10, 20)
    let info = await liquidityPool.getSwapInfo(weth.address, usdc.address, 5)
    // amount out = 20 - (10 * 20) / (10 + 5) = 6
    expect(info.outputAmount).eq(6)
    await liquidityPool.add(20, 40)
    info = await liquidityPool.getSwapInfo(usdc.address, weth.address, 10)
    // amount out = 30 - (30 * 60) / (60 + 10) = 4
    expect(info.outputAmount).eq(4)
  })

  it('swap', async () => {
    await weth.transfer(bob.address, 10)
    await usdc.transfer(bob.address, 10)

    await liquidityPool.add(10, 10)
    // swap with large amount
    await expect(
      liquidityPool.connect(bob).swap(weth.address, usdc.address, 20, 0)
    )
    // swap with in range amount
    await liquidityPool.connect(bob).swap(weth.address, usdc.address, 5, 0)
    // bob weth balance -= 5, usdc balance += 10 - (10 * 10) / (10 + 5) = 3
    expect(await weth.balanceOf(liquidityPool.address)).eq(15)
    expect(await weth.balanceOf(bob.address)).eq(5)
    expect(await usdc.balanceOf(bob.address)).eq(13)
    expect(await liquidityPool.k()).eq(100)
    // outputAmount = (5 * 20) / (5 - 3) = 50
    await expect(
      liquidityPool.connect(bob).swap(weth.address, usdc.address, 3, 51)
    ).to.be.reverted
  })

  it('remove liquidity', async () => {
    await weth.transfer(bob.address, 10)
    await usdc.transfer(bob.address, 10)

    await liquidityPool.connect(bob).add(10, 10)
    await liquidityPool.connect(bob).remove(5, 5)

    expect(await weth.balanceOf(liquidityPool.address)).eq(5)
    expect(await weth.balanceOf(bob.address)).eq(5)
    expect(await usdc.balanceOf(liquidityPool.address)).eq(5)
    expect(await usdc.balanceOf(bob.address)).eq(5)
    expect(await liquidityPool.k()).eq(25)

    // remove with not valid amount
    await liquidityPool.add(5, 5)
    // pool has 10 weth 10 usdc
    await expect(liquidityPool.connect(bob).remove(10, 10)).to.be.reverted
    await expect(liquidityPool.remove(11, 11)).to.be.reverted
    // check ratio
    await liquidityPool.remove(5, 6)
    expect(await liquidityPool.k()).eq(25)
    await liquidityPool.connect(bob).remove(6, 5)
    expect(await liquidityPool.k()).eq(0)
  })
})
