// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/77bit/SevenSevenBit.sol";
import "../src/77bit-layerzero/ONFTSevenSevenBit.sol";
import "../src/77bit-layerzero/ONFTSevenSevenBitProxy.sol";
import "../src/layerzero/lzApp/mocks/LZEndpointMock.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ONFTSevenSevenBitTest is Test {
    // Мокированные chain ids
    uint16 constant CHAIN_ID_A = 1;
    uint16 constant CHAIN_ID_B = 2;
    uint16 constant CHAIN_ID_C = 3;

    uint256 constant MIN_GAS_TO_STORE = 40000;
    uint256 constant BATCH_SIZE_LIMIT = 1;
    string constant BASE_TOKEN_URI = "https://example.com/token/";
    address constant ADDRESS_ZERO = address(0);

    // Контракты LayerZero endpoints
    LZEndpointMock public lzEndpointMockA;
    LZEndpointMock public lzEndpointMockB;
    LZEndpointMock public lzEndpointMockC;

    // Основные контракты
    SevenSevenBit public sevenSevenBit;
    ONFTSevenSevenBitProxy public onftSevenSevenBitProxyA;
    ONFTSevenSevenBit public onftSevenSevenBitB;
    ONFTSevenSevenBit public onftSevenSevenBitC;

    // Адреса
    address public owner;
    address public user;
    address public user2;

    // Параметры адаптера по умолчанию
    bytes public defaultAdapterParams;

    function setUp() public {
        owner = makeAddr("owner");
        user = makeAddr("user");
        user2 = makeAddr("user2");

        // Создаем параметры адаптера по умолчанию
        defaultAdapterParams = abi.encodePacked(uint16(1), uint256(200000));

        // Развертываем все контракты
        deployContracts();
        configureContracts();
    }

    function deployContracts() internal {
        vm.startPrank(owner);

        // Развертываем LayerZero endpoints
        lzEndpointMockA = new LZEndpointMock(CHAIN_ID_A);
        lzEndpointMockB = new LZEndpointMock(CHAIN_ID_B);
        lzEndpointMockC = new LZEndpointMock(CHAIN_ID_C);

        // Развертываем SevenSevenBit с прокси
        SevenSevenBit implementation = new SevenSevenBit();
        bytes memory initData = abi.encodeWithSelector(
            SevenSevenBit.initialize.selector,
            owner,
            BASE_TOKEN_URI
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        sevenSevenBit = SevenSevenBit(address(proxy));

        // Развертываем ONFT контракты
        onftSevenSevenBitProxyA = new ONFTSevenSevenBitProxy(
            MIN_GAS_TO_STORE,
            address(lzEndpointMockA),
            address(sevenSevenBit)
        );

        onftSevenSevenBitB = new ONFTSevenSevenBit(
            MIN_GAS_TO_STORE,
            address(lzEndpointMockB)
        );

        onftSevenSevenBitC = new ONFTSevenSevenBit(
            MIN_GAS_TO_STORE,
            address(lzEndpointMockC)
        );

        vm.stopPrank();
    }

    function configureContracts() internal {
        vm.startPrank(owner);

        // Получаем адреса всех контрактов
        address addressProxyA = address(onftSevenSevenBitProxyA);
        address addressONFTB = address(onftSevenSevenBitB);
        address addressONFTC = address(onftSevenSevenBitC);

        // Настраиваем LayerZero endpoints для маршрутизации сообщений
        lzEndpointMockA.setDestLzEndpoint(addressONFTB, address(lzEndpointMockB));
        lzEndpointMockA.setDestLzEndpoint(addressONFTC, address(lzEndpointMockC));
        lzEndpointMockB.setDestLzEndpoint(addressProxyA, address(lzEndpointMockA));
        lzEndpointMockB.setDestLzEndpoint(addressONFTC, address(lzEndpointMockC));
        lzEndpointMockC.setDestLzEndpoint(addressProxyA, address(lzEndpointMockA));
        lzEndpointMockC.setDestLzEndpoint(addressONFTB, address(lzEndpointMockB));

        // Настраиваем trusted remote для каждого контракта
        onftSevenSevenBitProxyA.setTrustedRemote(
            CHAIN_ID_B,
            abi.encodePacked(addressONFTB, addressProxyA)
        );
        onftSevenSevenBitProxyA.setTrustedRemote(
            CHAIN_ID_C,
            abi.encodePacked(addressONFTC, addressProxyA)
        );
        onftSevenSevenBitB.setTrustedRemote(
            CHAIN_ID_A,
            abi.encodePacked(addressProxyA, addressONFTB)
        );
        onftSevenSevenBitB.setTrustedRemote(
            CHAIN_ID_C,
            abi.encodePacked(addressONFTC, addressONFTB)
        );
        onftSevenSevenBitC.setTrustedRemote(
            CHAIN_ID_A,
            abi.encodePacked(addressProxyA, addressONFTC)
        );
        onftSevenSevenBitC.setTrustedRemote(
            CHAIN_ID_B,
            abi.encodePacked(addressONFTB, addressONFTC)
        );

        // Настраиваем batch size limit
        onftSevenSevenBitProxyA.setDstChainIdToBatchLimit(CHAIN_ID_B, BATCH_SIZE_LIMIT);
        onftSevenSevenBitProxyA.setDstChainIdToBatchLimit(CHAIN_ID_C, BATCH_SIZE_LIMIT);
        onftSevenSevenBitB.setDstChainIdToBatchLimit(CHAIN_ID_A, BATCH_SIZE_LIMIT);
        onftSevenSevenBitB.setDstChainIdToBatchLimit(CHAIN_ID_C, BATCH_SIZE_LIMIT);
        onftSevenSevenBitC.setDstChainIdToBatchLimit(CHAIN_ID_A, BATCH_SIZE_LIMIT);
        onftSevenSevenBitC.setDstChainIdToBatchLimit(CHAIN_ID_B, BATCH_SIZE_LIMIT);

        // Настраиваем минимальный газ для swap
        onftSevenSevenBitProxyA.setMinDstGas(CHAIN_ID_B, 1, 150000);
        onftSevenSevenBitProxyA.setMinDstGas(CHAIN_ID_C, 1, 150000);
        onftSevenSevenBitB.setMinDstGas(CHAIN_ID_A, 1, 150000);
        onftSevenSevenBitB.setMinDstGas(CHAIN_ID_C, 1, 150000);
        onftSevenSevenBitC.setMinDstGas(CHAIN_ID_A, 1, 150000);
        onftSevenSevenBitC.setMinDstGas(CHAIN_ID_B, 1, 150000);

        vm.stopPrank();
    }

    // Тесты для функции sendFrom
    function test_SendTokensBetweenChains() public {
        uint256 tokenId = 1;

        // Даем пользователю ETH для оплаты комиссий
        vm.deal(user, 1 ether);

        // Минтим токен владельцу
        vm.prank(owner);
        sevenSevenBit.safeMint(owner, tokenId);

        // Проверяем, что владелец токена на исходной цепи
        assertEq(sevenSevenBit.ownerOf(tokenId), owner);

        // Токен не существует на другой цепи
        vm.expectRevert();
        onftSevenSevenBitB.ownerOf(tokenId);

        // Можем передать токен как обычный ERC721
        vm.prank(owner);
        sevenSevenBit.transferFrom(owner, user, tokenId);
        assertEq(sevenSevenBit.ownerOf(tokenId), user);

        // Даем разрешение прокси на swap токена
        vm.prank(user);
        sevenSevenBit.approve(address(onftSevenSevenBitProxyA), tokenId);

        // Оцениваем комиссию
        (uint256 nativeFee,) = onftSevenSevenBitProxyA.estimateSendFee(
            CHAIN_ID_B,
            abi.encodePacked(user),
            tokenId,
            false,
            defaultAdapterParams
        );

        // Переводим токен на другую цепь
        vm.prank(user);
        onftSevenSevenBitProxyA.sendFrom{value: nativeFee}(
            user,
            CHAIN_ID_B,
            abi.encodePacked(user),
            tokenId,
            payable(user),
            ADDRESS_ZERO,
            defaultAdapterParams
        );

        // Токен теперь принадлежит прокси контракту на исходной цепи
        assertEq(sevenSevenBit.ownerOf(tokenId), address(onftSevenSevenBitProxyA));

        // Токен получен на целевой цепи
        assertEq(onftSevenSevenBitB.ownerOf(tokenId), user);

        // Оцениваем комиссию для следующего перевода
        (nativeFee,) = onftSevenSevenBitB.estimateSendFee(
            CHAIN_ID_C,
            abi.encodePacked(user),
            tokenId,
            false,
            defaultAdapterParams
        );

        // Можем отправить на другой ONFT контракт (не исходную NFT цепь)
        vm.prank(user);
        onftSevenSevenBitB.sendFrom{value: nativeFee}(
            user,
            CHAIN_ID_C,
            abi.encodePacked(user),
            tokenId,
            payable(user),
            ADDRESS_ZERO,
            defaultAdapterParams
        );

        // Токен сожжен на отправляющей цепи
        assertEq(onftSevenSevenBitB.ownerOf(tokenId), address(onftSevenSevenBitB));

        // Токен получен на целевой цепи
        assertEq(onftSevenSevenBitC.ownerOf(tokenId), user);

        // Оцениваем комиссию для возврата
        (nativeFee,) = onftSevenSevenBitC.estimateSendFee(
            CHAIN_ID_A,
            abi.encodePacked(user),
            tokenId,
            false,
            defaultAdapterParams
        );

        // Отправляем обратно на исходную цепь
        vm.prank(user);
        onftSevenSevenBitC.sendFrom{value: nativeFee}(
            user,
            CHAIN_ID_A,
            abi.encodePacked(user),
            tokenId,
            payable(user),
            ADDRESS_ZERO,
            defaultAdapterParams
        );

        // Токен сожжен на отправляющей цепи
        assertEq(onftSevenSevenBitC.ownerOf(tokenId), address(onftSevenSevenBitC));

        // Получен на исходной цепи
        assertEq(sevenSevenBit.ownerOf(tokenId), user);
    }

    function test_AllowTokenToBeSentOnBehalfOfAnotherUser() public {
        uint256 tokenId = 1;

        // Даем владельцу ETH для оплаты комиссий
        vm.deal(owner, 1 ether);

        // Минтим токен владельцу
        vm.prank(owner);
        sevenSevenBit.safeMint(owner, tokenId);

        // Даем разрешение прокси на swap токена
        vm.prank(owner);
        sevenSevenBit.approve(address(onftSevenSevenBitProxyA), tokenId);

        // Оцениваем комиссию
        (uint256 nativeFee,) = onftSevenSevenBitProxyA.estimateSendFee(
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenId,
            false,
            defaultAdapterParams
        );

        // Переводим токен на другую цепь
        vm.prank(owner);
        onftSevenSevenBitProxyA.sendFrom{value: nativeFee}(
            owner,
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenId,
            payable(owner),
            ADDRESS_ZERO,
            defaultAdapterParams
        );

        // Токен получен на целевой цепи
        assertEq(onftSevenSevenBitB.ownerOf(tokenId), owner);

        // Даем разрешение другому пользователю отправить токен
        vm.prank(owner);
        onftSevenSevenBitB.approve(user, tokenId);

        // Даем пользователю ETH для оплаты комиссий
        vm.deal(user, 1 ether);

        // Оцениваем комиссию
        (nativeFee,) = onftSevenSevenBitB.estimateSendFee(
            CHAIN_ID_C,
            abi.encodePacked(user),
            tokenId,
            false,
            defaultAdapterParams
        );

        // Отправляем через другого пользователя
        vm.prank(user);
        onftSevenSevenBitB.sendFrom{value: nativeFee}(
            owner,
            CHAIN_ID_C,
            abi.encodePacked(user),
            tokenId,
            payable(user),
            ADDRESS_ZERO,
            defaultAdapterParams
        );

        // Токен получен на целевой цепи
        assertEq(onftSevenSevenBitC.ownerOf(tokenId), user);
    }

    function test_RevertIfFromIsNotMsgSender() public {
        uint256 tokenId = 1;

        // Минтим токен владельцу
        vm.prank(owner);
        sevenSevenBit.safeMint(owner, tokenId);

        // Даем разрешение прокси на swap токена
        vm.prank(owner);
        sevenSevenBit.approve(address(onftSevenSevenBitProxyA), tokenId);

        // Пытаемся отправить от имени владельца, но вызываем от пользователя
        vm.prank(user);
        vm.expectRevert("ProxyONFT721: owner is not send caller");
        onftSevenSevenBitProxyA.sendFrom(
            owner,
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenId,
            payable(owner),
            ADDRESS_ZERO,
            defaultAdapterParams
        );
    }

    function test_RevertIfNotApprovedOnProxy() public {
        uint256 tokenId = 1;

        // Минтим токен владельцу
        vm.prank(owner);
        sevenSevenBit.safeMint(owner, tokenId);

        // Не даем разрешение прокси на swap токена

        // Пытаемся отправить без разрешения
        vm.prank(owner);
        vm.expectRevert();
        onftSevenSevenBitProxyA.sendFrom(
            owner,
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenId,
            payable(owner),
            ADDRESS_ZERO,
            defaultAdapterParams
        );
    }

    function test_RevertWhenContractIsApprovedButSendingUserIsNot() public {
        uint256 tokenId = 1;

        // Даем владельцу ETH для оплаты комиссий
        vm.deal(owner, 1 ether);

        // Минтим токен владельцу
        vm.prank(owner);
        sevenSevenBit.safeMint(owner, tokenId);

        // Даем разрешение прокси на swap токена
        vm.prank(owner);
        sevenSevenBit.approve(address(onftSevenSevenBitProxyA), tokenId);

        // Оцениваем комиссию
        (uint256 nativeFee,) = onftSevenSevenBitProxyA.estimateSendFee(
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenId,
            false,
            defaultAdapterParams
        );

        // Переводим токен на другую цепь
        vm.prank(owner);
        onftSevenSevenBitProxyA.sendFrom{value: nativeFee}(
            owner,
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenId,
            payable(owner),
            ADDRESS_ZERO,
            defaultAdapterParams
        );

        // Токен получен на целевой цепи
        assertEq(onftSevenSevenBitB.ownerOf(tokenId), owner);

        // Даем разрешение контракту на swap токена
        vm.prank(owner);
        onftSevenSevenBitB.approve(address(onftSevenSevenBitB), tokenId);

        // Отклоняется, потому что контракт имеет разрешение, а не пользователь
        vm.prank(user);
        vm.expectRevert("ONFT721: send caller is not owner nor approved");
        onftSevenSevenBitB.sendFrom(
            owner,
            CHAIN_ID_C,
            abi.encodePacked(user),
            tokenId,
            payable(user),
            ADDRESS_ZERO,
            defaultAdapterParams
        );
    }

    function test_RevertIfNotApprovedOnNonProxyChain() public {
        uint256 tokenId = 1;

        // Даем владельцу ETH для оплаты комиссий
        vm.deal(owner, 1 ether);

        // Минтим токен владельцу
        vm.prank(owner);
        sevenSevenBit.safeMint(owner, tokenId);

        // Даем разрешение прокси на swap токена
        vm.prank(owner);
        sevenSevenBit.approve(address(onftSevenSevenBitProxyA), tokenId);

        // Оцениваем комиссию
        (uint256 nativeFee,) = onftSevenSevenBitProxyA.estimateSendFee(
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenId,
            false,
            defaultAdapterParams
        );

        // Переводим токен на другую цепь
        vm.prank(owner);
        onftSevenSevenBitProxyA.sendFrom{value: nativeFee}(
            owner,
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenId,
            payable(owner),
            ADDRESS_ZERO,
            defaultAdapterParams
        );

        // Токен получен на целевой цепи
        assertEq(onftSevenSevenBitB.ownerOf(tokenId), owner);

        // Отклоняется, потому что пользователь не имеет разрешения
        vm.prank(user);
        vm.expectRevert("ONFT721: send caller is not owner nor approved");
        onftSevenSevenBitB.sendFrom(
            owner,
            CHAIN_ID_C,
            abi.encodePacked(user),
            tokenId,
            payable(user),
            ADDRESS_ZERO,
            defaultAdapterParams
        );
    }

    function test_RevertIfSomeoneElseIsApprovedButNotTheSender() public {
        uint256 tokenIdA = 1;
        uint256 tokenIdB = 2;

        // Минтим токены обоим владельцам
        vm.prank(owner);
        sevenSevenBit.safeMint(owner, tokenIdA);
        vm.prank(owner);
        sevenSevenBit.safeMint(user, tokenIdB);

        // Даем разрешение owner.address на перевод, но не другому
        vm.prank(owner);
        sevenSevenBit.setApprovalForAll(address(onftSevenSevenBitProxyA), true);

        // Пытаемся отправить токен пользователя без разрешения
        vm.prank(user);
        vm.expectRevert();
        onftSevenSevenBitProxyA.sendFrom(
            user,
            CHAIN_ID_B,
            abi.encodePacked(user),
            tokenIdB,
            payable(user),
            ADDRESS_ZERO,
            defaultAdapterParams
        );

        vm.prank(user);
        vm.expectRevert();
        onftSevenSevenBitProxyA.sendFrom(
            user,
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenIdB,
            payable(owner),
            ADDRESS_ZERO,
            defaultAdapterParams
        );
    }

    function test_RevertIfSenderDoesNotOwnToken() public {
        uint256 tokenIdA = 1;
        uint256 tokenIdB = 2;

        // Минтим токены обоим владельцам
        vm.prank(owner);
        sevenSevenBit.safeMint(owner, tokenIdA);
        vm.prank(owner);
        sevenSevenBit.safeMint(user, tokenIdB);

        // Даем разрешение owner.address на перевод, но не другому
        vm.prank(owner);
        sevenSevenBit.setApprovalForAll(address(onftSevenSevenBitProxyA), true);

        // Пытаемся отправить токен владельца от имени пользователя
        vm.prank(user);
        vm.expectRevert();
        onftSevenSevenBitProxyA.sendFrom(
            user,
            CHAIN_ID_B,
            abi.encodePacked(user),
            tokenIdA,
            payable(user),
            ADDRESS_ZERO,
            defaultAdapterParams
        );

        vm.prank(user);
        vm.expectRevert();
        onftSevenSevenBitProxyA.sendFrom(
            user,
            CHAIN_ID_B,
            abi.encodePacked(owner),
            tokenIdA,
            payable(owner),
            ADDRESS_ZERO,
            defaultAdapterParams
        );
    }
}
