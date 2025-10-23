// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../77bit/SevenSevenBit.sol";

contract RagnarokTransform is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    SevenSevenBit public sevenSevenBitContract;
    IERC1155 public roninContract;
    IERC1155 public sldChipContract;
    uint256 public royaltyFee;
    address public royaltyReceiver;

    event ArtUpgrade(address indexed sender, uint256[] tokenIDs);

    event SetRoyaltyFee(uint256 newRoyaltyFee);
    event RoyaltyFeePaid(address indexed sender, uint256 amount);

    event ReRoll( // 0 if no chip is used for token with the same index
    address indexed sender, uint256[] tokenIDs, uint256[] chipTokenIDs);

    function initialize(
        address _roninContractAddress,
        address _sevenSevenBitAddress,
        address _sldChipContractAddress,
        uint256 _royaltyFee,
        address _royaltyReceiver
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        sevenSevenBitContract = SevenSevenBit(_sevenSevenBitAddress);
        roninContract = ERC1155Pausable(_roninContractAddress);
        sldChipContract = ERC1155(_sldChipContractAddress);
        royaltyFee = _royaltyFee;
        royaltyReceiver = _royaltyReceiver;
    }

    function artUpgrade(uint256[] calldata tokenIDs) public payable nonReentrant {
        require(msg.value >= royaltyFee, "Not enough ETH to pay royalty fee");
        _payRoyaltyFee();

        uint256 quantity;
        uint256[] memory amounts = new uint256[](tokenIDs.length);
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < tokenIDs.length; i++) {
            uint256 value = roninContract.balanceOf(msg.sender, tokenIDs[i]);
            require(value > 0, "Not enough token balance");
            amounts[i] = value; // burn all balance of tokenIDs
            quantity += value;
            totalAmount += value;
        }

        // burn all old tokens assuming that the user has approved the contract to transfer them
        roninContract.safeBatchTransferFrom(msg.sender, BURN_ADDRESS, tokenIDs, amounts, "");

        sevenSevenBitContract.safeMint(msg.sender, totalAmount);

        emit ArtUpgrade(msg.sender, tokenIDs);
    }

    /**
     * @notice Re-roll the tokenIDs with the given sldChipIDs
     * @param tokenIDs The tokenIDs to re-roll
     * @param chipTokenIDs The sldChipIDs to use for re-roll.
     *         Pass 0 if you don't want to use any chip for the corresponding tokenID
     */
    function reRoll(uint256[] calldata tokenIDs, uint256[] calldata chipTokenIDs) public {
        require(tokenIDs.length == chipTokenIDs.length, "Arrays must be of equal length");

        uint256[] memory amounts = new uint256[](tokenIDs.length);

        uint32 chipIdsAmountToBurn = 0;
        for (uint256 i = 0; i < tokenIDs.length; i++) {
            require(sevenSevenBitContract.ownerOf(tokenIDs[i]) == msg.sender, "Sender must own token");
            amounts[i] = 1;
            if (chipTokenIDs[i] == 0) {
                continue;
            }
            chipIdsAmountToBurn++;
            require(IERC1155(sldChipContract).balanceOf(msg.sender, chipTokenIDs[i]) >= 1, "Insufficient chip balance");
        }

        if (chipIdsAmountToBurn > 0) {
            uint256[] memory chipTokenIDsToBurn = new uint256[](chipIdsAmountToBurn);
            uint256[] memory chipAmountsToBurn = new uint256[](chipIdsAmountToBurn);
            uint32 j = 0;
            for (uint256 i = 0; i < tokenIDs.length; i++) {
                if (chipTokenIDs[i] == 0) {
                    continue;
                }
                chipTokenIDsToBurn[j] = chipTokenIDs[i];
                chipAmountsToBurn[j] = 1;
                j++;
            }

            sldChipContract.safeBatchTransferFrom(msg.sender, owner(), chipTokenIDsToBurn, chipAmountsToBurn, "");
        }

        emit ReRoll(msg.sender, tokenIDs, chipTokenIDs);
    }

    function _payRoyaltyFee() internal {
        if (royaltyFee > 0) {
            payable(royaltyReceiver).transfer(royaltyFee);
            emit RoyaltyFeePaid(msg.sender, royaltyFee);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal view override onlyOwner {}

    function setRagnarokAddress(address _roninContractAddress) public onlyOwner {
        roninContract = IERC1155(_roninContractAddress);
    }

    function setSldChipAddress(address _sldChipContractAddress) public onlyOwner {
        sldChipContract = IERC1155(_sldChipContractAddress);
    }

    function setSevenSevenBitAddress(address _sevenSevenBitAddress) public onlyOwner {
        sevenSevenBitContract = SevenSevenBit(_sevenSevenBitAddress);
    }

    function setRoyaltyFee(uint256 _royaltyFee) public onlyOwner {
        royaltyFee = _royaltyFee;
        emit SetRoyaltyFee(_royaltyFee);
    }

    function setRoyaltyReceiver(address _royaltyReceiver) public onlyOwner {
        royaltyReceiver = _royaltyReceiver;
    }
}
