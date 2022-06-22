import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, constants } from 'ethers'
import { ethers } from 'hardhat'
import { before } from 'mocha'
import { RDL } from '../typechain'

describe('ERC20 token creator', () => {
  let contract: RDL,
    owner: SignerWithAddress,
    bob: SignerWithAddress,
    alice: SignerWithAddress,
    david: SignerWithAddress,
    someone: string,
    decimals: number = 18,
    mintValue: BigNumber

  const deploy = async () => {
    const factory = await ethers.getContractFactory('RDL')
    contract = await factory.deploy(decimals)
    await contract.deployed()
    ;[owner, bob, alice, david] = await ethers.getSigners()
    someone = ethers.Wallet.createRandom().address
    mintValue = BigNumber.from('1000')
  }

  describe('constructing', () => {
    before(deploy)

    it('contract deployed successfully', async () => {
      expect(contract.address).not.equal(undefined)
    })

    it('contructor working as expect', async () => {
      expect(await contract.decimals()).equal(decimals)
    })
  })

  describe('mint', () => {
    beforeEach(deploy)

    it('validator', async () => {
      const items = [0, mintValue, constants.MaxUint256]
      // working with valid value
      for (const value of items) {
        await contract.mint(someone, value)
        expect(await contract.balanceOf(someone)).eq(value)
        await deploy()
      }
      // and not working with value outside of uint256 range
      await expect(contract.mint(someone, constants.MaxUint256.add(1))).to.be
        .reverted
      await expect(contract.mint(someone, -1)).to.be.reverted
    })

    it('balance and supply after mint', async () => {
      // total supply, balance of someone equal to 0
      expect(await contract.totalSupply()).eq(0)
      expect(await contract.balanceOf(someone)).eq(0)
      // balance of someone address will be increase
      await expect(contract.mint(someone, mintValue))
        .to.emit(contract, 'Transfer')
        .withArgs(constants.AddressZero, someone, mintValue)
      expect(await contract.balanceOf(someone)).eq(mintValue)
      // total supply will be increase
      const totalSupply = await contract.totalSupply()
      expect(totalSupply).eq(mintValue)
    })

    it("can't mint any more after reach maxTotalSupply", async () => {
      // minting with max value
      await expect(contract.mint(someone, constants.MaxUint256))
        .to.emit(contract, 'Transfer')
        .withArgs(constants.AddressZero, someone, constants.MaxUint256)
      // after minting with max value, we expect can't mint any more
      await expect(contract.mint(someone, 1)).to.be.reverted
    })

    it('every one can mint', async () => {
      // owner can mint
      await expect(contract.mint(someone, mintValue))
        .to.emit(contract, 'Transfer')
        .withArgs(constants.AddressZero, someone, mintValue)
      // not owner can mint
      await expect(bob.address).not.eq(owner.address)
      await expect(contract.connect(bob).mint(someone, mintValue))
        .to.emit(contract, 'Transfer')
        .withArgs(constants.AddressZero, someone, mintValue)
    })
  })

  describe('balanceOf', () => {
    beforeEach(deploy)

    it('initial of balance', async () => {
      const balance = await contract.balanceOf(someone)
      expect(balance).eq(0)
    })

    it('increase balance by mint method', async () => {
      // initial balance start with 0
      const initialBalance = await contract.balanceOf(someone)
      expect(initialBalance).eq(0)
      // increase balance
      for (let i = 0; i < 3; i++) {
        await contract.mint(someone, mintValue)
        const balance = await contract.balanceOf(someone)
        expect(balance).eq(mintValue.mul(i + 1))
      }
    })
  })

  describe('transfer', () => {
    beforeEach(deploy)

    it('from bob to alice with insufficient balance case', async () => {
      // let give bob some amount but less than value data
      const initialBalance = mintValue.div(2)
      expect(initialBalance).lt(mintValue)
      await contract.mint(bob.address, initialBalance)
      // besure balance of bob less than amount will transfer
      const bobBalance = await contract.balanceOf(bob.address)
      expect(bobBalance).eq(initialBalance)
      // transfering an amount larger than bob balance to alice
      const aliceBalance = await contract.balanceOf(alice.address)
      await expect(contract.connect(bob).transfer(alice.address, mintValue)).to
        .be.reverted
      // after trigger transfer method, no ones balance did change
      expect(await contract.balanceOf(bob.address)).eq(bobBalance)
      expect(await contract.balanceOf(alice.address)).eq(aliceBalance)
    })

    it('from bob to alice with enough balance case', async () => {
      // give bob some token
      await contract.mint(bob.address, mintValue)
      const bobBalance = await contract.balanceOf(bob.address)
      const aliceBalance = await contract.balanceOf(alice.address)
      await expect(contract.connect(bob).transfer(alice.address, mintValue))
        .to.emit(contract, 'Transfer')
        .withArgs(bob.address, alice.address, mintValue)
      // after transfer we expect balance of bob will lost an amount equal to mintValue
      expect(await contract.balanceOf(bob.address)).eq(
        bobBalance.sub(mintValue)
      )
      // and also expect balance of alice will receive some amount equal to mintValue
      expect(await contract.balanceOf(alice.address)).eq(
        aliceBalance.add(mintValue)
      )
    })
  })

  describe('approve and transferFrom', () => {
    let bobBalance: BigNumber, aliceBalance: BigNumber, approvedBalance: BigNumber
    // case: bob approve david to use his balance and david sent some piece to alice
    beforeEach(async () => {
      await deploy()
      approvedBalance = mintValue.div(2)
      await contract.connect(bob).approve(david.address, approvedBalance)
      bobBalance = await contract.balanceOf(bob.address)
      aliceBalance = await contract.balanceOf(alice.address)
    })

    it('initial allowance balance', async () => {
      const currentApprovedBalance = await contract.allowance(
        bob.address,
        david.address
      )
      expect(currentApprovedBalance.sub(approvedBalance)).eq(0)
    })

    it('approve will update allowance', async () => {
      await expect(
        contract.connect(bob).approve(david.address, approvedBalance)
      )
        .to.emit(contract, 'Approval')
        .withArgs(bob.address, david.address, approvedBalance)
      expect(await contract.allowance(bob.address, david.address)).eq(
        approvedBalance
      )
    })

    it('transferFrom in insufficient case', async () => {
      // check current balance and sure it less than value
      const value = approvedBalance.div(2)
      expect(bobBalance).lt(value)
      // allowance larger than value
      const allowance = await contract.allowance(bob.address, david.address)
      expect(allowance).gte(value)
      // trigger transfer from and expect that not working
      await expect(
        contract.connect(david).transferFrom(bob.address, alice.address, value)
      ).to.be.reverted
      // expect allowance, balance of bob and alice is no change
      expect(await contract.allowance(bob.address, david.address)).eq(allowance)
      expect(await contract.balanceOf(alice.address)).eq(aliceBalance)
      expect(await contract.balanceOf(bob.address)).eq(bobBalance)
    })

    it('transferFrom with value larger than allowance', async () => {
      const value = approvedBalance.add(1)
      // deposit balance for bob
      await contract.mint(bob.address, value)
      bobBalance = await contract.balanceOf(bob.address)
      expect(bobBalance).gte(value)
      // very sure bob balance enough for transfer from
      await expect(
        contract.connect(david).transferFrom(bob.address, alice.address, value)
      ).to.be.reverted
      // expect balance of bob and alice is no change
      expect(await contract.balanceOf(alice.address)).eq(aliceBalance)
      expect(await contract.balanceOf(bob.address)).eq(bobBalance)
    })

    it('transferFrom with value lower than or equal allowance', async () => {
      const value = approvedBalance
      // deposit balance for bob
      await contract.mint(bob.address, value)
      bobBalance = await contract.balanceOf(bob.address)
      expect(bobBalance).gte(value)
      // very sure bob balance enough for transfer from
      await expect(
        contract.connect(david).transferFrom(bob.address, alice.address, value)
      )
        .to.emit(contract, 'Transfer')
        .withArgs(bob.address, alice.address, value)
      // expect balance of bob will decrease and alice will increase with value amount
      expect(await contract.balanceOf(bob.address)).eq(bobBalance.sub(value))
      expect(await contract.balanceOf(alice.address)).eq(
        aliceBalance.add(value)
      )
      // expect allowance will decrease
      expect(await contract.allowance(bob.address, alice.address)).eq(
        approvedBalance.sub(value)
      )
    })
  })
})
