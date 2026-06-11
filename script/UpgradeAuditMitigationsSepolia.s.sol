// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import {ModuleRegistry} from "../src/host/ModuleRegistry.sol";
import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {GrowfiHarvestManager} from "../src/GrowfiHarvestManager.sol";
import {GrowfiMinter} from "../src/GrowfiMinter.sol";
import {GrowfiTreasury} from "../src/GrowfiTreasury.sol";
import {GrowfiStakingPool} from "../src/GrowfiStakingPool.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";
import {DebtRestructuringModule} from "../src/modules/DebtRestructuringModule.sol";
import {SaleClassicHelper} from "../test/modules/SaleClassicHelper.sol";
import {CollateralHelper} from "../test/modules/CollateralHelper.sol";
import {DebtRestructuringHelper} from "../test/modules/DebtRestructuringHelper.sol";

/// @title UpgradeAuditMitigationsSepolia
/// @notice Upgrades the existing Sepolia protocol to the audit-mitigated implementations.
///
/// Required env:
///   PRIVATE_KEY
///   FACTORY_ADDRESS
///
/// Optional env:
///   GROWFI_TREASURY_ADDRESS       Defaults to factory.growfiTreasury()
///   GROWFI_STAKING_POOL_ADDRESS  Defaults to treasury.stakingPool()
///   GROWFI_MINTER_ADDRESS         Defaults to factory.growfiMinter()
///   OLD_SALE_IMPL                Revoked after approving the new SaleClassic impl
///   OLD_COLLATERAL_IMPL          Revoked after approving the new Collateral impl
///   USDT_ADDRESS                 Fixed-price campaign payment token policy
///   DAI_ADDRESS                  Fixed-price campaign payment token policy
///   WETH_ADDRESS                 Oracle campaign payment token policy
///   WETH_ORACLE                  Required if WETH_ADDRESS is set
///   MIGRATE_EXISTING_CAMPAIGNS   1 to upgrade all Campaign host proxies and replace their SaleClassic module
///   MAX_CAMPAIGNS                Optional migration cap for batch execution
contract UpgradeAuditMitigationsSepolia is Script {
    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant TYPE_COLLATERAL = keccak256("growfi.type.collateral");
    bytes32 internal constant KIND_DEBT_RESTRUCTURING = keccak256("growfi.debt.restructuring.v1");
    bytes32 internal constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    function run() public {
        require((block.chainid == 11_155_111 || block.chainid == 84_532), "Sepolia only");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address factoryProxy = vm.envAddress("FACTORY_ADDRESS");

        vm.startBroadcast(deployerPk);

        GrowfiCampaignFactory factoryImpl = new GrowfiCampaignFactory();
        GrowfiCampaign campaignImpl = new GrowfiCampaign();
        GrowfiHarvestManager harvestManagerImpl = new GrowfiHarvestManager();
        GrowfiMinter minterImpl = new GrowfiMinter();
        GrowfiTreasury treasuryImpl = new GrowfiTreasury();
        GrowfiStakingPool stakingPoolImpl = new GrowfiStakingPool();
        SaleClassicModule saleImpl = new SaleClassicModule();
        CollateralModule collateralImpl = new CollateralModule();
        DebtRestructuringModule debtRestructuringImpl = new DebtRestructuringModule();

        _upgradeProxy(factoryProxy, address(factoryImpl));
        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);

        address treasuryProxy = vm.envOr("GROWFI_TREASURY_ADDRESS", factory.growfiTreasury());
        address minterProxy = vm.envOr("GROWFI_MINTER_ADDRESS", factory.growfiMinter());
        address stakingPoolProxy = vm.envOr("GROWFI_STAKING_POOL_ADDRESS", address(0));
        if (minterProxy != address(0)) {
            _upgradeProxy(minterProxy, address(minterImpl));
        }
        if (treasuryProxy != address(0)) {
            if (stakingPoolProxy == address(0)) {
                stakingPoolProxy = GrowfiTreasury(treasuryProxy).stakingPool();
            }
            _upgradeProxy(treasuryProxy, address(treasuryImpl));
        }
        if (stakingPoolProxy != address(0)) {
            _upgradeProxy(stakingPoolProxy, address(stakingPoolImpl));
        }

        factory.setCampaignImpl(address(campaignImpl));
        factory.setHarvestManagerImpl(address(harvestManagerImpl));

        bytes32 saleKind = factory.KIND_SALE_CLASSIC_V1();
        factory.setModuleKindSelectors(saleKind, SaleClassicHelper.selectors());
        factory.approveModuleImpl(saleKind, address(saleImpl), true);

        bytes32 collateralKind = factory.KIND_COLLATERAL_V1();
        factory.setModuleKindSelectors(collateralKind, CollateralHelper.selectors());
        factory.approveModuleImpl(collateralKind, address(collateralImpl), true);

        factory.setModuleKindSelectors(KIND_DEBT_RESTRUCTURING, DebtRestructuringHelper.selectors());
        factory.approveModuleImpl(KIND_DEBT_RESTRUCTURING, address(debtRestructuringImpl), true);

        address oldSaleImpl = vm.envOr("OLD_SALE_IMPL", address(0));
        if (oldSaleImpl != address(0) && oldSaleImpl != address(saleImpl)) {
            factory.approveModuleImpl(saleKind, oldSaleImpl, false);
        }

        address oldCollateralImpl = vm.envOr("OLD_COLLATERAL_IMPL", address(0));
        if (oldCollateralImpl != address(0) && oldCollateralImpl != address(collateralImpl)) {
            factory.approveModuleImpl(collateralKind, oldCollateralImpl, false);
        }

        _updateDefaultModules(factory, saleKind, address(saleImpl), collateralKind, address(collateralImpl));
        _setPaymentPolicies(factory);

        uint256 migratedCampaigns;
        if (vm.envOr("MIGRATE_EXISTING_CAMPAIGNS", uint256(0)) == 1) {
            migratedCampaigns = _migrateExistingCampaigns(
                factory,
                address(campaignImpl),
                address(harvestManagerImpl),
                saleKind,
                address(saleImpl),
                collateralKind,
                address(collateralImpl)
            );
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Sepolia audit mitigation upgrade complete ===");
        console.log("Factory proxy:            ", factoryProxy);
        console.log("Factory impl:             ", address(factoryImpl));
        console.log("Campaign impl:            ", address(campaignImpl));
        console.log("HarvestManager impl:      ", address(harvestManagerImpl));
        console.log("Minter proxy:             ", minterProxy);
        console.log("Minter impl:              ", address(minterImpl));
        console.log("Treasury proxy:           ", treasuryProxy);
        console.log("Treasury impl:            ", address(treasuryImpl));
        console.log("Staking pool proxy:       ", stakingPoolProxy);
        console.log("Staking pool impl:        ", address(stakingPoolImpl));
        console.log("SaleClassic module impl:  ", address(saleImpl));
        console.log("Collateral module impl:   ", address(collateralImpl));
        console.log("Debt restructuring impl:  ", address(debtRestructuringImpl));
        console.log("Migrated campaigns:       ", migratedCampaigns);
    }

    function _updateDefaultModules(
        GrowfiCampaignFactory factory,
        bytes32 saleKind,
        address saleImpl,
        bytes32 collateralKind,
        address collateralImpl
    ) internal {
        uint256 n = factory.defaultModulesLength();
        ModuleRegistry.DefaultModule[] memory defaults = new ModuleRegistry.DefaultModule[](n);
        bool foundSale;
        bool foundCollateral;

        for (uint256 i; i < n;) {
            defaults[i] = factory.defaultModuleAt(i);
            if (defaults[i].moduleType == TYPE_SALE) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_SALE, kind: saleKind, impl: saleImpl, metadataURI: defaults[i].metadataURI
                });
                foundSale = true;
            }
            if (defaults[i].moduleType == TYPE_COLLATERAL) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_COLLATERAL,
                    kind: collateralKind,
                    impl: collateralImpl,
                    metadataURI: defaults[i].metadataURI
                });
                foundCollateral = true;
            }
            unchecked {
                ++i;
            }
        }

        if (foundSale || foundCollateral) {
            factory.setDefaultModules(defaults);
        }
    }

    function _setPaymentPolicies(GrowfiCampaignFactory factory) internal {
        address usdc = factory.usdc();
        if (usdc != address(0)) {
            factory.setCampaignPaymentTokenPolicy(usdc, true, true, false, address(0));
        }

        address usdt = vm.envOr("USDT_ADDRESS", address(0));
        if (usdt != address(0)) {
            factory.setCampaignPaymentTokenPolicy(usdt, true, true, false, address(0));
        }

        address dai = vm.envOr("DAI_ADDRESS", address(0));
        if (dai != address(0)) {
            factory.setCampaignPaymentTokenPolicy(dai, true, true, false, address(0));
        }

        address weth = vm.envOr("WETH_ADDRESS", address(0));
        address wethOracle = vm.envOr("WETH_ORACLE", address(0));
        if (weth != address(0)) {
            require(wethOracle != address(0), "WETH_ORACLE required");
            factory.setCampaignPaymentTokenPolicy(weth, true, false, true, wethOracle);
        }
    }

    function _migrateExistingCampaigns(
        GrowfiCampaignFactory factory,
        address campaignImpl,
        address harvestManagerImpl,
        bytes32 saleKind,
        address saleImpl,
        bytes32 collateralKind,
        address collateralImpl
    ) internal returns (uint256 migrated) {
        uint256 len = factory.campaignsLength();
        uint256 maxCampaigns = vm.envOr("MAX_CAMPAIGNS", type(uint256).max);
        if (maxCampaigns < len) len = maxCampaigns;

        for (uint256 i; i < len;) {
            (address campaign,,,, address harvestManager,,) = factory.campaigns(i);
            _upgradeProxy(campaign, campaignImpl);
            _upgradeProxy(harvestManager, harvestManagerImpl);
            factory.replaceCampaignModule(campaign, TYPE_SALE, saleKind, saleImpl, "");
            factory.replaceCampaignModule(campaign, TYPE_COLLATERAL, collateralKind, collateralImpl, "");
            unchecked {
                ++migrated;
                ++i;
            }
        }
    }

    function _upgradeProxy(address proxy, address implementation) internal {
        address admin = _proxyAdmin(proxy);
        ProxyAdmin(admin).upgradeAndCall(ITransparentUpgradeableProxy(proxy), implementation, bytes(""));
    }

    function _proxyAdmin(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967_ADMIN_SLOT))));
    }
}
