// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./IERC20.sol";
import "./ERC20.sol";

contract LiquidityPool is ERC20 {
    // store liquidity provider
    struct LiquidityProvider {
        // total amount of A, summary of all time added liquidity pool of user
        uint256 amountA;
        // total amount of B, summary of all time added liquidity pool of user
        uint256 amountB;
        //
    }
    // presenting swap info for user view
    struct SwapInfo {
        uint256 outputAmount;
        uint256 fee;
    }

    // [TODO] implement fee reward
    // struct FeeInfo {
    //     // total locked fee amount when user swap from B to A
    //     uint256 lockedA;
    //     // total locked fee amount when user swap from A to B
    //     uint256 lockedB;
    //     // accumulated user ratio when add liquidity
    //     uint256 accPerShare;
    //     // update when one of amountA, amountB was changed
    //     uint256 lastBlockNumber;
    // }

    // mapping(address => FeeInfo) public lpReward;
    mapping(address => LiquidityProvider) public lp;
    // total amount of A in pool
    uint256 public amountA;
    // total amount of B in pool
    uint256 public amountB;
    // constant value = amountA * amountB, will not change when swap and change when add, remove liquidity
    uint256 public constantValue;
    //
    uint256 public constant PRECISION = 1e12;
    // let assumption each tokenA added user will receive 10 token lp
    uint256 public constant REWARD_PER_TOKEN_A = 10;
    // erc20 token
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    // this smc will represent liquidity pool of RDX vs USDR, lqToken will be RDL
    // user will use RDL to
    constructor(IERC20 _tokenA, IERC20 _tokenB) ERC20("RDL Token", "RDL", 18) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    // calculate swap info base on current state and return to client
    function getSwapInfo(
        address _tokenIn,
        address _tokenOut,
        uint256 _amount
    )
        public
        view
        validateTokenAddress(_tokenIn, _tokenOut)
        returns (SwapInfo memory)
    {
        // 1. calculate amount out = amount of token out - constantValue / (amount of token in - _amount)
        uint256 totalBefore = _getAmountOfTokenByAddress(_tokenOut) * PRECISION;
        uint256 totalAfter = (constantValue * PRECISION) /
            (_getAmountOfTokenByAddress(_tokenIn) + _amount);
        uint256 amountOut = totalBefore - totalAfter;
        // 2. calculate fee = _calculateFee(_amount)
        // [TODO] implement fee reward
        uint256 fee = 0;
        return SwapInfo(amountOut / PRECISION, fee);
    }

    // swap from x amount of token in to y amount of token out, y = k / (x + current amount of token in)
    function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 _amount,
        uint256 _minAmountOut
    ) public validateTokenAddress(_tokenIn, _tokenOut) {
        // swap process
        // 1. validate amount to swap
        uint256 currentAmount = _getAmountOfTokenByAddress(_tokenIn);
        require(currentAmount >= _amount, "token in pool not enough");
        // 2 get swap info
        SwapInfo memory info = getSwapInfo(_tokenIn, _tokenOut, _amount);
        // 3. validate _outputAmount from 1 with _minAmountOut
        require(info.outputAmount >= _minAmountOut, "not user expected output");
        // 4. update amount of token in and out
        // 5. transfer _amount of token in from user address to contract address
        // 6. transfer _outputAmount of token out from contract address to user address
        if (_tokenIn == address(tokenA)) {
            amountA += _amount;
            tokenA.transferFrom(msg.sender, address(this), _amount);

            amountB -= info.outputAmount;
            tokenB.transfer(msg.sender, info.outputAmount);
        } else {
            amountA -= info.outputAmount;
            tokenA.transfer(msg.sender, info.outputAmount);

            amountB += _amount;
            tokenB.transferFrom(msg.sender, address(this), _amount);
        }
        // 7. update total fee locked
    }

    // add liquidity
    function add(uint256 _amountA, uint256 _amountB)
        public
        validateRatio(_amountA, _amountB)
    {
        // add liquidity process
        // 1. validate ratio of _amountA / _amountB
        // 2. update amount of token A, B
        amountA += _amountA;
        amountB += _amountB;
        // 3. update k = new amount of A * new amount of B
        constantValue = amountA * amountB;
        // 4. transfer _amountA of token A from user address to contract address
        tokenA.transferFrom(msg.sender, address(this), _amountA);
        // 5. transfer _amountB of token B from user address to contract address
        tokenB.transferFrom(msg.sender, address(this), _amountB);
        // 6. update liquidity provider info
        lp[msg.sender].amountA += _amountA;
        lp[msg.sender].amountB += _amountB;
        // 7. minting LP base on amount for user
        _mint(_amountA * REWARD_PER_TOKEN_A);
        // 8. calculate fee reward and transfer to liquidity provider (more stake get more reward)
    }

    // remove liquidity
    function remove(uint256 _amountA, uint256 _amountB)
        public
        validateRatio(_amountA, _amountB)
    {
        LiquidityProvider storage user = lp[msg.sender];
        // remove liquidity process
        // 1. validate ratio of _amountA / _amountB
        // 2. validate pool balance, liquidity provider balance with _amountA, _amountB
        require(
            amountA >= _amountA && amountB >= _amountB,
            "withdraw amount not valid with pool balance"
        );
        require(
            user.amountA >= _amountA && user.amountB >= _amountB,
            "withdraw amount not valid with user balance"
        );
        // 3. update amount of token A, B
        amountA -= _amountA;
        amountB -= _amountB;
        // 4. update k = new amount of A * new amount of B
        constantValue = amountA * amountB;
        // 5. transfer _amountA of token A from contract address to user address
        tokenA.transfer(msg.sender, _amountA);
        // 6. transfer _amountB of token B from contract address to user address
        tokenB.transfer(msg.sender, _amountB);
        // 7. update liquidity provider info
        user.amountA -= _amountA;
        user.amountB -= _amountB;
        // 8. calculate fee reward and transfer to liquidity provider (more stake get more reward)
    }

    // [TODO] implement fee reward
    // an fixed fee will be charged when user using swap, the fee will be reward for liquidity provider
    // function _calculateFee(uint256 _amount) private pure returns (uint256) {
    //     return (_amount * 1000) / 3;
    // }

    // mint reward for user
    function _mint(uint256 value) private {
        require(
            value + _totalSupply <= type(uint256).max,
            "Value to mint not valid"
        );

        _totalSupply += value;
        _balances[msg.sender] += value;
        emit Transfer(address(0), msg.sender, value);
    }

    // input token address and check that address is tokenA or tokenB and return value coresponding to the address
    function _getAmountOfTokenByAddress(address _tokenAddress)
        private
        view
        returns (uint256)
    {
        if (_tokenAddress == address(tokenA)) {
            return amountA;
        }
        return amountB;
    }

    // ensure _tokenIn is one of tokenA or tokenB and _tokenOut is tokenB when _tokenIn is tokenA and tokenA when _tokenIn is tokenB
    modifier validateTokenAddress(address _tokenIn, address _tokenOut) {
        require(_tokenIn != _tokenOut, "pair issue");
        require(
            _tokenIn == address(tokenA) || _tokenIn == address(tokenB),
            "tokenIn address not match"
        );
        require(
            _tokenOut == address(tokenA) || _tokenOut == address(tokenB),
            "tokenOut address not match"
        );
        _;
    }

    // validate input amountA and input amountB ratio between them equal to current ratio of amountA / amountB
    modifier validateRatio(uint256 _amountA, uint256 _amountB) {
        if (constantValue != 0) {
            uint256 ratio = (amountA * PRECISION) / amountB;
            uint256 neededB = (_amountA * PRECISION) / ratio;
            require(neededB == _amountB, "ratio issue");
        }
        _;
    }
}
