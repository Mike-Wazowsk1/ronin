// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SevenSevenBit} from "../77bit/SevenSevenBit.sol";

contract SevenSevenBitMock is SevenSevenBit {
    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        if (tokenId != 0) {
            return "https://uri-from-v2/";
        }
        return "error id is zero";
    }
}
