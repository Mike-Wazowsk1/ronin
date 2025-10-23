// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {SevenSevenBit} from "../src/77bit/SevenSevenBit.sol";
import {SevenSevenBitMock} from "../src/mock/SevenSevenBitMock.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract SevenSevenBitTest is Test {
    SevenSevenBit public implementation;
    ERC1967Proxy public proxy;
    SevenSevenBit public sevenSevenBit;

    address public owner;
    address public user;
    address public user2;

    string public constant baseTokenURI = "https://example.com/";

    function setUp() public {
        owner = makeAddr("owner");
        user = makeAddr("user");
        user2 = makeAddr("user2");

        vm.startPrank(owner);

        // Deploy implementation
        implementation = new SevenSevenBit();

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(SevenSevenBit.initialize.selector, owner, baseTokenURI);

        // Deploy proxy
        proxy = new ERC1967Proxy(address(implementation), initData);
        sevenSevenBit = SevenSevenBit(address(proxy));

        vm.stopPrank();
    }

    function test_Deployment() public {
        assertEq(sevenSevenBit.owner(), owner);
        assertEq(sevenSevenBit.baseTokenURI(), baseTokenURI);
    }

    function test_TokenURI() public {
        vm.prank(owner);
        sevenSevenBit.safeMint(user, 2);

        assertEq(sevenSevenBit.tokenURI(1), "https://example.com/1.json");

        vm.prank(owner);
        sevenSevenBit.setBaseTokenURI("https://example2.com/");

        assertEq(sevenSevenBit.tokenURI(1), "https://example2.com/1.json");
    }

    function test_Minting() public {
        vm.prank(owner);
        sevenSevenBit.safeMint(user, 1);

        assertEq(sevenSevenBit.balanceOf(user), 1);
    }

    function test_Upgradeability() public {
        address oldAddress = address(sevenSevenBit);
        assertEq(sevenSevenBit.baseTokenURI(), baseTokenURI);

        // Deploy new implementation
        SevenSevenBitMock newImplementation = new SevenSevenBitMock();

        vm.prank(owner);
        sevenSevenBit.upgradeToAndCall(address(newImplementation), "");

        assertEq(address(sevenSevenBit), oldAddress);
        assertEq(sevenSevenBit.tokenURI(1), "https://uri-from-v2/");
    }

    function test_OnlyOwnerCanMint() public {
        vm.prank(user);
        vm.expectRevert();
        sevenSevenBit.safeMint(user, 1);
    }

    function test_OnlyOwnerCanSetBaseTokenURI() public {
        vm.prank(user);
        vm.expectRevert();
        sevenSevenBit.setBaseTokenURI("https://new-uri.com/");
    }

    function test_OnlyOwnerCanUpgrade() public {
        SevenSevenBitMock newImplementation = new SevenSevenBitMock();

        vm.prank(user);
        vm.expectRevert();
        sevenSevenBit.upgradeToAndCall(address(newImplementation), "");
    }
}
