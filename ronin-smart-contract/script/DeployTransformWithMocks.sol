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

        // Deploy SevenSevenBit
        address owner = vm.envAddress("OWNER_ADDRESS");
        string memory baseTokenURI = vm.envString("SEVEN_SEVEN_BIT_URI");

        SevenSevenBit implementation = new SevenSevenBit();
        console.log("SevenSevenBit Implementation:", address(implementation));

        bytes memory initData = abi.encodeWithSelector(SevenSevenBit.initialize.selector, owner, baseTokenURI);

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        SevenSevenBit sevenSevenBit = SevenSevenBit(address(proxy));
        console.log("SevenSevenBit Proxy:", address(sevenSevenBit));


        // Deploy mock contracts for testing
        RagnarokMock ragnarokMock = new RagnarokMock();
        console.log("RagnarokMock:", address(ragnarokMock));

        SecureLiquidDigitalChipMock sldChipMock = new SecureLiquidDigitalChipMock("https://example.com/sld-chip/");
        console.log("SecureLiquidDigitalChipMock:", address(sldChipMock));

        // Deploy RagnarokTransform
        address roninAddress =  address(ragnarokMock);
        address sldChipAddress = address(sldChipMock);
        uint256 royaltyFee = vm.envUint("ROYALTY_FEE");
        address royaltyReceiver = vm.envAddress("ROYALTY_RECEIVER");

        RagnarokTransform transformImplementation = new RagnarokTransform();
        console.log("RagnarokTransform implementation:", address(transformImplementation));

        bytes memory transformInitData = abi.encodeWithSelector(
            RagnarokTransform.initialize.selector,
            roninAddress,
            address(sevenSevenBit),
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
        console.log("RagnarokMock:", address(ragnarokMock));
        console.log("SecureLiquidDigitalChipMock:", address(sldChipMock));
        console.log("SevenSevenBit:", address(sevenSevenBit));
        console.log("=== END DEPLOYMENT ADDRESSES ===");
    }
}
