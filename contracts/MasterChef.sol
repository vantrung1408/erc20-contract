// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./RDL.sol";
import "./RDX.sol";

contract MasterChef {
    struct User {
        uint256 balance;
        uint256 startBlock;
        /**
        represent amount will using for correct user claim amount each deposit or withdraw
        Block number    Deposit amount      Reward debit
        1               10                  
        2               20                  (2 - 1) * 20 * rewardPerBlock
        3               30                  (3 - 1) * 30 * rewardPerBlock
        
        Let give example when we claim at block 5
        claim amount = ((5 - 1) * 10 + (5 - 2) * 20 + (5 - 3) * 30) * rewardPerBlock
        -> this way we need store all transactions info -> so expensive
        
        let try another way by using rewardCorrection variable and recalculate per deposit/withdraw
        claim amount = ((5 - 1) * balance (60)) * rewardPerBlock - rewardCorrection
        for above example sum of rewardCorrection = ((2 - 1) * 20 + (3 - 1) * 30) * rewardPerBlock
        finally claim amount = ((5 - 1) * balance - rewardCorrection) * rewardPerBlock
        -> only store rewardCorrection
         */
        uint256 rewardCorrection;
    }

    RDL private immutable rdl;
    RDX private immutable rdx;
    uint256 public immutable rewardPerBlock;
    uint256 public totalRDL;
    mapping(address => User) public users;

    constructor(
        address _rdlAddress,
        address _rdxAddress,
        uint256 _rewardPerBlock
    ) {
        rdl = RDL(_rdlAddress);
        rdx = RDX(_rdxAddress);
        rewardPerBlock = _rewardPerBlock;
    }

    /**
    return rdl balance of user
     */
    function depositedBalance(address owner)
        public
        view
        returns (uint256 balance)
    {
        return users[owner].balance;
    }

    /**
    return rdx amount will reward for user
     */
    function rewardAmount(address owner) public view returns (uint256 amount) {
        return calculateReward(owner);
    }

    /**
    transfer amount of token RDL from owner to current MasterChef address
     */
    function deposit(address owner, uint256 amount) public {
        // reject deposit amount with 0
        require(amount > 0, "Deposit amount not valid");
        // validate balance of owner enough
        require(
            rdl.balanceOf(owner) >= amount,
            "User RDL balance isn't enough"
        );
        // trigger transferFrom to transfer token
        rdl.transferFrom(owner, address(this), amount);
        // update state of user
        User storage user = users[owner];
        // if balance equal to 0 -> the first deposit
        // we don't need calculate reward debit here -> alway true even user immediately claim
        if (user.balance == 0) {
            user.rewardCorrection = 0;
            user.balance = amount;
            user.startBlock = block.number;
            return;
        }
        // log current deposit amount of owner
        user.balance += amount;
        uint256 rewardCorrectionAtBlock = calculateReward(
            amount,
            block.number,
            user.startBlock,
            0
        );
        user.rewardCorrection += rewardCorrectionAtBlock;
    }

    /**
    transfer amount of token RDL to special address has own it
     */
    function withdraw(address owner, uint256 amount) public {
        // check balance of user
        User storage user = users[owner];
        uint256 balance = user.balance;
        require(balance >= amount, "Withdraw amount not valid");
        // check balance of chef
        uint256 balanceOfChef = rdl.balanceOf(address(this));
        require(balanceOfChef > amount, "Chef balance not enough");
        // besure we always support user withdraw even when our balance not enough to fully support user withdraw order
        rdl.transfer(owner, amount);
        // after transfer update current state of user
        // when user withdraw x amount at block y then at that block if user claim they will receive z reward amount
        // but z reward amount mean they claim base on all balance
        // that mean if they withdraw x -> they will receive w = balance / z * x
        // w will represent on rewardCorrection
        user.balance -= amount;
        uint256 currentRewardAmount = calculateReward(owner);
        uint256 rewardCorrectionAtBlock = (user.balance / currentRewardAmount) *
            amount;
        user.rewardCorrection -= rewardCorrectionAtBlock;
    }

    /**
    calculate and transfer token RDX to address has request claim
     */
    function claim(address owner) public {
        // check reward amount
        uint256 amount = calculateReward(owner);
        require(amount > 0, "Amount to claim not valid");
        // check rdx balance of chef
        uint256 rdxBalanceOfChef = rdx.balanceOf(address(this));
        require(rdxBalanceOfChef > amount, "RDX balance of chef not valid");

        User storage user = users[owner];
        // trigger erc20 to transfer rdx to address
        rdx.transfer(owner, amount);
        // update state
        user.rewardCorrection = amount;
    }

    /**
    simulate and calculate reward amount when user claim at block x
     */
    function calculateReward(address owner)
        private
        view
        returns (uint256 amount)
    {
        User storage user = users[owner];
        if (user.balance == 0 || user.startBlock > block.number) {
            return 0;
        }
        return
            calculateReward(
                user.balance,
                block.number,
                user.startBlock,
                user.rewardCorrection
            );
    }

    /**
    calculate reward between two block numbers
     */
    function calculateReward(
        uint256 balance,
        uint256 blockNumber,
        uint256 startBlockNumber,
        uint256 correction
    ) private view returns (uint256 amount) {
        uint256 chefRDL = rdl.balanceOf(address(this));
        uint256 ratio = balance / chefRDL;
        return
            ratio *
            (blockNumber - startBlockNumber) *
            balance *
            rewardPerBlock -
            correction;
    }
}
