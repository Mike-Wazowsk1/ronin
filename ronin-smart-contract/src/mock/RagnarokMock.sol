// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RagnarokMock is ERC1155Pausable, Ownable {
    string public constant NAME = "Ragnarok";
    string public constant SYMBOL = "RONIN";

    constructor() ERC1155("token-uri") Ownable(msg.sender) {}

    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    function mint(address to, uint256 tokenId, uint256 amount) public {
        _mint(to, tokenId, amount, "");
    }
}
