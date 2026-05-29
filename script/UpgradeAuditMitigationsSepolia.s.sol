// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import {ModuleRegistry} from "../src/host/ModuleRegistry.sol";
import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {GrowfiTreasury} from "../src/GrowfiTreasury.sol";
import {GrowfiStakingPool} from "../src/GrowfiStakingPool.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {SaleClassicHelper} from "../test/modules/SaleClassicHelper.sol";

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
///   OLD_SALE_IMPL                Revoked after approving the new SaleClassic impl
///   USDT_ADDRESS                 Fixed-price campaign payment token policy
///   DAI_ADDRESS                  Fixed-price campaign payment token policy
///   WETH_ADDRESS                 Oracle campaign payment token policy
///   WETH_ORACLE                  Required if WETH_ADDRESS is set
///   MIGRATE_EXISTING_CAMPAIGNS   1 to upgrade all Campaign host proxies and replace their SaleClassic module
///   MAX_CAMPAIGNS                Optional migration cap for batch execution
contract UpgradeAuditMitigationsSepolia is Script {
    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    function run() public {
        require(block.chainid == 11_155_111, "Sepolia only");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address factoryProxy = vm.envAddress("FACTORY_ADDRESS");

        vm.startBroadcast(deployerPk);

        GrowfiCampaignFactory factoryImpl = new GrowfiCampaignFactory();
        GrowfiCampaign campaignImpl = new GrowfiCampaign();
        GrowfiTreasury treasuryImpl = new GrowfiTreasury();
        GrowfiStakingPool stakingPoolImpl = new GrowfiStakingPool();
        SaleClassicModule saleImpl = new SaleClassicModule();

        _upgradeProxy(factoryProxy, address(factoryImpl));
        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);

        address treasuryProxy = vm.envOr("GROWFI_TREASURY_ADDRESS", factory.growfiTreasury());
        address stakingPoolProxy = vm.envOr("GROWFI_STAKING_POOL_ADDRESS", address(0));
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

        bytes32 saleKind = factory.KIND_SALE_CLASSIC_V1();
        factory.setModuleKindSelectors(saleKind, SaleClassicHelper.selectors());
        factory.approveModuleImpl(saleKind, address(saleImpl), true);

        address oldSaleImpl = vm.envOr("OLD_SALE_IMPL", address(0));
        if (oldSaleImpl != address(0) && oldSaleImpl != address(saleImpl)) {
            factory.approveModuleImpl(saleKind, oldSaleImpl, false);
        }

        _updateDefaultSaleModule(factory, saleKind, address(saleImpl));
        _setPaymentPolicies(factory);

        uint256 migratedCampaigns;
        if (vm.envOr("MIGRATE_EXISTING_CAMPAIGNS", uint256(0)) == 1) {
            migratedCampaigns = _migrateExistingCampaigns(factory, address(campaignImpl), saleKind, address(saleImpl));
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Sepolia audit mitigation upgrade complete ===");
        console.log("Factory proxy:            ", factoryProxy);
        console.log("Factory impl:             ", address(factoryImpl));
        console.log("Campaign impl:            ", address(campaignImpl));
        console.log("Treasury proxy:           ", treasuryProxy);
        console.log("Treasury impl:            ", address(treasuryImpl));
        console.log("Staking pool proxy:       ", stakingPoolProxy);
        console.log("Staking pool impl:        ", address(stakingPoolImpl));
        console.log("SaleClassic module impl:  ", address(saleImpl));
        console.log("Migrated campaigns:       ", migratedCampaigns);
    }

    function _updateDefaultSaleModule(GrowfiCampaignFactory factory, bytes32 saleKind, address saleImpl) internal {
        uint256 n = factory.defaultModulesLength();
        ModuleRegistry.DefaultModule[] memory defaults = new ModuleRegistry.DefaultModule[](n);
        bool foundSale;

        for (uint256 i; i < n;) {
            defaults[i] = factory.defaultModuleAt(i);
            if (defaults[i].moduleType == TYPE_SALE) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_SALE, kind: saleKind, impl: saleImpl, metadataURI: defaults[i].metadataURI
                });
                foundSale = true;
            }
            unchecked {
                ++i;
            }
        }

        if (foundSale) {
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
        bytes32 saleKind,
        address saleImpl
    ) internal returns (uint256 migrated) {
        uint256 len = factory.campaignsLength();
        uint256 maxCampaigns = vm.envOr("MAX_CAMPAIGNS", type(uint256).max);
        if (maxCampaigns < len) len = maxCampaigns;

        for (uint256 i; i < len;) {
            (address campaign,,,,,,) = factory.campaigns(i);
            _upgradeProxy(campaign, campaignImpl);
            factory.replaceCampaignModule(campaign, TYPE_SALE, saleKind, saleImpl, "");
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
