// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CampaignRegistry} from "../src/CampaignRegistry.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";

/// @notice Deploys CampaignRegistry pointing at an existing CampaignFactory.
///
/// Usage:
///   FACTORY=0x3fA41528a22645Bef478E9eBae83981C02e98f74 \
///   forge script script/DeployRegistry.s.sol \
///     --rpc-url https://sepolia.base.org --broadcast --verify
contract DeployRegistryScript is Script {
    function run() external {
        address factoryAddr = vm.envAddress("FACTORY");
        require(factoryAddr != address(0), "FACTORY env var required");

        vm.startBroadcast();
        CampaignRegistry registry = new CampaignRegistry(
            CampaignFactory(factoryAddr)
        );
        vm.stopBroadcast();

        console.log("CampaignRegistry deployed at:", address(registry));
        console.log("  Bound to factory:", factoryAddr);
    }
}
