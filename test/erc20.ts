// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { expect } from "chai";
// import { BigNumber } from "ethers";
// import { ethers } from "hardhat";
// import { before } from "mocha";
// import { ERC20 } from "../typechain";

// describe("ERC20 token creator", () => {
//   let contract: ERC20,
//     owner: SignerWithAddress,
//     bob: SignerWithAddress,
//     alice: SignerWithAddress,
//     someone: string,
//     name: string = "",
//     symbol: string = "",
//     decimals: number = 18,
//     maxTotalSupply: BigNumber = BigNumber.from("100000");

//   const deploy = async () => {
//     const factory = await ethers.getContractFactory("ERC20");
//     contract = await factory.deploy(name, symbol, decimals, maxTotalSupply);
//     await contract.deployed();
//     [owner, bob, alice] = await ethers.getSigners();
//     someone = ethers.Wallet.createRandom().address;
//   };

//   before(deploy);

//   describe("constructing", () => {
//     it("contract deployed successfully", async () => {
//       expect(contract.address).not.equal(undefined);
//     });

//     it("contructor working as expect", async () => {
//       expect(await contract.name()).equal(name);
//       expect(await contract.symbol()).equal(symbol);
//       expect(await contract.decimals()).equal(decimals);
//       expect(await contract.maxTotalSupply()).equal(maxTotalSupply);
//     });
//   });

//   describe("mint", () => {
//     beforeEach(deploy);

//     it("validator", async () => {
//       // validate only creator has access to execute mint function
//       await expect(contract.connect(bob).mint(someone, maxTotalSupply)).to.be
//         .reverted;
//       // validate only number of token less than total supply can be mint
//       await expect(contract.mint(someone, maxTotalSupply.add(1))).to.be
//         .reverted;
//     });

//     it("balance and supply after mint", async () => {
//       const value = maxTotalSupply.div(10);
//       // balance of someone address will be increase
//       await contract.mint(someone, value);
//       const balance = await contract.balanceOf(someone);
//       expect(balance.eq(value)).eq(true);
//       // total supply will be increase
//       const totalSupply = await contract.totalSupply();
//       expect(totalSupply.eq(value)).eq(true);
//     });

//     it("can't mint any more after reach maxTotalSupply", async () => {
//       await expect(contract.mint(someone, maxTotalSupply)).not.be.reverted;
//       await expect(contract.mint(someone, maxTotalSupply)).to.be.reverted;
//     });
//   });

//   describe("balanceOf", () => {
//     beforeEach(deploy);

//     it("initial of balance", async () => {
//       const balance = await contract.balanceOf(someone);
//       expect(balance.eq(0)).eq(true);
//     });

//     it("increase balance by mint method", async () => {
//       const value = maxTotalSupply.div(10);
//       // initial balance start with 0
//       const initialBalance = await contract.balanceOf(someone);
//       expect(initialBalance.eq(0)).eq(true);
//       // increase balance
//       for (let i = 0; i < 5; i++) {
//         await contract.mint(someone, value);
//         const balance = await contract.balanceOf(someone);
//         expect(balance.eq(value.mul(i + 1))).eq(true);
//       }
//     });
//   });

//   describe("transfer", () => {
//     beforeEach(deploy);

//     it("from bob to alice with insufficient balance case", async () => {
//       const value = maxTotalSupply.div(10);
//       // let give bob some amount but less than value data
//       const initialBalance = value.div(2);
//       expect(initialBalance.lt(value)).eq(true);
//       await contract.mint(bob.address, initialBalance);
//       // besure balance of bob less than amount will transfer
//       const bobBalance = await contract.balanceOf(bob.address);
//       expect(bobBalance.eq(initialBalance)).eq(true);
//       // transfering an amount larger than bob balance to alice
//       const aliceBalance = await contract.balanceOf(alice.address);
//       await expect(contract.connect(bob).transfer(alice.address, value)).to.be
//         .reverted;
//       //   await expect(handler).not.to.emit(contract, "Transfer");
//       // after trigger transfer method, no ones balance did change
//       expect((await contract.balanceOf(bob.address)).eq(bobBalance)).eq(true);
//       expect((await contract.balanceOf(alice.address)).eq(aliceBalance)).eq(
//         true
//       );
//     });

//     it("from bob to alice with enough balance case", async () => {
//       const value = maxTotalSupply.div(10);
//       // give bob some token
//       await contract.mint(bob.address, value);
//       const bobBalance = await contract.balanceOf(bob.address);
//       const aliceBalance = await contract.balanceOf(alice.address);

//       await expect(contract.connect(bob).transfer(alice.address, value))
//         .to.emit(contract, "Transfer")
//         .withArgs(bob.address, alice.address, value);
//       // after transfer we expect balance of bob will lost an amount equal to value
//       expect(
//         (await contract.balanceOf(bob.address)).eq(bobBalance.sub(value))
//       ).eq(true);
//       // and also expect balance of alice will receive some amount equal to value
//       expect(
//         (await contract.balanceOf(alice.address)).eq(aliceBalance.add(value))
//       ).eq(true);
//     });
//   });

//   describe("approve and transferFrom", () => {
//     // owner will approve bob using his balance to transfer from bob balance to alice balance
//     const approvedBalance = maxTotalSupply.div(2);
//     let ownerBalance: BigNumber, aliceBalance: BigNumber;
//     beforeEach(async () => {
//       await deploy();
//       await contract.approve(bob.address, approvedBalance);
//       ownerBalance = await contract.balanceOf(owner.address);
//       aliceBalance = await contract.balanceOf(alice.address);
//     });

//     it("initial allowance balance", async () => {
//       const currentApprovedBalance = await contract.allowance(
//         owner.address,
//         bob.address
//       );
//       expect(currentApprovedBalance.sub(approvedBalance).eq(0)).eq(true);
//     });

//     it("approve will update allowance", async () => {
//       await expect(contract.approve(bob.address, approvedBalance))
//         .to.emit(contract, "Approval")
//         .withArgs(owner.address, bob.address, approvedBalance);
//       expect(
//         (await contract.allowance(owner.address, bob.address)).eq(
//           approvedBalance
//         )
//       ).eq(true);
//     });

//     it("transferFrom in insufficient case", async () => {
//       // check current balance and sure it less than value
//       const value = approvedBalance.div(2);
//       expect(ownerBalance.lt(value)).eq(true);
//       // allowance larger than value
//       const allowance = await contract.allowance(owner.address, bob.address);
//       expect(allowance.gte(value)).eq(true);
//       // trigger transfer from and expect that not working
//       await expect(
//         contract.connect(bob).transferFrom(owner.address, alice.address, value)
//       ).to.be.reverted;
//       // expect allowance, balance of owner and alice is no change
//       expect(
//         (await contract.allowance(owner.address, bob.address)).eq(allowance)
//       ).eq(true);
//       expect((await contract.balanceOf(alice.address)).eq(aliceBalance)).eq(
//         true
//       );
//       expect((await contract.balanceOf(owner.address)).eq(ownerBalance)).eq(
//         true
//       );
//     });

//     it("transferFrom with value larger than allowance", async () => {
//       const value = approvedBalance.add(1);
//       // deposit balance for owner
//       await contract.mint(owner.address, value);
//       ownerBalance = await contract.balanceOf(owner.address);
//       expect(ownerBalance.gte(value)).eq(true);
//       // very sure owner balance enough for transfer from
//       await expect(
//         contract.connect(bob).transferFrom(owner.address, alice.address, value)
//       ).to.be.reverted;
//       // expect balance of owner and alice is no change
//       expect((await contract.balanceOf(alice.address)).eq(aliceBalance)).eq(
//         true
//       );
//       expect((await contract.balanceOf(owner.address)).eq(ownerBalance)).eq(
//         true
//       );
//     });

//     it("transferFrom with value lower than or equal allowance", async () => {
//       const value = approvedBalance;
//       // deposit balance for owner
//       await contract.mint(owner.address, value);
//       ownerBalance = await contract.balanceOf(owner.address);
//       expect(ownerBalance.gte(value)).eq(true);
//       // very sure owner balance enough for transfer from
//       await expect(
//         contract.connect(bob).transferFrom(owner.address, alice.address, value)
//       )
//         .to.emit(contract, "Transfer")
//         .withArgs(owner.address, alice.address, value);
//       // expect balance of owner will decrease and alice will increase with value amount
//       expect(
//         (await contract.balanceOf(owner.address)).eq(ownerBalance.sub(value))
//       ).eq(true);
//       expect(
//         (await contract.balanceOf(alice.address)).eq(aliceBalance.add(value))
//       ).eq(true);
//       // expect allowance will decrease
//       expect(
//         (await contract.allowance(owner.address, alice.address)).eq(
//           approvedBalance.sub(value)
//         )
//       ).eq(true);
//     });
//   });
// });
