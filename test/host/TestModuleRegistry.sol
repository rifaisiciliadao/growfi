// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ModuleRegistry} from "../../src/host/ModuleRegistry.sol";

/// @notice Concrete instantiation of ModuleRegistry used by the unit
///         tests. The real factory inherits ModuleRegistry but adds the
///         per-campaign deploy choreography that the framework tests
///         don't need.
contract TestModuleRegistry is ModuleRegistry {
    struct CampaignPaymentTokenPolicy {
        bool allowed;
        bool fixedPricingAllowed;
        bool oraclePricingAllowed;
        address oracleFeed;
    }

    mapping(address => CampaignPaymentTokenPolicy) private _campaignPaymentTokenPolicies;

    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __ModuleRegistry_init(owner_);
    }

    function setCampaignPaymentTokenPolicy(
        address token,
        bool allowed,
        bool fixedPricingAllowed,
        bool oraclePricingAllowed,
        address oracleFeed
    ) external onlyOwner {
        _campaignPaymentTokenPolicies[token] = CampaignPaymentTokenPolicy({
            allowed: allowed,
            fixedPricingAllowed: fixedPricingAllowed,
            oraclePricingAllowed: oraclePricingAllowed,
            oracleFeed: oracleFeed
        });
    }

    function campaignPaymentTokenPolicy(address token)
        external
        view
        returns (bool allowed, bool fixedPricingAllowed, bool oraclePricingAllowed, address oracleFeed)
    {
        CampaignPaymentTokenPolicy memory policy = _campaignPaymentTokenPolicies[token];
        return (policy.allowed, policy.fixedPricingAllowed, policy.oraclePricingAllowed, policy.oracleFeed);
    }
}
