// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/transform/RagnarokTransform.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../src/77bit/SevenSevenBit.sol";

// Мок контракты для тестирования
contract MockSevenSevenBit is ERC721 {
    address public minter;
    uint256 private _nextId;

    constructor() ERC721("SevenSevenBit", "77BIT") {}

    function setMinter(address _minter) external {
        minter = _minter;
    }

    function safeMint(address to, uint256 quantity) external {
        require(msg.sender == minter, "Only minter can mint");
        for (uint256 i = 0; i < quantity; i++) {
            _mint(to, _nextTokenId());
            _nextId++;
        }
    }

    function _nextTokenId() internal view returns (uint256) {
        return _nextId;
    }
}

contract MockRoninContract is ERC1155Pausable {
    constructor() ERC1155("") {}

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }
}

contract MockSLDChipContract is ERC1155Pausable {
    constructor() ERC1155("") {}

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }
}

contract RagnarokTransformTest is Test {
    RagnarokTransform public transformContract;
    MockSevenSevenBit public sevenSevenBit;
    MockRoninContract public roninContract;
    MockSLDChipContract public sldChipContract;

    address public owner = address(0x1);
    address public user = address(0x2);
    address public royaltyReceiver = address(0x3);
    address public newRoyaltyReceiver = address(0x4);

    uint256 public royaltyFee = 0.01 ether;
    uint256 public newRoyaltyFee = 0.02 ether;

    event ArtUpgrade(address indexed sender, uint256[] tokenIDs);
    event SetRoyaltyFee(uint256 newRoyaltyFee);
    event RoyaltyFeePaid(address indexed sender, uint256 amount);
    event ReRoll(address indexed sender, uint256[] tokenIDs, uint256[] chipTokenIDs);

    function setUp() public {
        // Развертываем мок контракты
        sevenSevenBit = new MockSevenSevenBit();
        roninContract = new MockRoninContract();
        sldChipContract = new MockSLDChipContract();

        // Деплой и инициализация RagnarokTransform под owner
        vm.startPrank(owner);
        RagnarokTransform implementation = new RagnarokTransform();
        bytes memory initData = abi.encodeWithSelector(
            RagnarokTransform.initialize.selector,
            address(roninContract),
            address(sevenSevenBit),
            address(sldChipContract),
            royaltyFee,
            royaltyReceiver
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        transformContract = RagnarokTransform(address(proxy));
        vm.stopPrank();

        // Настраиваем права минтера
        sevenSevenBit.setMinter(address(transformContract));

        // Минтим токены пользователю для тестирования
        roninContract.mint(user, 1, 5);
        roninContract.mint(user, 2, 3);
        sldChipContract.mint(user, 1, 10);
        sldChipContract.mint(user, 2, 5);

        // Даем разрешения
        vm.startPrank(user);
        roninContract.setApprovalForAll(address(transformContract), true);
        sldChipContract.setApprovalForAll(address(transformContract), true);
        vm.stopPrank();
    }

    // Тесты инициализации royalty
    function test_InitializeRoyaltySettings() public {
        assertEq(transformContract.royaltyFee(), royaltyFee);
        assertEq(transformContract.royaltyReceiver(), royaltyReceiver);
    }

    // Тесты функции artUpgrade с royalty
    function test_ArtUpgradeWithRoyaltyFee() public {
        vm.deal(user, 1 ether);
        uint256[] memory tokenIDs = new uint256[](2);
        tokenIDs[0] = 1;
        tokenIDs[1] = 2;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);
        roninContract.mint(user, 2, 3);

        uint256 userBalanceBefore = user.balance;
        uint256 royaltyReceiverBalanceBefore = royaltyReceiver.balance;
        uint256 contractBalanceBefore = address(transformContract).balance;

        vm.startPrank(user);
        transformContract.artUpgrade{value: royaltyFee}(tokenIDs);
        vm.stopPrank();

        // Проверяем, что royalty fee была отправлена
        assertEq(royaltyReceiver.balance, royaltyReceiverBalanceBefore + royaltyFee);
        assertEq(user.balance, userBalanceBefore - royaltyFee);
        assertEq(address(transformContract).balance, contractBalanceBefore);
    }

    function test_ArtUpgradeWithInsufficientRoyaltyFee() public {
        vm.deal(user, 1 ether);
        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = 1;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);

        vm.startPrank(user);
        vm.expectRevert(bytes("Not enough ETH to pay royalty fee"));
        transformContract.artUpgrade{value: royaltyFee - 0.001 ether}(tokenIDs);
        vm.stopPrank();
    }

    function test_ArtUpgradeWithZeroRoyaltyFee() public {
        vm.deal(user, 1 ether);
        // Устанавливаем нулевую royalty fee
        vm.startPrank(owner);
        transformContract.setRoyaltyFee(0);
        vm.stopPrank();

        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = 1;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);

        uint256 userBalanceBefore = user.balance;
        uint256 royaltyReceiverBalanceBefore = royaltyReceiver.balance;

        vm.startPrank(user);
        transformContract.artUpgrade{value: 0}(tokenIDs);
        vm.stopPrank();

        // Проверяем, что royalty fee не была отправлена
        assertEq(royaltyReceiver.balance, royaltyReceiverBalanceBefore);
        assertEq(user.balance, userBalanceBefore);
    }

    function test_ArtUpgradeWithExcessValue() public {
        vm.deal(user, 1 ether);
        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = 1;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);

        uint256 excessValue = 0.005 ether;
        uint256 totalValue = royaltyFee + excessValue;

        uint256 userBalanceBefore = user.balance;
        uint256 royaltyReceiverBalanceBefore = royaltyReceiver.balance;
        uint256 contractBalanceBefore = address(transformContract).balance;

        vm.startPrank(user);
        transformContract.artUpgrade{value: totalValue}(tokenIDs);
        vm.stopPrank();

        // Проверяем, что только royalty fee была отправлена, избыток остался на контракте
        assertEq(royaltyReceiver.balance, royaltyReceiverBalanceBefore + royaltyFee);
        assertEq(user.balance, userBalanceBefore - totalValue);
        assertEq(address(transformContract).balance, contractBalanceBefore + excessValue);
    }

    // Тесты функции setRoyaltyFee
    function test_SetRoyaltyFee() public {
        vm.startPrank(owner);
        vm.expectEmit(true, false, false, true);
        emit SetRoyaltyFee(newRoyaltyFee);
        transformContract.setRoyaltyFee(newRoyaltyFee);
        vm.stopPrank();

        assertEq(transformContract.royaltyFee(), newRoyaltyFee);
    }

    function test_SetRoyaltyFeeByNonOwner() public {
        vm.startPrank(user);
        vm.expectRevert();
        transformContract.setRoyaltyFee(newRoyaltyFee);
        vm.stopPrank();

        assertEq(transformContract.royaltyFee(), royaltyFee);
    }

    // Тесты функции setRoyaltyReceiver
    function test_SetRoyaltyReceiver() public {
        vm.startPrank(owner);
        transformContract.setRoyaltyReceiver(newRoyaltyReceiver);
        vm.stopPrank();

        assertEq(transformContract.royaltyReceiver(), newRoyaltyReceiver);
    }

    function test_SetRoyaltyReceiverByNonOwner() public {
        vm.startPrank(user);
        vm.expectRevert();
        transformContract.setRoyaltyReceiver(newRoyaltyReceiver);
        vm.stopPrank();

        assertEq(transformContract.royaltyReceiver(), royaltyReceiver);
    }

    // Тест обновления royalty receiver и проверка платежей
    function test_ArtUpgradeAfterRoyaltyReceiverChange() public {
        vm.deal(user, 1 ether);
        // Меняем royalty receiver
        vm.startPrank(owner);
        transformContract.setRoyaltyReceiver(newRoyaltyReceiver);
        vm.stopPrank();

        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = 1;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);

        uint256 newReceiverBalanceBefore = newRoyaltyReceiver.balance;

        vm.startPrank(user);
        transformContract.artUpgrade{value: royaltyFee}(tokenIDs);
        vm.stopPrank();

        // Проверяем, что royalty fee была отправлена новому receiver
        assertEq(newRoyaltyReceiver.balance, newReceiverBalanceBefore + royaltyFee);
    }

    // Тест обновления royalty fee и проверка платежей
    function test_ArtUpgradeAfterRoyaltyFeeChange() public {
        vm.deal(user, 1 ether);
        // Меняем royalty fee
        vm.startPrank(owner);
        transformContract.setRoyaltyFee(newRoyaltyFee);
        vm.stopPrank();

        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = 1;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);

        uint256 royaltyReceiverBalanceBefore = royaltyReceiver.balance;

        vm.startPrank(user);
        transformContract.artUpgrade{value: newRoyaltyFee}(tokenIDs);
        vm.stopPrank();

        // Проверяем, что новая royalty fee была отправлена
        assertEq(royaltyReceiver.balance, royaltyReceiverBalanceBefore + newRoyaltyFee);
    }

    // Тест события RoyaltyFeePaid
    function test_RoyaltyFeePaidEvent() public {
        vm.deal(user, 1 ether);
        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = 1;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);

        vm.startPrank(user);
        vm.expectEmit(true, false, false, true);
        emit RoyaltyFeePaid(user, royaltyFee);
        transformContract.artUpgrade{value: royaltyFee}(tokenIDs);
        vm.stopPrank();
    }

    // Тест функции reRoll (не должна требовать royalty fee)
    function test_ReRollDoesNotRequireRoyaltyFee() public {
        vm.deal(user, 1 ether);
        // Сначала выполняем artUpgrade для получения 77bit токенов
        uint256[] memory upgradeTokenIDs = new uint256[](1);
        upgradeTokenIDs[0] = 1;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);

        vm.startPrank(user);
        transformContract.artUpgrade{value: royaltyFee}(upgradeTokenIDs);
        vm.stopPrank();

        // Теперь тестируем reRoll без royalty fee
        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = 0; // Первый минтированный 77bit токен

        uint256[] memory chipTokenIDs = new uint256[](1);
        chipTokenIDs[0] = 1;

        uint256 userBalanceBefore = user.balance;
        uint256 royaltyReceiverBalanceBefore = royaltyReceiver.balance;

        vm.startPrank(user);
        transformContract.reRoll(tokenIDs, chipTokenIDs);
        vm.stopPrank();

        // Проверяем, что балансы не изменились (нет royalty fee)
        assertEq(user.balance, userBalanceBefore);
        assertEq(royaltyReceiver.balance, royaltyReceiverBalanceBefore);
    }

    // Тест граничных случаев
    function test_ArtUpgradeWithMaximumRoyaltyFee() public {
        vm.deal(user, type(uint256).max);
        uint256 maxRoyaltyFee = type(uint256).max;

        vm.startPrank(owner);
        transformContract.setRoyaltyFee(maxRoyaltyFee);
        vm.stopPrank();

        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = 1;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);

        vm.startPrank(user);
        vm.expectRevert(bytes("Not enough ETH to pay royalty fee"));
        transformContract.artUpgrade{value: maxRoyaltyFee - 1}(tokenIDs);
        vm.stopPrank();
    }

    // Тест с нулевым адресом royalty receiver
    function test_SetZeroAddressAsRoyaltyReceiver() public {
        vm.deal(user, 1 ether);
        vm.startPrank(owner);
        transformContract.setRoyaltyReceiver(address(0));
        vm.stopPrank();

        assertEq(transformContract.royaltyReceiver(), address(0));

        // Тестируем artUpgrade с нулевым receiver
        uint256[] memory tokenIDs = new uint256[](1);
        tokenIDs[0] = 1;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);

        vm.startPrank(user);
        transformContract.artUpgrade{value: royaltyFee}(tokenIDs);
        vm.stopPrank();

        // Проверяем, что ETH был отправлен на нулевой адрес (сожжён)
        assertEq(address(0).balance, royaltyFee);
    }

    // Тест множественных artUpgrade операций
    function test_MultipleArtUpgradeOperations() public {
        vm.deal(user, 1 ether);
        uint256[] memory tokenIDs1 = new uint256[](1);
        tokenIDs1[0] = 1;

        uint256[] memory tokenIDs2 = new uint256[](1);
        tokenIDs2[0] = 2;

        // Минтим токены заново, чтобы у пользователя был баланс
        roninContract.mint(user, 1, 5);
        roninContract.mint(user, 2, 5);

        uint256 royaltyReceiverBalanceBefore = royaltyReceiver.balance;

        vm.startPrank(user);
        transformContract.artUpgrade{value: royaltyFee}(tokenIDs1);
        transformContract.artUpgrade{value: royaltyFee}(tokenIDs2);
        vm.stopPrank();

        // Проверяем, что royalty fee была отправлена дважды
        assertEq(royaltyReceiver.balance, royaltyReceiverBalanceBefore + (royaltyFee * 2));
    }
}
