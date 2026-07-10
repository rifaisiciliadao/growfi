// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import {ModuleRegistry} from "../src/host/ModuleRegistry.sol";
import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {GrowfiStakingVault} from "../src/GrowfiStakingVault.sol";
import {GrowfiTreasury} from "../src/GrowfiTreasury.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {SaleClassicHelper} from "../test/modules/SaleClassicHelper.sol";

/// @title UpgradeMainnetSecurity20260710
/// @notice Resumable EOA-signed rollout for the July 2026 security fixes.
///         The script intentionally supports existing campaigns and requires
///         every migrated vault to still be in its first season, where all
///         active stake is eligible for current-season accounting.
contract UpgradeMainnetSecurity20260710 is Script {
    address internal constant FACTORY = 0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2;
    address internal constant EXPECTED_OWNER = 0xA229F3c9851E26fC9eA18157b88cd1CDA6F90e55;
    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    bytes32 internal constant ERC1967_IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function run() public {
        require(block.chainid == 1, "Ethereum mainnet only");

        bool forkSimulation = vm.envOr("FORK_SIMULATION", uint256(0)) == 1;
        address deployer = vm.envOr("MAINNET_OWNER_ADDRESS", EXPECTED_OWNER);
        uint256 deployerPk;
        if (!forkSimulation) {
            deployerPk = vm.envUint("MAINNET_DEPLOYER_PRIVATE_KEY");
            require(vm.addr(deployerPk) == deployer, "unexpected deployer key");
        }
        address factoryProxy = vm.envOr("MAINNET_FACTORY_ADDRESS", FACTORY);
        uint256 expectedCampaignCount = vm.envOr("EXPECTED_MAINNET_CAMPAIGN_COUNT", uint256(2));

        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);
        require(factory.owner() == deployer, "EOA is not factory owner");
        require(factory.proxyAdminOwner() == deployer, "EOA is not campaign proxy admin owner");
        require(factory.getCampaignCount() == expectedCampaignCount, "unexpected campaign count");

        address treasuryProxy = factory.growfiTreasury();
        address oldFactoryImpl = _implementation(factoryProxy);
        address oldTreasuryImpl = _implementation(treasuryProxy);
        address[] memory oldVaultImpls = new address[](expectedCampaignCount);
        address[] memory oldSaleImpls = new address[](expectedCampaignCount);
        uint256[] memory eligibleStake = new uint256[](expectedCampaignCount);

        _requireProxyAdminOwner(factoryProxy, deployer);
        _requireProxyAdminOwner(treasuryProxy, deployer);
        for (uint256 i; i < expectedCampaignCount; ++i) {
            (address campaign,,, address vault,,,) = factory.campaigns(i);
            _requireProxyAdminOwner(vault, deployer);
            oldVaultImpls[i] = _implementation(vault);
            (oldSaleImpls[i],,,,) = GrowfiCampaign(payable(campaign)).moduleSlot(TYPE_SALE);
        }

        if (forkSimulation) {
            vm.startPrank(deployer);
        } else {
            vm.startBroadcast(deployerPk);
        }

        GrowfiCampaignFactory factoryImpl = new GrowfiCampaignFactory();
        GrowfiTreasury treasuryImpl = new GrowfiTreasury();
        GrowfiStakingVault vaultImpl = new GrowfiStakingVault();
        SaleClassicModule saleImpl = new SaleClassicModule();

        _upgradeProxy(factoryProxy, address(factoryImpl));
        factory = GrowfiCampaignFactory(factoryProxy);

        for (uint256 i; i < expectedCampaignCount; ++i) {
            factory.pauseCampaign(i);
            (,,, address vault,,,) = factory.campaigns(i);
            GrowfiStakingVault stakingVault = GrowfiStakingVault(vault);
            require(stakingVault.currentSeasonId() == 1, "automatic migration requires season 1");
            require(stakingVault.paused(), "vault pause failed");
            eligibleStake[i] = stakingVault.totalStaked();
        }

        _upgradeProxy(treasuryProxy, address(treasuryImpl));
        factory.setStakingVaultImpl(address(vaultImpl));

        bytes32 saleKind = factory.KIND_SALE_CLASSIC_V1();
        factory.setModuleKindSelectors(saleKind, SaleClassicHelper.selectors());
        factory.approveModuleImpl(saleKind, address(saleImpl), true);
        _updateDefaultSale(factory, saleKind, address(saleImpl));

        for (uint256 i; i < expectedCampaignCount; ++i) {
            (address campaign,,, address vault,,,) = factory.campaigns(i);
            _upgradeProxy(vault, address(vaultImpl));

            GrowfiStakingVault stakingVault = GrowfiStakingVault(vault);
            if (!stakingVault.seasonStakeAccountingInitialized()) {
                factory.initializeCampaignSeasonStakeAccounting(i, eligibleStake[i]);
            }
            require(stakingVault.currentSeasonStaked() == eligibleStake[i], "eligible stake mismatch");
            require(stakingVault.totalStaked() == eligibleStake[i], "total stake changed");

            (address currentSale,, string memory metadataURI,,) =
                GrowfiCampaign(payable(campaign)).moduleSlot(TYPE_SALE);
            if (currentSale != address(saleImpl)) {
                factory.replaceCampaignModule(campaign, TYPE_SALE, saleKind, address(saleImpl), metadataURI);
            }
        }

        for (uint256 i; i < expectedCampaignCount; ++i) {
            address oldSale = oldSaleImpls[i];
            if (oldSale == address(0) || oldSale == address(saleImpl)) continue;
            bool alreadyRevoked;
            for (uint256 j; j < i; ++j) {
                if (oldSaleImpls[j] == oldSale) alreadyRevoked = true;
            }
            if (!alreadyRevoked) factory.approveModuleImpl(saleKind, oldSale, false);
        }

        for (uint256 i; i < expectedCampaignCount; ++i) {
            factory.unpauseCampaign(i);
            (address campaign,,, address vault,,,) = factory.campaigns(i);
            require(!GrowfiCampaign(payable(campaign)).paused(), "campaign unpause failed");
            require(!GrowfiStakingVault(vault).paused(), "vault unpause failed");
        }

        if (forkSimulation) {
            vm.stopPrank();
        } else {
            vm.stopBroadcast();
        }

        console.log("=== GrowFi mainnet security rollout prepared ===");
        console.log("Owner EOA:                  ", deployer);
        console.log("Factory proxy:              ", factoryProxy);
        console.log("Old Factory impl:           ", oldFactoryImpl);
        console.log("New Factory impl:           ", address(factoryImpl));
        console.log("Treasury proxy:             ", treasuryProxy);
        console.log("Old Treasury impl:          ", oldTreasuryImpl);
        console.log("New Treasury impl:          ", address(treasuryImpl));
        console.log("New StakingVault impl:      ", address(vaultImpl));
        console.log("New SaleClassic impl:       ", address(saleImpl));
        console.log("Campaign count:             ", expectedCampaignCount);
        console.log("Fork simulation:            ", forkSimulation);
        for (uint256 i; i < expectedCampaignCount; ++i) {
            console.log("Campaign index:             ", i);
            console.log("Eligible stake migrated:    ", eligibleStake[i]);
            console.log("Old StakingVault impl:      ", oldVaultImpls[i]);
            console.log("Old SaleClassic impl:       ", oldSaleImpls[i]);
        }
    }

    function _updateDefaultSale(GrowfiCampaignFactory factory, bytes32 saleKind, address saleImpl) internal {
        uint256 n = factory.defaultModulesLength();
        ModuleRegistry.DefaultModule[] memory defaults = new ModuleRegistry.DefaultModule[](n);
        bool found;
        for (uint256 i; i < n; ++i) {
            defaults[i] = factory.defaultModuleAt(i);
            if (defaults[i].moduleType == TYPE_SALE) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_SALE, kind: saleKind, impl: saleImpl, metadataURI: defaults[i].metadataURI
                });
                found = true;
            }
        }
        require(found, "default sale module missing");
        factory.setDefaultModules(defaults);
    }

    function _upgradeProxy(address proxy, address implementation) internal {
        ProxyAdmin(_proxyAdmin(proxy)).upgradeAndCall(ITransparentUpgradeableProxy(proxy), implementation, bytes(""));
    }

    function _requireProxyAdminOwner(address proxy, address expectedOwner) internal view {
        require(ProxyAdmin(_proxyAdmin(proxy)).owner() == expectedOwner, "unexpected proxy admin owner");
    }

    function _proxyAdmin(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967_ADMIN_SLOT))));
    }

    function _implementation(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967_IMPLEMENTATION_SLOT))));
    }
}
