// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./IERC20.sol";

contract LiquidityPool {
    // store liquidity provider
    struct LiquidityProvider {
        // total amount of A, summary of all time add liquidity pool of user
        uint256 amountA;
        // total amount of B, summary of all time add liquidity pool of user
        uint256 amountB;
        //
    }
    // presenting swap info for user view
    struct SwapInfo {
        uint256 outputAmount;
        uint256 fee;
    }

    mapping(address => LiquidityProvider) public liquidityProvider;
    // total amount of A in pool
    uint256 public amountA;
    // total amount of B in pool
    uint256 public amountB;
    // constant value = amountA * amountB, will not change when swap and change when add, remove liquidity
    uint256 public constantValue;
    //
    uint256 public constant PRICE_PRECISION = 1e12;
    // erc20 token
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    // using as reward and will distribute for all staking holders
    IERC20 public immutable tokenLP;

    // this smc will represent liquidity pool of RDX vs USDR, lqToken will be RDL
    // user will use RDL to
    constructor(
        IERC20 _tokenA,
        IERC20 _tokenB,
        IERC20 _tokenLP
    ) {
        tokenA = _tokenA;
        tokenB = _tokenB;
        tokenLP = _tokenLP;
    }

    // calculate swap info base on current state and return to client
    function getSwapInfo(
        address _tokenIn,
        address _tokenOut,
        uint256 _amount
    ) public view returns (SwapInfo memory) {
        // 1. calculate amount out = constantValue / (amount of token in + _amount)
        // 2. calculate fee = _calculateFee(_amount)
    }

    // calculate ratio of per tokenIn / tokenOut
    function getRatio(address _tokenIn, address _tokenOut)
        public
        view
        returns (uint256)
    {
        // checking token address
        // calculate amount of in / amount of out and return
    }

    // swap from x amount of token in to y amount of token out, y = k / (x + current amount of token in)
    function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 _amount,
        uint256 _minAmountOut
    ) public {
        // swap process
        // 1. get swap info
        // 2. validate _outputAmount from 1 with _minAmountOut
        // 2. update amount of token in and out
        // 3. transfer _amount of token in from user address to contract address
        // 4. transfer _outputAmount of token out from contract address to user address
        // 5. transfer _fee to liquidity provider (more stake get more reward)
    }

    // add liquidity
    function add(uint256 _amountA, uint256 _amountB) public {
        // add liquidity process
        // 1. validate ratio of _amountA / _amountB
        // 2. update amount of token A, B
        // 3. update k = new amount of A * new amount of B
        // 4. transfer _amountA of token A from user address to contract address
        // 5. transfer _amountB of token B from user address to contract address
        // 6. update liquidity provider info
        // 7. minting LP base on amount for user
    }

    // remove liquidity
    function remove(uint256 _amountA, uint256 _amountB) public {
        // remove liquidity process
        // 1. validate ratio of _amountA / _amountB
        // 2. update amount of token A, B
        // 3. update k = new amount of A * new amount of B
        // 4. transfer _amountA of token A from contract address to user address
        // 5. transfer _amountB of token B from contract address to user address
        // 6. update liquidity provider info
        // 7. 
    }

    // an fixed fee will be charged when user using swap, the fee will be reward for liquidity provider
    function _calculateFee(uint256 _amount) private pure returns (uint256) {
        return (_amount * 1000) / 3;
    }
}
