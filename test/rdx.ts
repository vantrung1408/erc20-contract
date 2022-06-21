import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { before } from "mocha";
import { RDX } from "../typechain";

describe("RDX token creator", () => {
  let contract: RDX,
    owner: SignerWithAddress,
    bob: SignerWithAddress,
    alice: SignerWithAddress,
    david: SignerWithAddress,
    someone: string,
    decimals: number = 18,
    maxTotalSupply: BigNumber = BigNumber.from("100000");

  const deploy = async () => {
    const factory = await ethers.getContractFactory("RDX");
    contract = await factory.deploy(decimals, maxTotalSupply);
    await contract.deployed();
    [owner, bob, alice, david] = await ethers.getSigners();
    someone = ethers.Wallet.createRandom().address;
  };

  before(deploy);

  describe("constructing", () => {
    it("contract deployed successfully", async () => {
      expect(contract.address).not.eq(undefined);
    });

    it("contructor working as expect", async () => {
      expect(await contract.decimals()).eq(decimals);
      expect(await contract.maxTotalSupply()).eq(maxTotalSupply);
      expect(await contract.balanceOf(owner.address)).eq(maxTotalSupply);
    });
  });

  describe("balanceOf", () => {
    beforeEach(deploy);

    it("initial of balance", async () => {
      const balance = await contract.balanceOf(someone);
      expect(balance).eq(0);
    });

    it("increase balance by mint method", async () => {
      const value = maxTotalSupply.div(10);
      // initial balance start with 0
      const initialBalance = await contract.balanceOf(someone);
      expect(initialBalance).eq(0);
      // increase balance
      for (let i = 0; i < 5; i++) {
        await contract.transfer(someone, value);
        const balance = await contract.balanceOf(someone);
        expect(balance).eq(value.mul(i + 1));
      }
    });
  });

  describe("transfer", () => {
    beforeEach(deploy);

    it("from bob to alice with insufficient balance case", async () => {
      const value = maxTotalSupply.div(10);
      // let give bob some amount but less than value data
      const initialBalance = value.div(2);
      expect(initialBalance).lt(value);
      await contract.transfer(bob.address, initialBalance);
      // besure balance of bob less than amount will transfer
      const bobBalance = await contract.balanceOf(bob.address);
      expect(bobBalance).eq(initialBalance);
      // transfering an amount larger than bob balance to alice
      const aliceBalance = await contract.balanceOf(alice.address);
      await expect(contract.connect(bob).transfer(alice.address, value)).to.be
        .reverted;
      //   await expect(handler).not.to.emit(contract, "Transfer");
      // after trigger transfer method, no ones balance did change
      expect(await contract.balanceOf(bob.address)).eq(bobBalance);
      expect(await contract.balanceOf(alice.address)).eq(aliceBalance);
    });

    it("from bob to alice with enough balance case", async () => {
      const value = maxTotalSupply.div(10);
      // give bob some token
      await contract.transfer(bob.address, value);
      const bobBalance = await contract.balanceOf(bob.address);
      const aliceBalance = await contract.balanceOf(alice.address);

      await expect(contract.connect(bob).transfer(alice.address, value))
        .to.emit(contract, "Transfer")
        .withArgs(bob.address, alice.address, value);
      // after transfer we expect balance of bob will lost an amount equal to value
      expect(await contract.balanceOf(bob.address)).eq(bobBalance.sub(value));
      // and also expect balance of alice will receive some amount equal to value
      expect(await contract.balanceOf(alice.address)).eq(
        aliceBalance.add(value)
      );
    });
  });

  describe("approve and transferFrom", () => {
    const approvedBalance = maxTotalSupply.div(2);
    let bobBalance: BigNumber, aliceBalance: BigNumber;
    // case: bob approve david to use his balance and david sent some piece to alice
    beforeEach(async () => {
      await deploy();
      await contract.connect(bob).approve(david.address, approvedBalance);
      bobBalance = await contract.balanceOf(bob.address);
      aliceBalance = await contract.balanceOf(alice.address);
    });

    it("initial allowance balance", async () => {
      const currentApprovedBalance = await contract.allowance(
        bob.address,
        david.address
      );
      expect(currentApprovedBalance.sub(approvedBalance)).eq(0);
    });

    it("approve will update allowance", async () => {
      await expect(
        contract.connect(bob).approve(david.address, approvedBalance)
      )
        .to.emit(contract, "Approval")
        .withArgs(bob.address, david.address, approvedBalance);
      expect(await contract.allowance(bob.address, david.address)).eq(
        approvedBalance
      );
    });

    it("transferFrom in insufficient case", async () => {
      // check current balance and sure it less than value
      const value = approvedBalance.div(2);
      expect(bobBalance).lt(value);
      // allowance larger than value
      const allowance = await contract.allowance(bob.address, david.address);
      expect(allowance).gte(value);
      // trigger transfer from and expect that not working
      await expect(
        contract.connect(david).transferFrom(bob.address, alice.address, value)
      ).to.be.reverted;
      // expect allowance, balance of bob and alice is no change
      expect(await contract.allowance(bob.address, david.address)).eq(
        allowance
      );
      expect(await contract.balanceOf(alice.address)).eq(aliceBalance);
      expect(await contract.balanceOf(bob.address)).eq(bobBalance);
    });

    it("transferFrom with value larger than allowance", async () => {
      const value = approvedBalance.add(1);
      // deposit balance for bob
      await contract.transfer(bob.address, value);
      bobBalance = await contract.balanceOf(bob.address);
      expect(bobBalance).gte(value);
      // very sure bob balance enough for transfer from
      await expect(
        contract.connect(david).transferFrom(bob.address, alice.address, value)
      ).to.be.reverted;
      // expect balance of bob and alice is no change
      expect(await contract.balanceOf(alice.address)).eq(aliceBalance);
      expect(await contract.balanceOf(bob.address)).eq(bobBalance);
    });

    it("transferFrom with value lower than or equal allowance", async () => {
      const value = approvedBalance;
      // deposit balance for bob
      await contract.transfer(bob.address, value);
      bobBalance = await contract.balanceOf(bob.address);
      expect(bobBalance).gte(value);
      // very sure bob balance enough for transfer from
      await expect(
        contract.connect(david).transferFrom(bob.address, alice.address, value)
      )
        .to.emit(contract, "Transfer")
        .withArgs(bob.address, alice.address, value);
      // expect balance of bob will decrease and alice will increase with value amount
      expect(await contract.balanceOf(bob.address)).eq(bobBalance.sub(value));
      expect(await contract.balanceOf(alice.address)).eq(
        aliceBalance.add(value)
      );
      // expect allowance will decrease
      expect(await contract.allowance(bob.address, alice.address)).eq(
        approvedBalance.sub(value)
      );
    });
  });
});
