// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CampaignStorage} from "../host/CampaignStorage.sol";

/// @title ProjectUpdatesModule
/// @notice Producer-controlled on-chain evidence feed for campaign updates.
///         Rich content lives off-chain as JSON; the module stores the public
///         metadata URI and a keccak256 content hash for verification.
contract ProjectUpdatesModule {
    struct UpdateRecord {
        uint256 id;
        address author;
        string metadataURI;
        bytes32 contentHash;
        uint64 postedAt;
        bool hidden;
        bool exists;
    }

    struct Layout {
        uint256 nextUpdateId;
        uint256 visibleCount;
        uint256[] updateIds;
        mapping(uint256 => UpdateRecord) updates;
    }

    bytes32 internal constant STORAGE_SLOT = 0x82d7222bc938fd151827cacac13b816852e1b146e92c958ede5de18da016e9b9; // keccak256("growfi.module.project.updates.v1")
    uint256 internal constant MAX_METADATA_URI_BYTES = 512;

    error OnlyProducer();
    error InvalidMetadataURI();
    error InvalidContentHash();
    error UpdateMissing();
    error NoChange();

    event ProjectUpdatePosted(
        uint256 indexed updateId, address indexed author, string metadataURI, bytes32 contentHash
    );
    event ProjectUpdateHidden(uint256 indexed updateId, address indexed author, bool hidden);

    modifier onlyProducer() {
        if (msg.sender != CampaignStorage.layout().producer) revert OnlyProducer();
        _;
    }

    function postProjectUpdate(string calldata metadataURI, bytes32 contentHash)
        external
        onlyProducer
        returns (uint256 updateId)
    {
        uint256 uriLength = bytes(metadataURI).length;
        if (uriLength == 0 || uriLength > MAX_METADATA_URI_BYTES) revert InvalidMetadataURI();
        if (contentHash == bytes32(0)) revert InvalidContentHash();

        Layout storage s = _s();
        updateId = s.nextUpdateId == 0 ? 1 : s.nextUpdateId;
        s.nextUpdateId = updateId + 1;
        s.visibleCount += 1;
        s.updateIds.push(updateId);
        s.updates[updateId] = UpdateRecord({
            id: updateId,
            author: msg.sender,
            metadataURI: metadataURI,
            contentHash: contentHash,
            postedAt: uint64(block.timestamp),
            hidden: false,
            exists: true
        });

        emit ProjectUpdatePosted(updateId, msg.sender, metadataURI, contentHash);
    }

    function setProjectUpdateHidden(uint256 updateId, bool hidden) external onlyProducer {
        Layout storage s = _s();
        UpdateRecord storage record = s.updates[updateId];
        if (!record.exists) revert UpdateMissing();
        if (record.hidden == hidden) revert NoChange();

        record.hidden = hidden;
        if (hidden) {
            s.visibleCount -= 1;
        } else {
            s.visibleCount += 1;
        }

        emit ProjectUpdateHidden(updateId, msg.sender, hidden);
    }

    function projectUpdate(uint256 updateId) external view returns (UpdateRecord memory) {
        UpdateRecord storage record = _s().updates[updateId];
        if (!record.exists) revert UpdateMissing();
        return record;
    }

    function projectUpdateCount() external view returns (uint256) {
        return _s().updateIds.length;
    }

    function visibleProjectUpdateCount() external view returns (uint256) {
        return _s().visibleCount;
    }

    function projectUpdateIdAt(uint256 index) external view returns (uint256) {
        return _s().updateIds[index];
    }

    function nextProjectUpdateId() external view returns (uint256) {
        uint256 next = _s().nextUpdateId;
        return next == 0 ? 1 : next;
    }

    function _s() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
