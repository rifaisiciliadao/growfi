// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {GrowfiTreasury} from "../src/GrowfiTreasury.sol";
import {ModuleRegistry} from "../src/host/ModuleRegistry.sol";

/// @title AuditMainnetImplementations
/// @notice Read-only inventory sourced from live Ethereum storage and code.
contract AuditMainnetImplementations is Script {
    address internal constant FACTORY = 0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2;
    address internal constant EXPECTED_OWNER = 0xA229F3c9851E26fC9eA18157b88cd1CDA6F90e55;
    address internal constant CAMPAIGN_REGISTRY = 0xA3AEb95Ff4555E266aa1366000204a75FaD4142B;
    address internal constant LEGACY_PRODUCER_REGISTRY = 0x651fb29e69Bde3ADE988e8E75e9A3012272D2de5;

    bytes32 internal constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    bytes32 internal constant ERC1967_IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function run() public view {
        require(block.chainid == 1, "Ethereum mainnet only");
        address factoryProxy = vm.envOr("MAINNET_FACTORY_ADDRESS", FACTORY);
        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);
        address owner = factory.owner();

        require(owner == EXPECTED_OWNER, "unexpected live factory owner");
        require(factory.proxyAdminOwner() == owner, "proxyAdminOwner mismatch");

        console.log("=== LIVE MAINNET IMPLEMENTATION INVENTORY ===");
        console.log("Block:", block.number);
        console.log("Factory owner:", owner);
        _logProxy("Factory", factoryProxy, owner);

        console.log("--- Factory implementation pointers for future campaigns ---");
        _logImplementation("Campaign", factory.campaignImpl());
        _logImplementation("CampaignToken", factory.campaignTokenImpl());
        _logImplementation("StakingVault", factory.stakingVaultImpl());
        _logImplementation("YieldToken", factory.yieldTokenImpl());
        _logImplementation("HarvestManager", factory.harvestManagerImpl());

        console.log("--- GROW system proxies ---");
        _logProxy("GrowfiToken", factory.growfiToken(), owner);
        _logProxy("GrowfiMinter", factory.growfiMinter(), owner);
        _logProxy("GrowfiTreasury", factory.growfiTreasury(), owner);
        _logProxy("GrowfiFeeSplitter", factory.growfiFeeSplitter(), owner);
        _logProxy("GrowfiStakingPool", GrowfiTreasury(factory.growfiTreasury()).stakingPool(), owner);

        console.log("--- Default module implementations ---");
        uint256 defaultCount = factory.defaultModulesLength();
        console.log("Default module count:", defaultCount);
        for (uint256 i; i < defaultCount; ++i) {
            ModuleRegistry.DefaultModule memory module_ = factory.defaultModuleAt(i);
            require(module_.impl.code.length != 0, "default module has no code");
            require(factory.approvedModuleImpls(module_.kind, module_.impl), "default module is not approved");
            require(factory.moduleKindSelectors(module_.kind).length != 0, "default module selectors missing");
            _logModule(i, module_.moduleType, module_.kind, module_.impl, true);
        }

        console.log("--- Existing campaign proxy and module implementations ---");
        uint256 campaignCount = factory.getCampaignCount();
        console.log("Campaign count:", campaignCount);
        for (uint256 i; i < campaignCount; ++i) {
            (
                address campaign,
                address campaignToken,
                address yieldToken,
                address stakingVault,
                address harvestManager,
                address producer,
                uint256 createdAt
            ) = factory.campaigns(i);
            console.log("Campaign index:", i);
            console.log("Producer:", producer);
            console.log("Created at:", createdAt);
            _logProxy("Campaign", campaign, owner);
            _logProxy("CampaignToken", campaignToken, owner);
            _logProxy("YieldToken", yieldToken, owner);
            _logProxy("StakingVault", stakingVault, owner);
            _logProxy("HarvestManager", harvestManager, owner);

            GrowfiCampaign campaignView = GrowfiCampaign(payable(campaign));
            uint256 moduleCount = campaignView.moduleTypeCount();
            console.log("Attached module count:", moduleCount);
            for (uint256 j; j < moduleCount; ++j) {
                bytes32 moduleType = campaignView.moduleTypeAt(j);
                (address impl, bytes32 kind,,, bool enabled) = campaignView.moduleSlot(moduleType);
                require(impl.code.length != 0, "campaign module has no code");
                _logModule(j, moduleType, kind, impl, enabled);
            }
        }

        console.log("--- Non-proxy registries ---");
        _logImplementation("CampaignRegistry", CAMPAIGN_REGISTRY);
        _logImplementation("LegacyProducerRegistry", LEGACY_PRODUCER_REGISTRY);
    }

    function _logProxy(string memory label, address proxy, address expectedOwner) internal view {
        require(proxy.code.length != 0, "proxy has no code");
        address implementation = _slotAddress(proxy, ERC1967_IMPLEMENTATION_SLOT);
        address admin = _slotAddress(proxy, ERC1967_ADMIN_SLOT);
        require(implementation.code.length != 0, "implementation has no code");
        require(admin.code.length != 0, "ProxyAdmin has no code");
        require(ProxyAdmin(admin).owner() == expectedOwner, "ProxyAdmin owner mismatch");

        console.log(label);
        console.log("  proxy:", proxy);
        console.log("  implementation:", implementation);
        console.log("  ProxyAdmin:", admin);
        console.log("  implementation codehash:");
        console.logBytes32(implementation.codehash);
    }

    function _logImplementation(string memory label, address implementation) internal view {
        require(implementation.code.length != 0, "implementation has no code");
        console.log(label, implementation);
        console.log("  codehash:");
        console.logBytes32(implementation.codehash);
    }

    function _logModule(uint256 index, bytes32 moduleType, bytes32 kind, address impl, bool enabled) internal view {
        console.log("Module index:", index);
        console.log("  implementation:", impl);
        console.log("  enabled:", enabled);
        console.log("  type:");
        console.logBytes32(moduleType);
        console.log("  kind:");
        console.logBytes32(kind);
        console.log("  codehash:");
        console.logBytes32(impl.codehash);
    }

    function _slotAddress(address target, bytes32 slot) internal view returns (address) {
        return address(uint160(uint256(vm.load(target, slot))));
    }
}
