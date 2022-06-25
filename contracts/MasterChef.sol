// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./IERC20.sol";
import "hardhat/console.sol";

contract MasterChef {
    struct User {
        uint256 balance;
        uint256 rewardDebt;
    }

    address private creator;
    IERC20 private immutable rdl;
    IERC20 private immutable rdx;
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
        rdl = IERC20(_rdlAddress);
        rdx = IERC20(_rdxAddress);
        rewardPerBlock = _rewardPerBlock;
        creator = msg.sender;
    }

    /**
    return rdx amount will reward for user
     */
    function rewardAmount() public view returns (uint256) {
        // update current state
        uint256 chefBalance = rdl.balanceOf(address(this));
        uint256 currentPerShare = 0;
        if (chefBalance != 0) {
            currentPerShare = accRDXPerShare + _calculatePerShare(chefBalance);
        }
        if (currentPerShare == 0) {
            return 0;
        }
        // calculate user reward
        User storage user = users[msg.sender];
        return ((user.balance * currentPerShare) / ACC_PER_SHARE_PRECISION) -
                    user.rewardDebt;
    }

    /**
    transfer amount of token RDL from owner to current MasterChef address
     */
    function deposit(uint256 _amount) public {
        // reject deposit amount with 0
        require(_amount > 0, "Deposit amount not valid");

        // update state of lastRewardBlock and accRDXShare
        _updateAccShare();
        User storage user = users[msg.sender];
        if (user.balance > 0) {
            claim();
        }
        // trigger transferFrom to transfer token
        rdl.transferFrom(msg.sender, address(this), _amount);
        // update state of user)
        // log current deposit _amount of owner
        user.balance += _amount;
        user.rewardDebt =
            (user.balance * accRDXPerShare) /
            ACC_PER_SHARE_PRECISION;
    }

    /**
    transfer amount of token RDL to special address has own it
     */
    function withdraw(uint256 _amount) public {
        // check balance of user
        User storage user = users[msg.sender];
        require(user.balance >= _amount, "Withdraw amount not valid");

        // update current state
        _updateAccShare();
        if (user.balance > 0) {
            claim();
        }
        // update user state
        user.balance -= _amount;
        user.rewardDebt =
            (user.balance * accRDXPerShare) /
            ACC_PER_SHARE_PRECISION;
        // besure we always support user withdraw even when our balance not enough to fully support user withdraw order
        rdl.transfer(msg.sender, _amount);
    }

    /**
    claim all reward user has
     */
    function claim() public {
        // calculate user reward
        uint256 reward = rewardAmount();
        if (reward > 0) {
            _transferReward(msg.sender, reward);
        }
    }

    /**
    using to transfer all pool balance of RDX to creator
    emergency call, only creator can trigger
     */
    function withdrawPoolBalance() public {
        require(msg.sender == creator, "Only creator can trigger");
        rdx.transfer(creator, rdx.balanceOf(address(this)));
        rdl.transfer(creator, rdl.balanceOf(address(this)));
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
    function _calculatePerShare(uint256 _balance)
        private
        view
        returns (uint256)
    {
        return
            (ACC_PER_SHARE_PRECISION *
                rewardPerBlock *
                (block.number - lastRewardBlock)) / _balance;
    }

    /**
    calculate and transfer token RDX to address has request claim
     */
    function _transferReward(address _owner, uint256 _amount) private {
        // check reward amount
        require(_amount > 0, "Amount to claim not valid");
        // check rdx balance of chef
        uint256 rdxBalanceOfChef = rdx.balanceOf(address(this));
        require(rdxBalanceOfChef > _amount, "RDX balance of chef not valid");
        // trigger erc20 to transfer rdx to address
        rdx.transfer(_owner, _amount);
    }
}
