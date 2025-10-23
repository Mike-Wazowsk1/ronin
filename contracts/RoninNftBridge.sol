pragma solidity ^0.8.22;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import {OApp, MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import {OAppOptionsType3} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";

contract RoninNftBridge is OApp, OAppOptionsType3, ERC1155Holder {
    IERC1155 public immutable token1155;

    uint16 public constant MSGTYPE_VANILLA = 1;

    event Sent(
        uint32 indexed dstEid,
        address indexed from,
        bytes32 to,
        uint256 id,
        uint64 amount,
        bytes options,
        bytes32 guid
    );

    event Unlocked(address indexed to, uint256 id, uint64 amount);

    constructor(address _endpoint, address _erc1155, address _delegate)
        OApp(_endpoint, _delegate)
        Ownable(_delegate)
    {
        require(_erc1155 != address(0), "ERC1155=0");
        token1155 = IERC1155(_erc1155);
    }

    function quote1155(
        uint32 _dstEid,
        bytes32 _to,
        uint256 _id,
        uint64 _amount,
        bytes calldata _options,
        bool _payInLzToken
    ) external view returns (MessagingFee memory fee) {
        bytes memory payload = _encodePayload(_to, _id, _amount, bytes(""));
        bytes memory options = combineOptions(_dstEid, MSGTYPE_VANILLA, _options);
        fee = _quote(_dstEid, payload, options, _payInLzToken);
    }

    function send1155(
        uint32 _dstEid,
        bytes32 _to,
        uint256 _id,
        uint64 _amount,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory receipt) {
        require(_amount > 0, "amount=0");

        token1155.safeTransferFrom(msg.sender, address(this), _id, _amount, "");

        bytes memory payload = _encodePayload(_to, _id, _amount, bytes(""));
        bytes memory options = combineOptions(_dstEid, MSGTYPE_VANILLA, _options);

        receipt = _lzSend(
            _dstEid,
            payload,
            options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        emit Sent(_dstEid, msg.sender, _to, _id, _amount, options, receipt.guid);
    }

    function _lzReceive(
        Origin calldata /*_origin*/,
        bytes32 /*_guid*/,
        bytes calldata _payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        (address to, uint256 id, uint64 amount) = _decodePayloadEvm(_payload);
        require(to != address(0), "to=0");
        token1155.safeTransferFrom(address(this), to, id, amount, "");
        emit Unlocked(to, id, amount);
    }

    function _encodePayload(
        bytes32 _to,
        uint256 _id,
        uint64 _amount,
        bytes memory _composeMsg
    ) internal pure returns (bytes memory) {
        bytes memory header = abi.encodePacked(_to, bytes32(_id), bytes8(_amount));
        return _composeMsg.length == 0 ? header : abi.encodePacked(header, _composeMsg);
    }

    function _decodePayloadEvm(bytes calldata payload)
        internal
        pure
        returns (address to, uint256 id, uint64 amount)
    {
        require(payload.length >= 32 + 32 + 8, "payload short");
        bytes32 to32;
        bytes32 id32;
        bytes8 amount8;
        assembly {
            to32 := calldataload(payload.offset)
            id32 := calldataload(add(payload.offset, 32))
            amount8 := calldataload(add(payload.offset, 64))
        }
        to = address(uint160(uint256(to32)));
        id = uint256(id32);
        amount = uint64(amount8);
    }
}
