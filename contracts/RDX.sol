// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./ERC20.sol";

contract RDX is ERC20 {
    constructor(uint8 tokenDecimals, uint256 totalSupply)
        ERC20("RDX token", "RDX", tokenDecimals)
    {
        _totalSupply = totalSupply;
        _balances[msg.sender] = totalSupply;
    }
}
