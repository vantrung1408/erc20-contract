// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./RDL.sol";
import "./RDX.sol";

contract MasterChef {
    struct User {
        uint256 balance;
        uint256 rewardDebt;
    }

    RDL private immutable rdl;
    RDX private immutable rdx;
    uint256 public immutable rewardPerBlock;
    uint256 public constant ACC_PER_SHARE_PRECISION = 1e12;
    uint256 private accRDXPerShare;
    uint256 private lastRewardBlock;
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
        // update current state
        uint256 chefBalance = rdl.balanceOf(address(this));
        uint256 currentPerShare = 0;
        if (chefBalance != 0) {
            currentPerShare += _calculatePerShare(chefBalance);
        }
        // calculate user reward
        User memory user = users[owner];
        amount = ((user.balance * currentPerShare) /
            ACC_PER_SHARE_PRECISION) - user.rewardDebt;
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

        // update state of lastRewardBlock and accRDXShare
        _updateAccShare();
        User storage user = users[owner];
        if (user.balance > 0) {
            claim(owner);
        }
        // trigger transferFrom to transfer token
        rdl.transferFrom(owner, address(this), amount);
        // update state of user)
        // log current deposit amount of owner
        user.balance += amount;
        user.rewardDebt =
            (user.balance * accRDXPerShare) /
            ACC_PER_SHARE_PRECISION;
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
        // update current state
        _updateAccShare();
        if (user.balance > 0) {
            claim(owner);
        }
        // update user state
        user.balance -= amount;
        user.rewardDebt =
            (user.balance * accRDXPerShare) /
            ACC_PER_SHARE_PRECISION;
        // besure we always support user withdraw even when our balance not enough to fully support user withdraw order
        rdl.transfer(owner, amount);
    }

    /**
    claim all reward user has
     */
    function claim(address owner) public {
        // calculate user reward
        uint256 reward = rewardAmount(owner);
        if (reward > 0) {
            _transferReward(owner, reward);
        }
    }

    /**
     */
    function _updateAccShare() private {
        uint256 chefBalance = rdl.balanceOf(address(this));
        if (chefBalance == 0) {
            accRDXPerShare = 0;
        } else {
            accRDXPerShare += _calculatePerShare(chefBalance);
        }
        lastRewardBlock = block.number;
    }

    /**
     */
    function _calculatePerShare(uint256 balance)
        private
        view
        returns (uint256 perShare)
    {
        return
            (ACC_PER_SHARE_PRECISION *
                rewardPerBlock *
                (block.number - lastRewardBlock)) / balance;
    }

    /**
    calculate and transfer token RDX to address has request claim
     */
    function _transferReward(address owner, uint256 amount) private {
        // check reward amount
        require(amount > 0, "Amount to claim not valid");
        // check rdx balance of chef
        uint256 rdxBalanceOfChef = rdx.balanceOf(address(this));
        require(rdxBalanceOfChef > amount, "RDX balance of chef not valid");
        // trigger erc20 to transfer rdx to address
        rdx.transfer(owner, amount);
    }
}
