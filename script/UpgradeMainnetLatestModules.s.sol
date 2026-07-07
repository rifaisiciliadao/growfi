// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {ModuleRegistry} from "../src/host/ModuleRegistry.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";
import {CampaignProceedsSplitModule} from "../src/modules/CampaignProceedsSplitModule.sol";
import {DirectIssueModule} from "../src/modules/DirectIssueModule.sol";
import {ProjectUpdatesModule} from "../src/modules/ProjectUpdatesModule.sol";

import {SaleClassicHelper} from "../test/modules/SaleClassicHelper.sol";
import {CollateralHelper} from "../test/modules/CollateralHelper.sol";
import {ProceedsSplitHelper} from "../test/modules/ProceedsSplitHelper.sol";
import {DirectIssueHelper} from "../test/modules/DirectIssueHelper.sol";
import {ProjectUpdatesHelper} from "../test/modules/ProjectUpdatesHelper.sol";

/// @title UpgradeMainnetLatestModules
/// @notice Ethereum mainnet rollout script for the latest campaign modules.
///         Run with FORK_SIMULATION=1 on a fork first. Real broadcast requires
///         MAINNET_DEPLOYER_PRIVATE_KEY and must be explicitly confirmed.
contract UpgradeMainnetLatestModules is Script {
    address internal constant DEFAULT_MAINNET_FACTORY = 0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2;
    address internal constant MAINNET_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant TYPE_COLLATERAL = keccak256("growfi.type.collateral");

    bytes32 internal constant KIND_SALE_CLASSIC = keccak256("growfi.sale.classic.v1");
    bytes32 internal constant KIND_COLLATERAL = keccak256("growfi.collateral.v1");
    bytes32 internal constant KIND_PROCEEDS_SPLIT = keccak256("growfi.proceeds.split.v1");
    bytes32 internal constant KIND_DIRECT_ISSUE = keccak256("growfi.direct.issue.v1");
    bytes32 internal constant KIND_PROJECT_UPDATES = keccak256("growfi.project.updates.v1");

    error BlockedMainnetActor(address actor);

    struct DeployedModules {
        SaleClassicModule sale;
        CollateralModule collateral;
        CampaignProceedsSplitModule proceedsSplit;
        DirectIssueModule directIssue;
        ProjectUpdatesModule projectUpdates;
    }

    function run() public {
        require(block.chainid == 1, "Ethereum mainnet only");

        address factoryProxy = vm.envOr("MAINNET_FACTORY_ADDRESS", DEFAULT_MAINNET_FACTORY);
        address blockedActor = vm.envOr("BLOCKED_MAINNET_OWNER", address(0));
        bool forkSimulation = vm.envOr("FORK_SIMULATION", uint256(0)) == 1;
        bool updateDefaults = vm.envOr("UPDATE_DEFAULT_MODULES", uint256(1)) == 1;
        bool migrateExistingSaleModules = vm.envOr("MIGRATE_EXISTING_SALE_MODULES", uint256(0)) == 1;
        bool migrateExistingCollateralModules = vm.envOr("MIGRATE_EXISTING_COLLATERAL_MODULES", uint256(0)) == 1;

        require(factoryProxy.code.length > 0, "factory has no code");

        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);
        address factoryOwner = factory.owner();
        _requireNotBlocked(factoryOwner, blockedActor);

        uint256 campaignCount =
            _preflight(factory, updateDefaults, migrateExistingSaleModules, migrateExistingCollateralModules);

        if (forkSimulation) {
            vm.startPrank(factoryOwner);
        } else {
            uint256 deployerPk = vm.envUint("MAINNET_DEPLOYER_PRIVATE_KEY");
            address deployer = vm.addr(deployerPk);
            require(deployer == factoryOwner, "deployer is not factory owner");
            _requireNotBlocked(deployer, blockedActor);
            vm.startBroadcast(deployerPk);
        }

        DeployedModules memory deployed = _deployModules();
        _registerModules(factory, deployed);

        bool defaultSaleUpdated;
        bool defaultCollateralUpdated;
        if (updateDefaults) {
            (defaultSaleUpdated, defaultCollateralUpdated) =
                _updateDefaultModules(factory, address(deployed.sale), address(deployed.collateral));
        }

        uint256 saleReplaced;
        uint256 collateralReplaced;
        if (migrateExistingSaleModules || migrateExistingCollateralModules) {
            (saleReplaced, collateralReplaced) = _replaceExistingDefaultModules(
                factory,
                address(deployed.sale),
                address(deployed.collateral),
                migrateExistingSaleModules,
                migrateExistingCollateralModules
            );
        }

        _verify(factory, deployed, updateDefaults, migrateExistingSaleModules, migrateExistingCollateralModules);

        if (forkSimulation) {
            vm.stopPrank();
        } else {
            vm.stopBroadcast();
        }

        _logSummary(
            factoryProxy,
            factoryOwner,
            forkSimulation,
            campaignCount,
            defaultSaleUpdated,
            defaultCollateralUpdated,
            saleReplaced,
            collateralReplaced,
            deployed
        );
    }

    function _preflight(
        GrowfiCampaignFactory factory,
        bool updateDefaults,
        bool migrateExistingSaleModules,
        bool migrateExistingCollateralModules
    ) internal view returns (uint256 campaignCount) {
        require(factory.usdc() == MAINNET_USDC, "factory is not configured for mainnet USDC");

        if (updateDefaults) {
            (bool hasSaleDefault, bool hasCollateralDefault) = _defaultModulePresence(factory);
            require(hasSaleDefault, "sale default missing");
            require(hasCollateralDefault, "collateral default missing");
        }

        campaignCount = factory.getCampaignCount();
        if (migrateExistingSaleModules || migrateExistingCollateralModules) {
            for (uint256 i; i < campaignCount;) {
                (address campaign,,,,,,) = factory.campaigns(i);
                require(factory.isCampaign(campaign), "unknown campaign record");
                if (migrateExistingSaleModules) {
                    _requireEnabledModule(campaign, TYPE_SALE, "sale module missing or disabled");
                }
                if (migrateExistingCollateralModules) {
                    _requireEnabledModule(campaign, TYPE_COLLATERAL, "collateral module missing or disabled");
                }

                unchecked {
                    ++i;
                }
            }
        }
    }

    function _deployModules() internal returns (DeployedModules memory deployed) {
        deployed.sale = new SaleClassicModule();
        deployed.collateral = new CollateralModule();
        deployed.proceedsSplit = new CampaignProceedsSplitModule();
        deployed.directIssue = new DirectIssueModule();
        deployed.projectUpdates = new ProjectUpdatesModule();
    }

    function _registerModules(GrowfiCampaignFactory factory, DeployedModules memory deployed) internal {
        factory.setModuleKindSelectors(KIND_SALE_CLASSIC, SaleClassicHelper.selectors());
        factory.approveModuleImpl(KIND_SALE_CLASSIC, address(deployed.sale), true);

        factory.setModuleKindSelectors(KIND_COLLATERAL, CollateralHelper.selectors());
        factory.approveModuleImpl(KIND_COLLATERAL, address(deployed.collateral), true);

        factory.setModuleKindSelectors(KIND_PROCEEDS_SPLIT, ProceedsSplitHelper.selectors());
        factory.approveModuleImpl(KIND_PROCEEDS_SPLIT, address(deployed.proceedsSplit), true);

        factory.setModuleKindSelectors(KIND_DIRECT_ISSUE, DirectIssueHelper.selectors());
        factory.approveModuleImpl(KIND_DIRECT_ISSUE, address(deployed.directIssue), true);

        factory.setModuleKindSelectors(KIND_PROJECT_UPDATES, ProjectUpdatesHelper.selectors());
        factory.approveModuleImpl(KIND_PROJECT_UPDATES, address(deployed.projectUpdates), true);
    }

    function _updateDefaultModules(GrowfiCampaignFactory factory, address saleImpl, address collateralImpl)
        internal
        returns (bool saleUpdated, bool collateralUpdated)
    {
        uint256 n = factory.defaultModulesLength();
        ModuleRegistry.DefaultModule[] memory defaults = new ModuleRegistry.DefaultModule[](n);

        for (uint256 i; i < n;) {
            defaults[i] = factory.defaultModuleAt(i);
            if (defaults[i].moduleType == TYPE_SALE) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_SALE, kind: KIND_SALE_CLASSIC, impl: saleImpl, metadataURI: defaults[i].metadataURI
                });
                saleUpdated = true;
            } else if (defaults[i].moduleType == TYPE_COLLATERAL) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_COLLATERAL,
                    kind: KIND_COLLATERAL,
                    impl: collateralImpl,
                    metadataURI: defaults[i].metadataURI
                });
                collateralUpdated = true;
            }
            unchecked {
                ++i;
            }
        }

        require(saleUpdated, "sale default not updated");
        require(collateralUpdated, "collateral default not updated");
        factory.setDefaultModules(defaults);
    }

    function _replaceExistingDefaultModules(
        GrowfiCampaignFactory factory,
        address saleImpl,
        address collateralImpl,
        bool migrateSale,
        bool migrateCollateral
    ) internal returns (uint256 saleReplaced, uint256 collateralReplaced) {
        uint256 campaignCount = factory.getCampaignCount();
        for (uint256 i; i < campaignCount;) {
            (address campaign,,,,,,) = factory.campaigns(i);

            if (migrateSale) {
                (,, string memory saleMetadata,,) = GrowfiCampaign(payable(campaign)).moduleSlot(TYPE_SALE);
                factory.replaceCampaignModule(campaign, TYPE_SALE, KIND_SALE_CLASSIC, saleImpl, saleMetadata);
                unchecked {
                    ++saleReplaced;
                }
            }

            if (migrateCollateral) {
                (,, string memory collateralMetadata,,) = GrowfiCampaign(payable(campaign)).moduleSlot(TYPE_COLLATERAL);
                factory.replaceCampaignModule(
                    campaign, TYPE_COLLATERAL, KIND_COLLATERAL, collateralImpl, collateralMetadata
                );
                unchecked {
                    ++collateralReplaced;
                }
            }

            unchecked {
                ++i;
            }
        }
    }

    function _verify(
        GrowfiCampaignFactory factory,
        DeployedModules memory deployed,
        bool updateDefaults,
        bool migrateExistingSaleModules,
        bool migrateExistingCollateralModules
    ) internal view {
        _requireApproved(factory, KIND_SALE_CLASSIC, address(deployed.sale));
        _requireApproved(factory, KIND_COLLATERAL, address(deployed.collateral));
        _requireApproved(factory, KIND_PROCEEDS_SPLIT, address(deployed.proceedsSplit));
        _requireApproved(factory, KIND_DIRECT_ISSUE, address(deployed.directIssue));
        _requireApproved(factory, KIND_PROJECT_UPDATES, address(deployed.projectUpdates));

        require(
            factory.moduleKindSelectors(KIND_SALE_CLASSIC).length == SaleClassicHelper.selectors().length,
            "bad sale selectors"
        );
        require(
            factory.moduleKindSelectors(KIND_COLLATERAL).length == CollateralHelper.selectors().length,
            "bad collateral selectors"
        );
        require(
            factory.moduleKindSelectors(KIND_PROCEEDS_SPLIT).length == ProceedsSplitHelper.selectors().length,
            "bad split selectors"
        );
        require(
            factory.moduleKindSelectors(KIND_DIRECT_ISSUE).length == DirectIssueHelper.selectors().length,
            "bad direct issue selectors"
        );
        require(
            factory.moduleKindSelectors(KIND_PROJECT_UPDATES).length == ProjectUpdatesHelper.selectors().length,
            "bad project update selectors"
        );

        if (updateDefaults) {
            _requireDefaultImpl(factory, TYPE_SALE, address(deployed.sale));
            _requireDefaultImpl(factory, TYPE_COLLATERAL, address(deployed.collateral));
        }

        if (migrateExistingSaleModules || migrateExistingCollateralModules) {
            uint256 campaignCount = factory.getCampaignCount();
            for (uint256 i; i < campaignCount;) {
                (address campaign,,,,,,) = factory.campaigns(i);
                if (migrateExistingSaleModules) {
                    _requireModuleImpl(campaign, TYPE_SALE, address(deployed.sale));
                }
                if (migrateExistingCollateralModules) {
                    _requireModuleImpl(campaign, TYPE_COLLATERAL, address(deployed.collateral));
                }

                unchecked {
                    ++i;
                }
            }
        }
    }

    function _defaultModulePresence(GrowfiCampaignFactory factory)
        internal
        view
        returns (bool hasSaleDefault, bool hasCollateralDefault)
    {
        uint256 n = factory.defaultModulesLength();
        for (uint256 i; i < n;) {
            ModuleRegistry.DefaultModule memory defaultModule = factory.defaultModuleAt(i);
            if (defaultModule.moduleType == TYPE_SALE) hasSaleDefault = true;
            if (defaultModule.moduleType == TYPE_COLLATERAL) hasCollateralDefault = true;

            unchecked {
                ++i;
            }
        }
    }

    function _requireEnabledModule(address campaign, bytes32 moduleType, string memory reason) internal view {
        (address impl,,,, bool enabled) = GrowfiCampaign(payable(campaign)).moduleSlot(moduleType);
        require(impl != address(0) && enabled, reason);
    }

    function _requireModuleImpl(address campaign, bytes32 moduleType, address expectedImpl) internal view {
        (address impl,,,, bool enabled) = GrowfiCampaign(payable(campaign)).moduleSlot(moduleType);
        require(impl == expectedImpl, "campaign module impl mismatch");
        require(enabled, "campaign module disabled");
    }

    function _requireDefaultImpl(GrowfiCampaignFactory factory, bytes32 moduleType, address expectedImpl)
        internal
        view
    {
        uint256 n = factory.defaultModulesLength();
        for (uint256 i; i < n;) {
            ModuleRegistry.DefaultModule memory defaultModule = factory.defaultModuleAt(i);
            if (defaultModule.moduleType == moduleType) {
                require(defaultModule.impl == expectedImpl, "default impl mismatch");
                return;
            }

            unchecked {
                ++i;
            }
        }
        revert("default module missing");
    }

    function _requireApproved(GrowfiCampaignFactory factory, bytes32 kind, address impl) internal view {
        require(factory.approvedModuleImpls(kind, impl), "impl not approved");
    }

    function _requireNotBlocked(address actor, address blockedActor) internal pure {
        if (blockedActor != address(0) && actor == blockedActor) revert BlockedMainnetActor(actor);
    }

    function _logSummary(
        address factoryProxy,
        address factoryOwner,
        bool forkSimulation,
        uint256 campaignCount,
        bool defaultSaleUpdated,
        bool defaultCollateralUpdated,
        uint256 saleReplaced,
        uint256 collateralReplaced,
        DeployedModules memory deployed
    ) internal view {
        console.log("");
        console.log("=== GrowFi mainnet latest modules rollout ===");
        console.log("Mode:                         ", forkSimulation ? "fork simulation" : "broadcast");
        console.log("Chain id:                     ", block.chainid);
        console.log("Factory proxy:                ", factoryProxy);
        console.log("Factory owner:                ", factoryOwner);
        console.log("SaleClassic module impl:      ", address(deployed.sale));
        console.log("Collateral module impl:       ", address(deployed.collateral));
        console.log("Proceeds split impl:          ", address(deployed.proceedsSplit));
        console.log("Direct issue impl:            ", address(deployed.directIssue));
        console.log("Project updates impl:         ", address(deployed.projectUpdates));
        console.log("Campaigns checked:            ", campaignCount);
        console.log("Default sale updated:         ", defaultSaleUpdated);
        console.log("Default collateral updated:   ", defaultCollateralUpdated);
        console.log("Existing sale modules updated:", saleReplaced);
        console.log("Existing collateral updated:  ", collateralReplaced);
    }
}
