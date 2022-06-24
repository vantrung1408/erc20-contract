// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./RDL.sol";
import "./RDX.sol";

contract MasterChef {
    struct User {
        uint256 balance;
        uint256 lastRewardBlock;
        /**
        represent amount of RDX user will receive if he/she claim reward
        Block number    Deposit amount      Acc reward
        1               10                  
        2               20                  (2 - 1) * 20 * rewardPerBlock
        3               30                  (3 - 1) * 30 * rewardPerBlock
        
        each times user deposit/withdraw/claim, we recalculate accReward
        basically accReward = (current block - lastRewardBlock) * balance * balance / chefRDLBalance * rewardPerBlock
         */
        uint256 accReward;
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
        return users[owner].accReward;
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
            user.accReward = 0;
            user.balance = amount;
            user.lastRewardBlock = block.number;
            return;
        }
        // log current deposit amount of owner
        user.balance += amount;
        user.accReward += _calculateMissingReward(user);
        user.lastRewardBlock = block.number;
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
        // let give some example
        // when user balance = 100 and accReward = 50 he/her want to withdraw 10
        // 1. we calculate his/her reward until current block
        // 2. we calculate reward he/she will receive if he/she withdraw 10
        // 3. we update his/her balance
        // 4. transfer RDL to his/her address
        // 5. transfer RDX reward to his/her address and update current accReward
        user.accReward += _calculateMissingReward(user);
        // calculate reward amount for amount will withdraw
        uint256 reward = (amount / user.balance) * user.accReward;
        user.balance -= amount;
        // besure we always support user withdraw even when our balance not enough to fully support user withdraw order
        rdl.transfer(owner, amount);
        // finally transfer reward for user
        _transferReward(owner, reward);
        // update reward state
        user.accReward -= reward;
        user.lastRewardBlock = block.number;
    }

    /**
    claim all reward user has
     */
    function claim(address owner) public {
        User storage user = users[owner];
        // calculate total reward and transfer
        uint256 reward = user.accReward + _calculateMissingReward(user);
        _transferReward(owner, reward);
        // update reward state
        user.accReward = 0;
        user.lastRewardBlock = block.number;
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

    /**
    simulate and calculate reward amount when user claim at block x
     */
    function _calculateMissingReward(User storage user)
        private
        view
        returns (uint256 amount)
    {
        if (user.balance == 0 || user.lastRewardBlock > block.number) {
            return 0;
        }
        uint256 chefBalance = rdl.balanceOf(address(this));
        uint256 ratio = user.balance / chefBalance;
        return (block.number - user.lastRewardBlock) * user.balance * ratio * rewardPerBlock;
    }
}
