// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;
import "./ERC20.sol";

contract RDX is ERC20 {
    constructor(
        uint8 tokenDecimals,
        uint256 tokenMaxTotalSupply
    ) ERC20("RDX token", "RDX", tokenDecimals, tokenMaxTotalSupply) {
        _mint(msg.sender, _maxTotalSupply);
    }
}
