// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "../layerzero/ONFT721.sol";

contract ONFTSevenSevenBit is ONFT721 {
    string private _baseTokenURI;

    constructor(uint256 _minGasToTransfer, address _lzEndpoint)
        ONFT721("77bit", "77BIT", _minGasToTransfer, _lzEndpoint)
    {}

    // Sets the base token URI for the contract
    function setBaseTokenURI(string memory newBaseTokenURI) public onlyOwner {
        _baseTokenURI = newBaseTokenURI;
    }

    // Returns the URI for a given token ID
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        string memory baseURI = _baseTokenURI;
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, Strings.toString(tokenId))) : "";
    }

    function baseTokenURI() public view returns (string memory) {
        return _baseTokenURI;
    }
}
