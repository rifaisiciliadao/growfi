// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {RepaymentModule} from "../src/modules/RepaymentModule.sol";
import {RepaymentHelper} from "../test/modules/RepaymentHelper.sol";

contract UpgradeRepaymentSepolia is Script {
    bytes32 internal constant REPAY_KIND = keccak256("growfi.repayment.v1");
    bytes32 internal constant REPAY_TYPE = keccak256("growfi.type.repayment");

    function run() public {
        require((block.chainid == 11_155_111 || block.chainid == 84_532), "Sepolia only");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        GrowfiCampaignFactory factory = GrowfiCampaignFactory(vm.envAddress("FACTORY_ADDRESS"));
        address oldRepaymentImpl = vm.envOr("REPAYMENT_IMPL", address(0));
        address campaignA = vm.envOr("UPGRADE_REPAYMENT_CAMPAIGN", address(0));
        address campaignB = vm.envOr("UPGRADE_REPAYMENT_CAMPAIGN_2", address(0));

        vm.startBroadcast(deployerPk);

        address newRepaymentImpl = address(new RepaymentModule());
        factory.setModuleKindSelectors(REPAY_KIND, RepaymentHelper.selectors());
        factory.approveModuleImpl(REPAY_KIND, newRepaymentImpl, true);
        if (oldRepaymentImpl != address(0) && oldRepaymentImpl != newRepaymentImpl) {
            factory.approveModuleImpl(REPAY_KIND, oldRepaymentImpl, false);
        }

        _reattachIfSet(campaignA, newRepaymentImpl);
        _reattachIfSet(campaignB, newRepaymentImpl);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Sepolia repayment upgrade complete ===");
        console.log("Factory:              ", address(factory));
        console.log("Old repayment impl:   ", oldRepaymentImpl);
        console.log("New repayment impl:   ", newRepaymentImpl);
        console.log("Reattached campaign A:", campaignA);
        console.log("Reattached campaign B:", campaignB);
        console.log("Repayment fee bps:    ", RepaymentModule(payable(newRepaymentImpl)).repaymentProtocolFeeBps());
    }

    function _reattachIfSet(address campaign, address newRepaymentImpl) internal {
        if (campaign == address(0)) return;
        GrowfiCampaign(payable(campaign)).detachModule(REPAY_TYPE);
        GrowfiCampaign(payable(campaign))
            .attachModule(REPAY_TYPE, REPAY_KIND, newRepaymentImpl, "growfi://repayment/v1");
    }
}
