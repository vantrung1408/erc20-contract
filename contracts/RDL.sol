// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./ERC20.sol";

contract RDL is ERC20 {
    constructor(uint8 tokenDecimals) ERC20("RDL token", "RDL", tokenDecimals) {}

    /**
    deposit _value of balance to _to
     */
    function mint(uint256 value) public returns (bool success) {
        require(
            value + _totalSupply <= type(uint256).max,
            "Value to mint not valid"
        );

        _totalSupply += value;
        _balances[msg.sender] += value;
        emit Transfer(address(0), msg.sender, value);
        return true;
    }
}
