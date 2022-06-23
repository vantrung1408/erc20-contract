// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./RDL.sol";
import "./RDX.sol";

contract MasterChef {
    struct User {
        uint256 balance;
        // uint256 depositDate; // now is deprecated, can use block.timestamp but
        // block.timestamp problem -> https://stackoverflow.com/questions/70556821/how-to-avoid-making-time-based-decisions-in-contract-business-logic
        uint256 firstDepositBlock;
        uint256 lastDepositBlock;
        // represent amount will using for correct user claim amount each deposit or withdraw
        /**
        Block number    Deposit amount      Reward debit
        1               10                  
        2               20                  (2 - 1) * 20 * rewardPerBlock
        3               30                  (3 - 1) * 30 * rewardPerBlock
        
        Let give example when we claim at block 5
        claim amount = ((5 - 1) * 10 + (5 - 2) * 20 + (5 - 3) * 30) * rewardPerBlock
        -> this way we need store all transactions info -> so expensive
        
        let try another way by using rewardDebt variable and recalculate per deposit/withdraw
        claim amount = ((5 - 1) * balance (60)) * rewardPerBlock - rewardDebt
        for above example sum of rewardDebt = ((2 - 1) * 20 + (3 - 1) * 30) * rewardPerBlock
        finally claim amount = ((5 - 1) * balance - rewardDebt) * rewardPerBlock
        -> only store rewardDebt
         */
        uint256 rewardDebt;
    }

    RDL private immutable _rdl;
    RDX private immutable _rdx;
    address private immutable _current;
    uint256 private immutable _rewardPerBlock;
    mapping(address => User) private _users;

    constructor(
        address rdlAddress,
        address rdxAddress,
        uint256 rewardPerBlock
    ) {
        _rdl = RDL(rdlAddress);
        _rdx = RDX(rdxAddress);
        _current = address(this);
        _rewardPerBlock = rewardPerBlock;
    }

    /**
    return rdl balance of user
     */
    function depositedBalance(address owner)
        public
        view
        returns (uint256 balance)
    {
        return _users[owner].balance;
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
        // validate allowance of owner and current masterchef address
        require(_rdl.allowance(owner, _current) >= amount, "Alowance limit");
        // validate balance of owner enough
        require(
            _rdl.balanceOf(owner) >= amount,
            "User RDL balance isn't enough"
        );
        // trigger transferFrom to transfer token
        _rdl.transferFrom(owner, _current, amount);
        // update state of user
        User memory user = _users[owner];
        // if balance equal to 0 -> the first deposit
        // we don't need calculate reward debit here -> alway true even user immediately claim
        if (user.balance == 0) {
            user.rewardDebt = 0;
            user.balance = amount;
            user.firstDepositBlock = block.number;
            user.lastDepositBlock = block.number;
            return;
        }
        // log current deposit amount of owner
        user.balance += amount;
        uint256 rewardDebtAtBlock = (block.number - user.firstDepositBlock) *
            amount *
            _rewardPerBlock;
        user.rewardDebt += rewardDebtAtBlock;
        user.lastDepositBlock = block.number;
    }

    /**
    transfer amount of token RDL to special address has own it
     */
    function withdraw(address owner, uint256 amount) public {
        // check balance of user
        User memory user = _users[owner];
        uint256 balance = user.balance;
        require(balance >= amount, "Withdraw amount not valid");
        // check balance of chef
        uint256 balanceOfChef = _rdl.balanceOf(_current);
        require(balanceOfChef > 0, "Chef balance not enough");
        // besure we always support user withdraw even when our balance not enough to fully support user withdraw order
        uint256 withdrawAmount = balanceOfChef > amount
            ? amount
            : balanceOfChef;
        _rdl.transfer(owner, withdrawAmount);
        // after transfer update current state of user
        // when user withdraw x amount at block y then at that block if user claim they will receive z reward amount
        // but z reward amount mean they claim base on all balance
        // that mean if they withdraw x -> they will receive w = balance / z * x
        // w will represent on rewardDebt
        uint256 currentRewardAmount = calculateReward(owner);
        uint256 rewardDebtAtBlock = (user.balance / currentRewardAmount) *
            withdrawAmount;
        user.rewardDebt -= rewardDebtAtBlock;
        user.balance -= withdrawAmount;
    }

    /**
    calculate and transfer token RDX to address has request claim
     */
    function claim(address owner) public {
        // check reward amount
        uint256 amount = calculateReward(owner);
        require(amount > 0, "Amount to claim not valid");
        // check rdx balance of chef
        uint256 rdxBalanceOfChef = _rdx.balanceOf(_current);
        require(rdxBalanceOfChef > 0, "RDX balance of chef not valid");

        User memory user = _users[owner];
        uint256 claimAmount = rdxBalanceOfChef > amount
            ? amount
            : rdxBalanceOfChef;
        // trigger erc20 to transfer rdx to address
        _rdx.transfer(owner, claimAmount);
        // update state
        user.rewardDebt = claimAmount;
    }

    /**
    simulate and calculate reward amount when user claim at block x
     */
    function calculateReward(address to)
        private
        view
        returns (uint256 amount)
    {
        User memory user = _users[to];
        if (user.balance == 0 || user.firstDepositBlock > block.number) {
            return 0;
        }
        return
            (block.number - user.firstDepositBlock) *
            user.balance -
            user.rewardDebt;
    }
}
