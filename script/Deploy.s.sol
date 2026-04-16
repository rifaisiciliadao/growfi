// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";

contract DeployScript is Script {
    function run() external {
        // Read deployment config from environment
        address owner = vm.envAddress("OWNER_ADDRESS");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        // Chain-specific L2 sequencer uptime feed. Use address(0) on L1.
        // Arbitrum One: 0xFdB631F5EE196F0ed6FAa767959853A9F217697D
        // Base:         0xBCF85224fc0756B9Fa45aA7892530B47e10b6433
        address sequencerUptimeFeed = vm.envOr("SEQUENCER_UPTIME_FEED", address(0));

        vm.startBroadcast();

        CampaignFactory factory = new CampaignFactory(owner, feeRecipient, usdc, sequencerUptimeFeed);

        vm.stopBroadcast();

        console.log("CampaignFactory deployed at:", address(factory));
        console.log("  Owner:", owner);
        console.log("  Fee recipient:", feeRecipient);
        console.log("  USDC:", usdc);
        console.log("  Sequencer feed:", sequencerUptimeFeed);
    }
}
