// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {IGrowfiCampaignFull} from "../src/interfaces/IGrowfiCampaignFull.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";
import {DebtRestructuringModule} from "../src/modules/DebtRestructuringModule.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @title CreateDebtRestructuringCampaignSepolia
/// @notice Adds a demo campaign with the DebtRestructuringModule attached +
///         initialized, so the frontend can render the debt-restructuring UI
///         (holders convert unpaid harvest USDC shortfall into CampaignToken
///         after `usdcDeadline`). Works on Ethereum Sepolia + Base Sepolia.
contract CreateDebtRestructuringCampaignSepolia is Script {
    bytes32 internal constant DEBT_KIND = keccak256("growfi.debt.restructuring.v1");
    bytes32 internal constant DEBT_TYPE = keccak256("growfi.type.debt.restructuring");

    uint256 internal constant PRICE_PER_CT_USD18 = 0.12e18;
    uint256 internal constant FIXED_USDC6_PER_CT = 120_000;
    uint256 internal constant SELF_BUY_USDC6 = 120e6;

    function run() public {
        require((block.chainid == 11_155_111 || block.chainid == 84_532), "Sepolia only");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        GrowfiCampaignFactory factory = GrowfiCampaignFactory(vm.envAddress("FACTORY_ADDRESS"));
        MockUSDC usdc = MockUSDC(vm.envAddress("USDC_ADDRESS"));
        address debtImpl = vm.envAddress("DEBT_RESTRUCTURING_IMPL");

        vm.startBroadcast(deployerPk);

        usdc.mint(deployer, 25_000e6);

        address campaign = factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: deployer,
                campaignTokenName: "Almond Grove Restructure Demo",
                campaignTokenSymbol: "ALMD",
                yieldTokenName: "Almond Grove Yield",
                yieldTokenSymbol: "aYIELD",
                minProductClaim: 1e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: PRICE_PER_CT_USD18,
                    minCap: 100e18,
                    maxCap: 300_000e18,
                    fundingDeadline: block.timestamp + 30 days,
                    seasonDuration: 1 hours,
                    fundingFeeBps: 0,
                    sequencerUptimeFeed: address(0),
                    growMinter: address(0)
                }),
                collateral: CollateralModule.InitParams({
                    expectedAnnualHarvestUsd: 7_000e18,
                    expectedAnnualHarvest: 900e18,
                    firstHarvestYear: 2030,
                    coverageHarvests: 0
                })
            })
        );

        IGrowfiCampaignFull c = IGrowfiCampaignFull(payable(campaign));
        c.addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, FIXED_USDC6_PER_CT, address(0));

        usdc.approve(campaign, type(uint256).max);
        c.buy(address(usdc), SELF_BUY_USDC6);
        c.activateCampaign(); // explicit activation (buy no longer auto-activates)
        c.startSeason();

        // Attach + initialize the debt-restructuring module (producer path).
        GrowfiCampaign(payable(campaign)).attachModule(DEBT_TYPE, DEBT_KIND, debtImpl, "growfi://debt-restructuring/v1");
        DebtRestructuringModule(payable(campaign)).initializeDebtRestructuringByProducer();

        try factory.addGrowfiTreasuryTrackedCampaign(campaign) {} catch {}

        vm.stopBroadcast();

        console.log("");
        console.log("=== Debt-restructuring campaign complete ===");
        console.log("Campaign:        ", campaign);
        console.log("Campaign token:  ", c.campaignToken());
        console.log("State:           ", uint8(c.state()), "(1=Active)");
        console.log("Current supply:  ", c.currentSupply());
        console.log("Current season:  ", c.currentSeasonId());
        (address attachedImpl,,,,) = GrowfiCampaign(payable(campaign)).moduleSlot(DEBT_TYPE);
        console.log("Debt module impl:", attachedImpl);
    }
}
