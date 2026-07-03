// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CampaignStorage} from "../host/CampaignStorage.sol";
import {IGrowfiCampaignTokenMint} from "../interfaces/IGrowfiCampaignTokenMint.sol";

/// @title DirectIssueModule
/// @notice Optional producer-controlled issuance path for off-chain
///         agreements. It mints CampaignToken without pulling payment, while
///         keeping SaleClassic.currentSupply coherent with token supply.
contract DirectIssueModule {
    bytes32 internal constant SALE_CLASSIC_SLOT = 0xd7250d23bb7bc8e93366cf6815d31bcb947e004baa702b9bb515d6082501a234; // keccak256("growfi.module.sale.classic.v1")

    error OnlyProducer();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidState();
    error LengthMismatch();
    error MaxCapExceeded();

    event CampaignTokensIssued(address indexed to, uint256 amount, uint256 newCurrentSupply);

    modifier onlyProducer() {
        if (msg.sender != CampaignStorage.layout().producer) revert OnlyProducer();
        _;
    }

    function issueCampaignTokens(address to, uint256 amount) external onlyProducer returns (uint256 newCurrentSupply) {
        newCurrentSupply = _issue(to, amount);
    }

    function issueCampaignTokensBatch(address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyProducer
        returns (uint256 newCurrentSupply)
    {
        if (recipients.length != amounts.length) revert LengthMismatch();
        if (recipients.length == 0) revert ZeroAmount();

        uint256 total;
        for (uint256 i; i < amounts.length;) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();
            total += amounts[i];
            unchecked {
                ++i;
            }
        }

        _requireIssuableState();
        newCurrentSupply = _increaseSaleCurrentSupply(total);
        address campaignToken = CampaignStorage.layout().campaignToken;

        for (uint256 i; i < recipients.length;) {
            IGrowfiCampaignTokenMint(campaignToken).mint(recipients[i], amounts[i]);
            emit CampaignTokensIssued(recipients[i], amounts[i], newCurrentSupply);
            unchecked {
                ++i;
            }
        }
    }

    function quoteDirectIssue(uint256 amount) external view returns (uint256 newCurrentSupply, bool fitsMaxCap) {
        if (amount == 0) return (_readCurrentSupply(), true);
        uint256 current = _readCurrentSupply();
        uint256 maxCap = _readMaxCap();
        newCurrentSupply = current + amount;
        fitsMaxCap = newCurrentSupply <= maxCap;
    }

    function _issue(address to, uint256 amount) internal returns (uint256 newCurrentSupply) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _requireIssuableState();
        newCurrentSupply = _increaseSaleCurrentSupply(amount);
        IGrowfiCampaignTokenMint(CampaignStorage.layout().campaignToken).mint(to, amount);

        emit CampaignTokensIssued(to, amount, newCurrentSupply);
    }

    function _requireIssuableState() internal view {
        CampaignStorage.Layout storage cs = CampaignStorage.layout();
        if (cs.campaignToken == address(0)) revert InvalidState();
        if (cs.paused || cs.factoryPaused) revert InvalidState();
        if (cs.state != uint8(CampaignStorage.State.Funding) && cs.state != uint8(CampaignStorage.State.Active)) {
            revert InvalidState();
        }
    }

    function _increaseSaleCurrentSupply(uint256 amount) internal returns (uint256 current) {
        bytes32 slot = SALE_CLASSIC_SLOT;
        uint256 maxCap;
        assembly {
            current := sload(add(slot, 6))
            maxCap := sload(add(slot, 2))
        }
        current += amount;
        if (current > maxCap) revert MaxCapExceeded();
        assembly {
            sstore(add(slot, 6), current)
        }
    }

    function _readCurrentSupply() internal view returns (uint256 current) {
        bytes32 slot = SALE_CLASSIC_SLOT;
        assembly {
            current := sload(add(slot, 6))
        }
    }

    function _readMaxCap() internal view returns (uint256 maxCap) {
        bytes32 slot = SALE_CLASSIC_SLOT;
        assembly {
            maxCap := sload(add(slot, 2))
        }
    }
}
