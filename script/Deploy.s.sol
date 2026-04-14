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

        vm.startBroadcast();

        CampaignFactory factory = new CampaignFactory(owner, feeRecipient, usdc);

        vm.stopBroadcast();

        console.log("CampaignFactory deployed at:", address(factory));
        console.log("  Owner:", owner);
        console.log("  Fee recipient:", feeRecipient);
        console.log("  USDC:", usdc);
    }
}
