// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProceedsSplitStorage
/// @notice Shared storage for the optional campaign proceeds split module.
///         SaleClassicModule reads this namespace when routing producer
///         proceeds. The producer address in CampaignStorage remains the
///         campaign admin; this storage only changes the money routing.
library ProceedsSplitStorage {
    struct Layout {
        address promoter;
        uint16 promoterBps;
        bool active;
    }

    bytes32 internal constant STORAGE_SLOT = 0x42bf718305fc64ba040690224a5dbdd05d355220311634ca593020a819cb9984; // keccak256("growfi.module.proceeds.split.v1")
    uint16 internal constant BPS = 10_000;

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
