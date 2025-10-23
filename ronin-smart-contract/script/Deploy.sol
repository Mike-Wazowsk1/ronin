// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SevenSevenBit} from "../src/77bit/SevenSevenBit.sol";
import {ONFTSevenSevenBit} from "../src/77bit-layerzero/ONFTSevenSevenBit.sol";
import {ONFTSevenSevenBitProxy} from "../src/77bit-layerzero/ONFTSevenSevenBitProxy.sol";
import {RagnarokTransform} from "../src/transform/RagnarokTransform.sol";
import {RagnarokMock} from "../src/mock/RagnarokMock.sol";
import {SecureLiquidDigitalChipMock} from "../src/mock/SecureLiquidDigitalChipMock.sol";
import {SevenSevenBitMock} from "../src/mock/SevenSevenBitMock.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployScript is Script {
    function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
    }

    function run() public {
        console.log("Starting deployment of all contracts...");

        // Deploy RagnarokTransform
        address roninAddress = vm.envAddress("RONIN_CONTRACT_ADDRESS");
        address sldChipAddress = vm.envAddress("SLD_CHIP_CONTRACT_ADDRESS");
        address sevenSevenBitAddress = vm.envAddress("SEVEN_SEVEN_BIT_ADDRESS");
        uint256 royaltyFee = vm.envUint("ROYALTY_FEE");
        address royaltyReceiver = vm.envAddress("ROYALTY_RECEIVER");

        RagnarokTransform transformImplementation = new RagnarokTransform();
        console.log("RagnarokTransform implementation:", address(transformImplementation));

        bytes memory transformInitData = abi.encodeWithSelector(
            RagnarokTransform.initialize.selector,
            roninAddress,
           sevenSevenBitAddress,
            sldChipAddress,
            royaltyFee,
            royaltyReceiver
        );

        ERC1967Proxy transformProxy = new ERC1967Proxy(address(transformImplementation), transformInitData);
        RagnarokTransform transformContract = RagnarokTransform(address(transformProxy));
        console.log("RagnarokTransform proxy:", address(transformContract));

        vm.stopBroadcast();
        console.log("Deployment completed!");

        // Save deployment addresses
        console.log("=== DEPLOYMENT ADDRESSES ===");
        console.log("RagnarokTransform Implementation:", address(transformImplementation));
        console.log("RagnarokTransform Proxy:", address(transformContract));
        console.log("Ronin:", address(roninAddress));
        console.log("SLD Chip:", address(sldChipAddress));
        console.log("SevenSevenBit:", address(sevenSevenBitAddress));
        console.log("=== END DEPLOYMENT ADDRESSES ===");
    }
}
