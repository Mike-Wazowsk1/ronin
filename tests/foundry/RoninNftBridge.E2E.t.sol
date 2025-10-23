// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import {RoninNftBridge} from "contracts/RoninNftBridge.sol";
import {MockERC1155} from "contracts/mocks/MockERC1155.sol";
import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

/**
 * @title RoninNftBridge E2E Test
 * @notice End-to-end tests for EVM to EVM NFT transfers via LayerZero
 */
contract RoninNftBridgeE2ETest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 private constant EID_SEPOLIA = 1;
    uint32 private constant EID_OPTIMISM = 2;

    uint256 private constant NFT_ID_1 = 1;
    uint256 private constant NFT_ID_2 = 2;
    uint256 private constant NFT_ID_3 = 3;

    RoninNftBridge private sepoliaBridge;
    RoninNftBridge private optimismBridge;
    MockERC1155 private nft;

    address private owner = address(this);
    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);

    function setUp() public virtual override {
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);

        super.setUp();
        setUpEndpoints(2, LibraryType.UltraLightNode);

        nft = new MockERC1155();

        sepoliaBridge = RoninNftBridge(
            _deployOApp(
                type(RoninNftBridge).creationCode,
                abi.encode(address(endpoints[EID_SEPOLIA]), address(nft), owner)
            )
        );

        optimismBridge = RoninNftBridge(
            _deployOApp(
                type(RoninNftBridge).creationCode,
                abi.encode(address(endpoints[EID_OPTIMISM]), address(nft), owner)
            )
        );

        address[] memory oapps = new address[](2);
        oapps[0] = address(sepoliaBridge);
        oapps[1] = address(optimismBridge);
        this.wireOApps(oapps);
    }

    function _options(uint128 gas) private pure returns (bytes memory) {
        return OptionsBuilder.newOptions().addExecutorLzReceiveOption(gas, 0);
    }

    function test_send_from_sepolia_to_optimism() public {
        uint256 tokenId = NFT_ID_1;

        nft.mint(alice, tokenId, 1);
        nft.mint(address(optimismBridge), tokenId, 1);

        vm.prank(alice);
        nft.setApprovalForAll(address(sepoliaBridge), true);

        bytes memory options = _options(200000);
        MessagingFee memory fee = sepoliaBridge.quote1155(
            EID_OPTIMISM,
            addressToBytes32(bob),
            tokenId,
            1,
            options,
            false
        );

        vm.prank(alice);
        sepoliaBridge.send1155{value: fee.nativeFee}(
            EID_OPTIMISM,
            addressToBytes32(bob),
            tokenId,
            1,
            options
        );

        assertEq(nft.balanceOf(alice, tokenId), 0);
        assertEq(nft.balanceOf(address(sepoliaBridge), tokenId), 1);

        verifyPackets(EID_OPTIMISM, addressToBytes32(address(optimismBridge)));

        assertEq(nft.balanceOf(bob, tokenId), 1);
        assertEq(nft.balanceOf(address(optimismBridge), tokenId), 0);
    }

    function test_send_from_optimism_to_sepolia() public {
        uint256 tokenId = NFT_ID_2;

        nft.mint(alice, tokenId, 1);
        nft.mint(address(optimismBridge), tokenId, 1);
        nft.mint(address(sepoliaBridge), tokenId, 1);

        vm.prank(alice);
        nft.setApprovalForAll(address(sepoliaBridge), true);

        bytes memory options = _options(200000);

        MessagingFee memory feeAB = sepoliaBridge.quote1155(
            EID_OPTIMISM,
            addressToBytes32(bob),
            tokenId,
            1,
            options,
            false
        );

        vm.prank(alice);
        sepoliaBridge.send1155{value: feeAB.nativeFee}(EID_OPTIMISM, addressToBytes32(bob), tokenId, 1, options);
        verifyPackets(EID_OPTIMISM, addressToBytes32(address(optimismBridge)));

        assertEq(nft.balanceOf(bob, tokenId), 1);

        vm.prank(bob);
        nft.setApprovalForAll(address(optimismBridge), true);

        MessagingFee memory feeBA = optimismBridge.quote1155(
            EID_SEPOLIA,
            addressToBytes32(alice),
            tokenId,
            1,
            options,
            false
        );

        vm.prank(bob);
        optimismBridge.send1155{value: feeBA.nativeFee}(EID_SEPOLIA, addressToBytes32(alice), tokenId, 1, options);
        verifyPackets(EID_SEPOLIA, addressToBytes32(address(sepoliaBridge)));

        assertEq(nft.balanceOf(alice, tokenId), 1);
    }

    function test_send_nft_3() public {
        uint256 tokenId = NFT_ID_3;

        nft.mint(alice, tokenId, 1);
        nft.mint(address(optimismBridge), tokenId, 1);

        vm.prank(alice);
        nft.setApprovalForAll(address(sepoliaBridge), true);

        bytes memory options = _options(200000);
        MessagingFee memory fee = sepoliaBridge.quote1155(
            EID_OPTIMISM,
            addressToBytes32(bob),
            tokenId,
            1,
            options,
            false
        );

        vm.prank(alice);
        sepoliaBridge.send1155{value: fee.nativeFee}(
            EID_OPTIMISM,
            addressToBytes32(bob),
            tokenId,
            1,
            options
        );

        verifyPackets(EID_OPTIMISM, addressToBytes32(address(optimismBridge)));

        assertEq(nft.balanceOf(bob, tokenId), 1);
        assertEq(nft.balanceOf(address(sepoliaBridge), tokenId), 1);
        assertEq(nft.balanceOf(address(optimismBridge), tokenId), 0);
    }
}
