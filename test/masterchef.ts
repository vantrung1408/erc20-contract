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
    bob: SignerWithAddress
  const decimals: number = 18,
    rdxSupply: BigNumber = utils.parseUnits('1000000', decimals),
    rewardPerBlock: BigNumber = utils.parseUnits('0.001', 18)

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
    ;[rdxOwner, bob] = await ethers.getSigners()
  }

  const calculateReward = async (
    balance: BigNumber,
    blockNumber: number,
    startBlock: number,
    correction: BigNumber
  ) => {
    const chefRDL = await rdl.balanceOf(masterchef.address)
    const ratio = balance.div(chefRDL)
    return ratio
      .mul(blockNumber - startBlock)
      .mul(balance)
      .mul(rewardPerBlock)
      .sub(correction)
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
      await expect(masterchef.deposit(bob.address, 0)).to.be.reverted
    })

    it('deposit with non rdl token holder', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      expect(await rdl.balanceOf(bob.address)).eq(0)
      await expect(masterchef.deposit(bob.address, amount)).to.be.reverted
    })

    it('deposit without approved', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await rdl.mint(bob.address, amount)
      expect(await rdl.balanceOf(bob.address)).eq(amount)
      // trigger deposit without approve
      await expect(masterchef.deposit(bob.address, amount)).to.be.reverted
    })

    it('deposit with amount large than approved amount', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await rdl.connect(bob).approve(masterchef.address, amount.div(2))
      await expect(masterchef.deposit(bob.address, amount)).to.be.reverted
    })

    it('deposit with in range approved amount', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await rdl.mint(bob.address, amount)
      await rdl.connect(bob).approve(masterchef.address, amount)
      const tx = await masterchef.deposit(bob.address, amount)
      // balance checking
      expect(await rdl.balanceOf(bob.address)).eq(0)
      expect(await rdl.balanceOf(masterchef.address)).eq(amount)
      // user info checking
      const user = await masterchef.users(bob.address)
      expect(user.balance).eq(amount)
      expect(user.startBlock).eq(tx.blockNumber)
      expect(user.rewardCorrection).eq(0)
    })

    it('deposit with in range approved amount n times', async () => {
      const n: number = 3
      const amount: BigNumber = utils.parseUnits('10', decimals)
      let startBlock: number,
        reward: BigNumber = BigNumber.from('0')

      await rdl.mint(bob.address, amount.mul(n))
      await rdl.connect(bob).approve(masterchef.address, constants.MaxUint256)

      for (let i = 0; i < n; i++) {
        const tx = await masterchef.deposit(bob.address, amount)
        const user = await masterchef.users(bob.address)
        if (i) {
          const rewardAtBlock = await calculateReward(
            amount,
            tx.blockNumber,
            startBlock,
            BigNumber.from('0')
          )
          reward = reward.add(rewardAtBlock)

          expect(user.balance).eq(amount.mul(1 + i))
          expect(user.startBlock).eq(startBlock)
          expect(user.rewardCorrection).eq(reward)
        } else {
          startBlock = tx.blockNumber
          expect(user.balance).eq(amount)
          expect(user.rewardCorrection).eq(0)
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

    it('withdraw with inefficient user balance', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await masterchef.deposit(bob.address, amount.div(2))
      const user = await masterchef.users(bob.address)
      expect(user.balance).lt(amount)
      await expect(masterchef.withdraw(bob.address, amount)).to.be.reverted
    })

    it('withdraw with inefficient chef balance', async () => {
      const amount: BigNumber = utils.parseUnits('10', decimals)
      await masterchef.deposit(bob.address, amount)
      const user = await masterchef.users(bob.address)
      expect(user.balance).eq(amount)
      // burn rdl token of chef balance
      await rdl.transfer(constants.AddressZero, amount)
      // after burn we check balance of chef and try to withdraw
      expect(await rdl.balanceOf(masterchef.address)).lt(amount)
      await expect(masterchef.withdraw(bob.address, amount)).to.be.reverted
    })

    it('withdraw with amount in range of balance', async () => {})
  })
})
