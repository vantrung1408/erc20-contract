// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./ERC20.sol";

contract RDL is ERC20 {
    constructor(
        uint8 tokenDecimals
    ) ERC20("RDL token", "RDL", tokenDecimals, type(uint256).max) {}

    /**
    deposit value token to target address, every one can trigger this function
     */
    function mint(address to, uint256 value) public returns (bool success) {
        return _mint(to, value);
    }
}
