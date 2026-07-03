// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {ModuleRegistry} from "../src/host/ModuleRegistry.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CampaignProceedsSplitModule} from "../src/modules/CampaignProceedsSplitModule.sol";
import {DirectIssueModule} from "../src/modules/DirectIssueModule.sol";

import {SaleClassicHelper} from "../test/modules/SaleClassicHelper.sol";
import {ProceedsSplitHelper} from "../test/modules/ProceedsSplitHelper.sol";
import {DirectIssueHelper} from "../test/modules/DirectIssueHelper.sol";

/// @title UpgradeMainnetProceedsSplitDirectIssue
/// @notice Registers the campaign proceeds split and direct issue modules on
///         Ethereum mainnet, then replaces the SaleClassic implementation on
///         existing campaigns so proceeds routing can read split config.
contract UpgradeMainnetProceedsSplitDirectIssue is Script {
    address internal constant FACTORY = 0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2;

    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant KIND_SALE_CLASSIC = keccak256("growfi.sale.classic.v1");
    bytes32 internal constant KIND_PROCEEDS_SPLIT = keccak256("growfi.proceeds.split.v1");
    bytes32 internal constant KIND_DIRECT_ISSUE = keccak256("growfi.direct.issue.v1");

    function run() public {
        require(block.chainid == 1, "Ethereum mainnet only");

        uint256 deployerPk = vm.envUint("MAINNET_DEPLOYER_PRIVATE_KEY");
        address factoryProxy = vm.envOr("MAINNET_FACTORY_ADDRESS", FACTORY);

        vm.startBroadcast(deployerPk);

        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);
        SaleClassicModule saleImpl = new SaleClassicModule();
        CampaignProceedsSplitModule proceedsSplitImpl = new CampaignProceedsSplitModule();
        DirectIssueModule directIssueImpl = new DirectIssueModule();

        factory.setModuleKindSelectors(KIND_SALE_CLASSIC, SaleClassicHelper.selectors());
        factory.approveModuleImpl(KIND_SALE_CLASSIC, address(saleImpl), true);

        factory.setModuleKindSelectors(KIND_PROCEEDS_SPLIT, ProceedsSplitHelper.selectors());
        factory.approveModuleImpl(KIND_PROCEEDS_SPLIT, address(proceedsSplitImpl), true);

        factory.setModuleKindSelectors(KIND_DIRECT_ISSUE, DirectIssueHelper.selectors());
        factory.approveModuleImpl(KIND_DIRECT_ISSUE, address(directIssueImpl), true);

        _updateDefaultSaleModule(factory, address(saleImpl));

        uint256 campaignCount = factory.getCampaignCount();
        for (uint256 i; i < campaignCount;) {
            (address campaign,,,,,,) = factory.campaigns(i);
            (,, string memory metadataURI,, bool enabled) = _saleModuleSlot(campaign);
            require(enabled, "sale module disabled");
            factory.replaceCampaignModule(campaign, TYPE_SALE, KIND_SALE_CLASSIC, address(saleImpl), metadataURI);

            unchecked {
                ++i;
            }
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== GrowFi mainnet proceeds split + direct issue upgrade ===");
        console.log("Factory proxy:             ", factoryProxy);
        console.log("SaleClassic module impl:   ", address(saleImpl));
        console.log("Proceeds split impl:       ", address(proceedsSplitImpl));
        console.log("Direct issue impl:         ", address(directIssueImpl));
        console.log("Campaigns sale-replaced:   ", campaignCount);
    }

    function _updateDefaultSaleModule(GrowfiCampaignFactory factory, address saleImpl) internal {
        uint256 n = factory.defaultModulesLength();
        ModuleRegistry.DefaultModule[] memory defaults = new ModuleRegistry.DefaultModule[](n);

        for (uint256 i; i < n;) {
            defaults[i] = factory.defaultModuleAt(i);
            if (defaults[i].moduleType == TYPE_SALE) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_SALE, kind: KIND_SALE_CLASSIC, impl: saleImpl, metadataURI: defaults[i].metadataURI
                });
            }
            unchecked {
                ++i;
            }
        }

        factory.setDefaultModules(defaults);
    }

    function _saleModuleSlot(address campaign)
        internal
        view
        returns (address impl, bytes32 kind, string memory metadataURI, uint64 attachedAt, bool enabled)
    {
        return GrowfiCampaign(payable(campaign)).moduleSlot(TYPE_SALE);
    }
}
