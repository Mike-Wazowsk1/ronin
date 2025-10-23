// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "../layerzero/ProxyONFT721.sol";

contract ONFTSevenSevenBitProxy is ProxyONFT721 {
    address public proxyToken;

    constructor(
        uint256 _minGasToTransfer,
        address _lzEndpoint,
        address _proxyToken // proxy 77bit contract address
    ) ProxyONFT721(_minGasToTransfer, _lzEndpoint, _proxyToken) {
        proxyToken = _proxyToken;
    }

    function proxyTokenAddress() public view returns (address) {
        return proxyToken;
    }
}
