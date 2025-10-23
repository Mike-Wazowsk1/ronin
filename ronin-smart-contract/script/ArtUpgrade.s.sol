// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {RagnarokTransform} from "../src/transform/RagnarokTransform.sol";

contract ArtUpgradeScript is Script {
        function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
    }
    function run() external {
        address transform = vm.envAddress("TRANSFORM_CONTRACT_ADDRESS");
        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = vm.envUint("ART_UPGRADE_TOKEN_ID");
        uint256 royaltyFee = vm.envUint("ROYALTY_FEE");

        RagnarokTransform(transform).artUpgrade{value: royaltyFee}(tokenIDs);
        vm.stopBroadcast();
    }
} 