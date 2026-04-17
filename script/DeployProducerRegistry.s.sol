// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ProducerRegistry} from "../src/ProducerRegistry.sol";

/// @notice Deploys ProducerRegistry. Zero-arg constructor, nothing to
///         wire — it's a standalone public read/write registry.
///
/// Usage:
///   forge script script/DeployProducerRegistry.s.sol \
///     --rpc-url https://sepolia.base.org --broadcast --verify
contract DeployProducerRegistryScript is Script {
    function run() external {
        vm.startBroadcast();
        ProducerRegistry registry = new ProducerRegistry();
        vm.stopBroadcast();

        console.log("ProducerRegistry deployed at:", address(registry));
    }
}
