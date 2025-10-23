// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {RagnarokMock} from "../src/mock/RagnarokMock.sol";
import {SevenSevenBit} from "../src/77bit/SevenSevenBit.sol";
import {SecureLiquidDigitalChipMock} from "../src/mock/SecureLiquidDigitalChipMock.sol";


contract MintAndApproveScript is Script {
    function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
    }
    function run() external {
        address ronin = vm.envAddress("RONIN_CONTRACT_ADDRESS");
        address user = vm.envAddress("OWNER_ADDRESS");
        address transform = vm.envAddress("TRANSFORM_CONTRACT_ADDRESS");
        uint256 tokenId = vm.envUint("ART_UPGRADE_TOKEN_ID");
        uint256 amount = vm.envUint("MINT_AMOUNT");
        address sevenSevenBit = vm.envAddress("SEVEN_SEVEN_BIT_ADDRESS");
        address sldChip = vm.envAddress("SLD_CHIP_CONTRACT_ADDRESS");

        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = tokenId;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        address[] memory users = new address[](1);
        users[0] = user;

        RagnarokMock(ronin).mint(user, tokenId, amount);
        SecureLiquidDigitalChipMock(sldChip).addMinter(transform);
        SecureLiquidDigitalChipMock(sldChip).addMinter(user);
        SecureLiquidDigitalChipMock(sldChip).mint(users, tokenIDs, amounts);
        SevenSevenBit(sevenSevenBit).addMinter(transform);
        RagnarokMock(ronin).setApprovalForAll(transform, true);
        vm.stopBroadcast();
    }
} 