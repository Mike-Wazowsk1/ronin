// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@erc721a-upgradeable/extensions/ERC721ABurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SevenSevenBit is ERC721ABurnableUpgradeable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public constant MAX_SUPPLY = 7777;
    mapping(address => bool) public minters;
    string private _baseTokenURI;

    function initialize(address initialOwner, string memory newBaseTokenURI) public initializerERC721A initializer {
        __ERC721A_init("77Bit", "77BIT");
        __ERC721ABurnable_init();
        __Ownable_init(initialOwner);
        setBaseTokenURI(newBaseTokenURI);
        minters[initialOwner] = true;
    }

    event UpdateMinter(address indexed _minter, bool _value);

    modifier onlyMinter() {
        require(minters[msg.sender], "the caller does not have permission to mint tokens");
        _;
    }

    // Sets the base token URI for the contract
    function setBaseTokenURI(string memory newBaseTokenURI) public onlyOwner {
        _baseTokenURI = newBaseTokenURI;
    }

    // Returns the URI for a given token ID
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override(ERC721AUpgradeable, IERC721AUpgradeable)
        returns (string memory)
    {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        string memory baseURI = _baseTokenURI;
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, Strings.toString(tokenId), ".json")) : "";
    }

    function safeMint(address to, uint256 quantity) public onlyMinter {
        require(to != address(0), "Mint to the zero address");
        require(totalSupply() + quantity <= MAX_SUPPLY, "Minting exceeds max supply");
        _safeMint(to, quantity);
    }

    function baseTokenURI() public view returns (string memory) {
        return _baseTokenURI;
    }

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    function _authorizeUpgrade(address newImplementation) internal view override onlyOwner {}

    function addMinter(address _minter) external onlyOwner {
        minters[_minter] = true;
        emit UpdateMinter(_minter, true);
    }

    function removeMinter(address _minter) external onlyOwner {
        minters[_minter] = false;
        emit UpdateMinter(_minter, false);
    }
}
