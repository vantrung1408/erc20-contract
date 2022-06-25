import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, utils, constants } from 'ethers'
import { ethers } from 'hardhat'
import { before } from 'mocha'
import { RDL, RDX, MasterChef } from '../typechain'

describe('masterchef', () => {
  let rdl: RDL,
    rdx: RDX,
    masterchef: MasterChef,
    rdxOwner: SignerWithAddress,
    bob: SignerWithAddress,
    alice: SignerWithAddress,
    ACC_PER_SHARE_PRECISION: BigNumber
  const decimals: number = 18,
    rdxSupply: BigNumber = utils.parseUnits('1000000', decimals),
    chefMaxRDXSupply: BigNumber = rdxSupply.div(10),
    rewardPerBlock: BigNumber = utils.parseUnits('1', 18)

  const deploy = async () => {
    // deploy rdl
    const rdlFactory = await ethers.getContractFactory('RDL')
    rdl = await rdlFactory.deploy(decimals)
    await rdl.deployed()
    const rdlAddress = rdl.address
    // deploy rdx
    const rdxFactory = await ethers.getContractFactory('RDX')
    rdx = await rdxFactory.deploy(decimals, rdxSupply)
    await rdx.deployed()
    const rdxAddress = rdx.address
    // deploy masterchef
    const masterchefFactory = await ethers.getContractFactory('MasterChef')
    masterchef = await masterchefFactory.deploy(
      rdlAddress,
      rdxAddress,
      rewardPerBlock
    )
    await masterchef.deployed()
    // assign owner
    ;[rdxOwner, bob, alice] = await ethers.getSigners()
    await rdx.connect(rdxOwner).transfer(masterchef.address, chefMaxRDXSupply)
    ACC_PER_SHARE_PRECISION = await masterchef.ACC_PER_SHARE_PRECISION()
  }

  const advanceBlockTo = async (blockNumber) => {
    for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
      await ethers.provider.send('evm_mine', [])
    }
  }

  describe('constructing', () => {
    before(deploy)

    it('contract deployed successfully', async () => {
      expect(masterchef.address).not.eq(undefined)
    })
  })

  describe('deposit', () => {
    beforeEach(deploy)

    it('deposit with zero', async () => {
      await expect(masterchef.connect(bob).deposit(0)).to.be.reverted
    })

    it('deposit with non rdl token holder', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      expect(await rdl.balanceOf(bob.address)).eq(0)
      await expect(masterchef.connect(bob).deposit(amount)).to.be.reverted
    })

    it('deposit without approved', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await rdl.mint(bob.address, amount)
      expect(await rdl.balanceOf(bob.address)).eq(amount)
      // trigger deposit without approve
      await expect(masterchef.connect(bob).deposit(amount)).to.be.reverted
    })

    it('deposit with amount large than approved amount', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await rdl.connect(bob).approve(masterchef.address, amount.div(2))
      await expect(masterchef.connect(bob).deposit(amount)).to.be.reverted
    })

    it('deposit with in range approved amount', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await rdl.mint(bob.address, amount)
      await rdl.connect(bob).approve(masterchef.address, amount)
      const tx = await masterchef.connect(bob).deposit(amount)
      // balance checking
      expect(await rdl.balanceOf(bob.address)).eq(0)
      expect(await rdl.balanceOf(masterchef.address)).eq(amount)
      // user info checking
      const user = await masterchef.users(bob.address)
      expect(user.balance).eq(amount)
      expect(user.rewardDebt).eq(0)
    })

    it('deposit with in range approved amount n times', async () => {
      const n: number = 3
      const amount: BigNumber = utils.parseUnits('10', decimals)

      await rdl.mint(bob.address, amount.mul(n))
      await rdl.connect(bob).approve(masterchef.address, constants.MaxUint256)

      for (let i = 0; i < n; i++) {
        const tx = await masterchef.connect(bob).deposit(amount)
        const user = await masterchef.users(bob.address)
        if (i) {
          expect(user.balance).eq(amount.mul(1 + i))
        } else {
          expect(user.balance).eq(amount)
          expect(user.rewardDebt).eq(0)
        }
      }
      expect(await rdl.balanceOf(bob.address)).eq(0)
      expect(await rdl.balanceOf(masterchef.address)).eq(amount.mul(n))
    })
  })

  describe('withdraw', () => {
    beforeEach(async () => {
      await deploy()
      await rdl.connect(bob).approve(masterchef.address, constants.MaxUint256)
      await rdl.mint(bob.address, constants.MaxUint256)
    })

    it('withdraw with insufficient user balance', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await masterchef.connect(bob).deposit(amount.div(2))
      const user = await masterchef.users(bob.address)
      expect(user.balance).lt(amount)
      await expect(masterchef.connect(bob).withdraw(amount)).to.be.reverted
    })

    it('withdraw with insufficient chef balance', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await masterchef.connect(bob).deposit(amount)
      const user = await masterchef.users(bob.address)
      expect(user.balance).eq(amount)
      // after burn we check balance of chef and try to withdraw
      expect(await rdl.balanceOf(masterchef.address)).lt(amount.mul(2))
      await expect(masterchef.connect(bob).withdraw(amount.mul(2))).to.be
        .reverted
    })

    it('withdraw with one times deposit and amount in range of balance', async () => {
      const depositAmount: BigNumber = utils.parseUnits('10', decimals)
      await masterchef.connect(bob).deposit(depositAmount)

      const bobRDLBalance = await rdl.balanceOf(bob.address)
      const withdrawAmount: BigNumber = depositAmount.div(2)
      await masterchef.connect(bob).withdraw(withdrawAmount)

      const user = await masterchef.users(bob.address)
      // check balance of user
      expect(user.balance).eq(depositAmount.sub(withdrawAmount))
      expect(await rdl.balanceOf(bob.address)).eq(
        bobRDLBalance.add(withdrawAmount)
      )
      // check balance of chef
      expect(await rdl.balanceOf(masterchef.address)).eq(
        depositAmount.sub(withdrawAmount)
      )
    })
  })

  describe('reward', () => {
    beforeEach(async () => {
      await deploy()
      await rdl.connect(bob).approve(masterchef.address, constants.MaxUint256)
      await rdl.mint(bob.address, constants.MaxUint256.div(2))
      await rdl.connect(alice).approve(masterchef.address, constants.MaxUint256)
      await rdl.mint(alice.address, constants.MaxUint256.div(2))
    })

    it('one user with sequentially deposit -> claim', async () => {
      const rdlAmount: BigNumber = utils.parseUnits('10', decimals)
      const depositTx = await masterchef.connect(bob).deposit(rdlAmount)
      // checking chef rdx balance is still equal to supply
      expect(await rdx.balanceOf(masterchef.address)).eq(chefMaxRDXSupply)
      // claim checking
      const claimTx = await masterchef.connect(bob).claim()
      const reward = rewardPerBlock.mul(
        claimTx.blockNumber - depositTx.blockNumber
      )
      expect(await rdx.balanceOf(bob.address)).eq(reward)
      expect(await rdx.balanceOf(masterchef.address)).eq(
        chefMaxRDXSupply.sub(reward)
      )
    })

    it('one user with sequentially n deposit -> claim', async () => {
      const rdlAmount: BigNumber = utils.parseUnits('10', decimals)
      const n: number = 2
      // deposit n times and log first block number
      for (let i = 0; i < n; i++) {
        console.log('deposit ', i)
        await masterchef.connect(bob).deposit(rdlAmount)
      }

      await masterchef.connect(bob).claim()
      let reward = rewardPerBlock.mul(n)
      expect(await rdx.balanceOf(bob.address)).eq(reward)
      expect(await rdx.balanceOf(masterchef.address)).eq(
        chefMaxRDXSupply.sub(reward)
      )
    })

    it('multiple users', async () => {
      const rdlAmount: BigNumber = utils.parseUnits('10', decimals)
      // move to block 300 and deposit for bob
      await advanceBlockTo(299)
      await masterchef.connect(bob).deposit(rdlAmount)
      // move to block 305 and deposit again
      await advanceBlockTo(304)
      await masterchef.connect(bob).deposit(rdlAmount)
      // with 5 blocks bob rdx balance will be rewardPerBlock * 5
      expect(await rdx.balanceOf(bob.address)).eq(rewardPerBlock.mul(5))
      // move to block 310 and alice deposit
      await advanceBlockTo(309)
      await masterchef.connect(alice).deposit(rdlAmount)
      // move to block 315 and bob deposit
      await advanceBlockTo(314)
      await masterchef.connect(bob).deposit(rdlAmount)
      // this time bob rdx will equal rewardPerBlock * 10 + rewardPerBlock * 5 * 2/3
      const bobBalance = rewardPerBlock
        .mul(10)
        .add(rewardPerBlock.mul(10).div(3))
        .mul(ACC_PER_SHARE_PRECISION)
        .div(ACC_PER_SHARE_PRECISION)
      expect(await rdx.balanceOf(bob.address)).eq(bobBalance)
    })
  })
})
