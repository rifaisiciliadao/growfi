// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";

/// @title UpgradeFactoryV2 — deploy new impl + upgrade the existing TransparentUpgradeableProxy
/// @notice Reads the ProxyAdmin address from the ERC-1967 admin slot of the factory proxy,
///         deploys a new CampaignFactory implementation, and calls
///         `ProxyAdmin.upgradeAndCall(proxy, newImpl, initializeV2())` so the new field
///         `minSeasonDuration` gets seeded to 30 days. Then relaxes it via
///         `setMinSeasonDuration(MIN_SEASON_SECONDS)` for testnet use.
///
/// Env required:
///   PRIVATE_KEY        — factory owner (= ProxyAdmin owner)
///   FACTORY_ADDRESS    — deployed factory proxy
///   MIN_SEASON_SECONDS — new minSeasonDuration value (e.g. 3600 for 1 hour)
contract UpgradeFactoryV2 is Script {
    bytes32 private constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address factoryProxy = vm.envAddress("FACTORY_ADDRESS");
        uint256 minSeasonSeconds = vm.envUint("MIN_SEASON_SECONDS");

        // 1. Read the ProxyAdmin address from the ERC-1967 admin slot.
        address proxyAdmin = address(uint160(uint256(vm.load(factoryProxy, ERC1967_ADMIN_SLOT))));
        console.log("--- UpgradeFactoryV2 ---");
        console.log("factory proxy      :", factoryProxy);
        console.log("proxy admin        :", proxyAdmin);
        console.log("min season (new)   :", minSeasonSeconds);

        vm.startBroadcast(pk);

        // 2. Deploy the new implementation.
        CampaignFactory newImpl = new CampaignFactory();
        console.log("new factory impl   :", address(newImpl));

        // 3. Upgrade + reinitialize via ProxyAdmin.
        bytes memory initV2 = abi.encodeCall(CampaignFactory.initializeV2, ());
        ProxyAdmin(proxyAdmin).upgradeAndCall(ITransparentUpgradeableProxy(factoryProxy), address(newImpl), initV2);
        console.log("upgradeAndCall ok");

        // 4. Relax minSeasonDuration for testnet.
        CampaignFactory(factoryProxy).setMinSeasonDuration(minSeasonSeconds);
        console.log("minSeasonDuration  :", CampaignFactory(factoryProxy).minSeasonDuration());

        vm.stopBroadcast();

        console.log("--- done ---");
    }
}
