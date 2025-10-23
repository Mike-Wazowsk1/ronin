// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import {RoninNftBridge} from "contracts/RoninNftBridge.sol";
import {MockERC1155} from "contracts/mocks/MockERC1155.sol";
import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

/**
 * @title RoninNftBridge Quote Test
 * @notice Tests for quote1155 and fee calculations
 */
contract RoninNftBridgeQuoteTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 private constant EID_A = 1;
    uint32 private constant EID_B = 2;

    RoninNftBridge private aBridge;
    RoninNftBridge private bBridge;
    MockERC1155 private nft;

    address private owner = address(this);
    address private alice = address(0xA11CE);

    uint256 private constant NFT_ID = 1;

    function setUp() public virtual override {
        vm.deal(alice, 1000 ether);

        super.setUp();
        setUpEndpoints(2, LibraryType.UltraLightNode);

        nft = new MockERC1155();

        aBridge = RoninNftBridge(
            _deployOApp(
                type(RoninNftBridge).creationCode,
                abi.encode(address(endpoints[EID_A]), address(nft), owner)
            )
        );

        bBridge = RoninNftBridge(
            _deployOApp(
                type(RoninNftBridge).creationCode,
                abi.encode(address(endpoints[EID_B]), address(nft), owner)
            )
        );

        address[] memory oapps = new address[](2);
        oapps[0] = address(aBridge);
        oapps[1] = address(bBridge);
        this.wireOApps(oapps);

        nft.mint(alice, NFT_ID, 100);
        nft.mint(address(bBridge), NFT_ID, 1000);
    }

    function _options(uint128 gas) private pure returns (bytes memory) {
        return OptionsBuilder.newOptions().addExecutorLzReceiveOption(gas, 0);
    }

    function test_quote_returns_valid_fee() public {
        bytes memory options = _options(200000);

        MessagingFee memory fee = aBridge.quote1155(EID_B, addressToBytes32(alice), NFT_ID, 10, options, false);

        assertTrue(fee.nativeFee > 0);
        assertEq(fee.lzTokenFee, 0);
    }

    function test_send_with_exact_quote_fee() public {
        bytes memory options = _options(200000);

        MessagingFee memory fee = aBridge.quote1155(EID_B, addressToBytes32(alice), NFT_ID, 10, options, false);

        vm.prank(alice);
        nft.setApprovalForAll(address(aBridge), true);

        vm.prank(alice);
        aBridge.send1155{value: fee.nativeFee}(EID_B, addressToBytes32(alice), NFT_ID, 10, options);

        verifyPackets(EID_B, addressToBytes32(address(bBridge)));

        assertEq(nft.balanceOf(alice, NFT_ID), 100);
    }

    function test_quote_with_larger_gas() public {
        bytes memory smallOptions = _options(100000);
        bytes memory largeOptions = _options(500000);

        MessagingFee memory smallFee = aBridge.quote1155(EID_B, addressToBytes32(alice), NFT_ID, 10, smallOptions, false);
        MessagingFee memory largeFee = aBridge.quote1155(EID_B, addressToBytes32(alice), NFT_ID, 10, largeOptions, false);

        assertTrue(largeFee.nativeFee > smallFee.nativeFee);
    }

    function test_send_reverts_with_insufficient_fee() public {
        bytes memory options = _options(200000);

        MessagingFee memory fee = aBridge.quote1155(EID_B, addressToBytes32(alice), NFT_ID, 10, options, false);

        vm.prank(alice);
        nft.setApprovalForAll(address(aBridge), true);

        vm.prank(alice);
        vm.expectRevert();
        aBridge.send1155{value: fee.nativeFee / 2}(EID_B, addressToBytes32(alice), NFT_ID, 10, options);
    }

    function test_quote_same_for_different_amounts() public {
        bytes memory options = _options(200000);

        MessagingFee memory fee1 = aBridge.quote1155(EID_B, addressToBytes32(alice), NFT_ID, 1, options, false);
        MessagingFee memory fee100 = aBridge.quote1155(EID_B, addressToBytes32(alice), NFT_ID, 100, options, false);

        assertEq(fee1.nativeFee, fee100.nativeFee);
    }
}
