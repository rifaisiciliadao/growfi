// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {Campaign} from "../src/Campaign.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";

/// @title UpgradeFundingFee — roll out the 3% per-`buy()` funding fee to live campaigns
/// @notice Deploys a fresh Campaign impl + fresh Factory impl. Upgrades the
///         factory proxy (no reinitializer — factory storage is unchanged;
///         the new impl only differs in that `createCampaign` now passes
///         FUNDING_FEE_BPS to `Campaign.initialize`). Points the factory at
///         the new Campaign impl for future campaigns. For every listed
///         existing Campaign proxy, upgrades it with
///         `upgradeAndCall(proxy, newImpl, initializeV2(FUNDING_FEE_BPS))` so
///         the new `fundingFeeBps` storage slot gets seeded to 300 atomically.
///
/// Env required:
///   PRIVATE_KEY        — signer. Must own BOTH the factory's ProxyAdmin and
///                        each campaign's ProxyAdmin (for testnet this is
///                        the same deployer/producer wallet).
///   FACTORY_ADDRESS    — deployed factory proxy.
///   CAMPAIGN_PROXIES   — comma-separated list of existing Campaign proxy
///                        addresses to upgrade. Can be empty (for factory-only
///                        rollout before any campaigns have been deployed).
///   FUNDING_FEE_BPS    — basis-points value to seed (e.g. 300 for 3%).
contract UpgradeFundingFeeScript is Script {
    bytes32 private constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address factoryProxy = vm.envAddress("FACTORY_ADDRESS");
        address[] memory campaignProxies = vm.envOr("CAMPAIGN_PROXIES", ",", new address[](0));
        uint256 fundingFeeBps = vm.envUint("FUNDING_FEE_BPS");

        address factoryProxyAdmin = address(uint160(uint256(vm.load(factoryProxy, ERC1967_ADMIN_SLOT))));

        console.log("--- UpgradeFundingFee ---");
        console.log("factory proxy       :", factoryProxy);
        console.log("factory proxyAdmin  :", factoryProxyAdmin);
        console.log("funding fee (bps)   :", fundingFeeBps);
        console.log("campaigns to upgrade:", campaignProxies.length);

        vm.startBroadcast(pk);

        // 1. Deploy fresh impls.
        Campaign newCampaignImpl = new Campaign();
        CampaignFactory newFactoryImpl = new CampaignFactory();
        console.log("new Campaign impl   :", address(newCampaignImpl));
        console.log("new Factory impl    :", address(newFactoryImpl));

        // 2. Upgrade the factory proxy. No reinitializer: factory storage
        //    layout is unchanged in this version — only createCampaign's
        //    Campaign.initialize call signature changed.
        ProxyAdmin(factoryProxyAdmin).upgradeAndCall(
            ITransparentUpgradeableProxy(factoryProxy), address(newFactoryImpl), bytes("")
        );
        console.log("factory upgraded");

        // 3. Repoint the factory at the new Campaign impl so future campaigns
        //    pick up the funding-fee behavior out of the box.
        CampaignFactory(factoryProxy).setCampaignImpl(address(newCampaignImpl));
        console.log("factory.campaignImpl:", address(newCampaignImpl));

        // 4. Upgrade every existing Campaign proxy via its own ProxyAdmin,
        //    atomically seeding `fundingFeeBps` via initializeV2.
        bytes memory initV2 = abi.encodeCall(Campaign.initializeV2, (fundingFeeBps));
        for (uint256 i = 0; i < campaignProxies.length; i++) {
            address proxy = campaignProxies[i];
            address admin = address(uint160(uint256(vm.load(proxy, ERC1967_ADMIN_SLOT))));
            console.log("campaign proxy      :", proxy);
            console.log(" proxyAdmin         :", admin);
            ProxyAdmin(admin).upgradeAndCall(
                ITransparentUpgradeableProxy(proxy), address(newCampaignImpl), initV2
            );
            console.log(" upgraded + initializeV2");
        }

        vm.stopBroadcast();

        console.log("--- done ---");
    }
}
