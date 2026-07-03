// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CampaignStorage} from "../host/CampaignStorage.sol";
import {ProceedsSplitStorage} from "./lib/ProceedsSplitStorage.sol";

/// @title CampaignProceedsSplitModule
/// @notice Optional producer-controlled split for primary sale proceeds.
///         When active, SaleClassic routes producer proceeds between the
///         campaign producer and a promoter address. Protocol fees,
///         buyback refunds, and sell-back queue fills are unaffected.
contract CampaignProceedsSplitModule {
    error OnlyProducer();
    error ZeroAddress();
    error InvalidBps();
    error NoChange();

    event ProceedsSplitSet(address indexed promoter, uint16 promoterBps, uint16 producerBps);
    event ProceedsSplitCleared();

    modifier onlyProducer() {
        if (msg.sender != CampaignStorage.layout().producer) revert OnlyProducer();
        _;
    }

    function setProceedsSplit(address promoter, uint16 promoterBps) external onlyProducer {
        if (promoter == address(0)) revert ZeroAddress();
        if (promoterBps == 0 || promoterBps > ProceedsSplitStorage.BPS) revert InvalidBps();

        ProceedsSplitStorage.Layout storage s = ProceedsSplitStorage.layout();
        if (s.active && s.promoter == promoter && s.promoterBps == promoterBps) revert NoChange();

        s.promoter = promoter;
        s.promoterBps = promoterBps;
        s.active = true;

        emit ProceedsSplitSet(promoter, promoterBps, ProceedsSplitStorage.BPS - promoterBps);
    }

    function clearProceedsSplit() external onlyProducer {
        ProceedsSplitStorage.Layout storage s = ProceedsSplitStorage.layout();
        if (!s.active) revert NoChange();

        s.promoter = address(0);
        s.promoterBps = 0;
        s.active = false;

        emit ProceedsSplitCleared();
    }

    function proceedsSplit()
        external
        view
        returns (bool active, address producer, address promoter, uint16 promoterBps, uint16 producerBps)
    {
        ProceedsSplitStorage.Layout storage s = ProceedsSplitStorage.layout();
        active = s.active;
        producer = CampaignStorage.layout().producer;
        promoter = s.promoter;
        promoterBps = s.promoterBps;
        producerBps = active ? ProceedsSplitStorage.BPS - promoterBps : ProceedsSplitStorage.BPS;
    }

    function previewProceedsSplit(uint256 amount) external view returns (uint256 toProducer, uint256 toPromoter) {
        ProceedsSplitStorage.Layout storage s = ProceedsSplitStorage.layout();
        if (!s.active) return (amount, 0);
        toPromoter = amount * s.promoterBps / ProceedsSplitStorage.BPS;
        toProducer = amount - toPromoter;
    }
}
