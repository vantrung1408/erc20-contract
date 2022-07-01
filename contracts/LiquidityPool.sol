// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./IERC20.sol";
import "./ERC20.sol";
import "hardhat/console.sol";

contract LiquidityPool is ERC20 {
    // presenting swap info for user view
    struct SwapInfo {
        uint256 outputAmount;
        uint256 fee;
    }

    // total amount of A in pool
    uint256 public amountA;
    // total amount of B in pool
    uint256 public amountB;
    // constant value = amountA * amountB, will not change when swap and change when add, remove liquidity
    uint256 public k;
    //
    uint256 public constant PRECISION = 1e12;
    // let assumption each tokenA added user will receive 10 token lp
    uint256 public constant INITIAL_LP = 1e18;
    uint256 public REWARD_PER_TOKEN_A = 0;
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
        // 1. calculate amount out = amount of token out - k / (amount of token in - _amount)
        uint256 totalBefore = _getAmountOfTokenByAddress(_tokenOut) * PRECISION;
        uint256 totalAfter = (k * PRECISION) /
            (_getAmountOfTokenByAddress(_tokenIn) + _amount);
        uint256 amountOut = totalBefore - totalAfter;
        // 2. calculate fee = _calculateFee(_amount)
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
        // 7. calculate fee and mint that fee as lp amount for pool
        if (_tokenIn == address(tokenA)) {
            amountA += _amount;
            tokenA.transferFrom(msg.sender, address(this), _amount);

            amountB -= info.outputAmount;
            tokenB.transfer(msg.sender, info.outputAmount);

            uint256 fee = _calculateLPAmount(_amount);
            _mint(address(this), (fee / 1000) * 3);
        } else {
            amountA -= info.outputAmount;
            tokenA.transfer(msg.sender, info.outputAmount);

            amountB += _amount;
            tokenB.transferFrom(msg.sender, address(this), _amount);

            uint256 fee = _calculateLPAmount(info.outputAmount);
            _mint(address(this), (fee / 1000) * 3);
        }
    }

    // add liquidity
    function add(uint256 _amountA, uint256 _amountB) public {
        // add liquidity process
        // 1. get correction amount
        (_amountA, _amountB) = _prepareAmount(_amountA, _amountB);
        // 2. transfer _amountA of token A from user address to contract address
        tokenA.transferFrom(msg.sender, address(this), _amountA);
        // 3. transfer _amountB of token B from user address to contract address
        tokenB.transferFrom(msg.sender, address(this), _amountB);
        // 4. minting LP base on amount for user
        if (k == 0) {
            _mint(msg.sender, INITIAL_LP);
            REWARD_PER_TOKEN_A = (INITIAL_LP * PRECISION) / _amountA;
        } else {
            uint256 reward = _calculateLPAmount(_amountA);
            _mint(msg.sender, reward);
        }
        // 5. update amount of token A, B
        amountA += _amountA;
        amountB += _amountB;
        // 6. update k = new amount of A * new amount of B
        k = amountA * amountB;
    }

    // remove liquidity
    function remove(uint256 _amountA, uint256 _amountB) public {
        // remove liquidity process
        // 1. get correction amount
        (_amountA, _amountB) = _prepareAmount(_amountA, _amountB);
        // 2. validate pool balance, liquidity provider balance with _amountA, _amountB
        require(
            amountA >= _amountA && amountB >= _amountB,
            "withdraw amount not valid with pool balance"
        );
        (uint256 depositedA, uint256 depositedB) = _getUserDepositedAmount();
        require(
            depositedA >= _amountA && depositedB >= _amountB,
            "withdraw amount not valid with user balance"
        );
        // 3. update amount of token A, B
        amountA -= _amountA;
        amountB -= _amountB;
        // 4. update k = new amount of A * new amount of B
        k = amountA * amountB;
        // 5. transfer _amountA of token A from contract address to user address
        tokenA.transfer(msg.sender, _amountA);
        // 6. transfer _amountB of token B from contract address to user address
        tokenB.transfer(msg.sender, _amountB);
        // 7. burn lp token of user
        transfer(address(0), _calculateLPAmount(_amountA));
    }

    // mint reward for user
    function _mint(address to, uint256 value) private {
        require(
            value + _totalSupply <= type(uint256).max,
            "Value to mint not valid"
        );

        _totalSupply += value;
        _balances[to] += value;
        emit Transfer(address(0), to, value);
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

    // amount correction
    function _prepareAmount(uint256 _amountA, uint256 _amountB)
        private
        view
        returns (uint256, uint256)
    {
        if (k == 0) {
            return (_amountA, _amountB);
        }
        // when amountA and amountB match current ratio
        uint256 ratio = (amountA * PRECISION) / amountB;
        uint256 neededB = (_amountA * PRECISION) / ratio;
        if (neededB <= _amountB) {
            return (_amountA, neededB);
        }
        // amountB not enough to cover amountA -> calculate needed amountA base on amountB
        uint256 neededA = (_amountB * ratio) / PRECISION;
        return (neededA, _amountB);
    }

    //
    function _getUserDepositedAmount() private view returns (uint256, uint256) {
        uint256 currentLp = balanceOf(msg.sender);
        uint256 depositedA = (currentLp * PRECISION) / REWARD_PER_TOKEN_A;
        return _prepareAmount(depositedA, amountB);
    }

    //
    function _calculateLPAmount(uint256 _amountA)
        private
        view
        returns (uint256)
    {
        return (_amountA * REWARD_PER_TOKEN_A) / PRECISION;
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
}
