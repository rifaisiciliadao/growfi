// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {IGrowfiCampaignFull} from "../src/interfaces/IGrowfiCampaignFull.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";
import {RepaymentModule} from "../src/modules/RepaymentModule.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @title CreateRepaymentCampaignSepolia
/// @notice Adds a third Sepolia demo campaign with RepaymentModule attached,
///         initialized, and funded so the frontend can render the repayment UI.
contract CreateRepaymentCampaignSepolia is Script {
    bytes32 internal constant REPAY_KIND = keccak256("growfi.repayment.v1");
    bytes32 internal constant REPAY_TYPE = keccak256("growfi.type.repayment");

    uint256 internal constant PRICE_PER_CT_USD18 = 0.1e18;
    uint256 internal constant FIXED_USDC6_PER_CT = 100_000;
    uint256 internal constant BONUS_USDC6_PER_CT = 5_000;
    uint256 internal constant SELF_BUY_USDC6 = 120e6;
    uint256 internal constant REPAYMENT_POOL_USDC6 = 2_000e6;

    function run() public {
        require(block.chainid == 11_155_111, "Sepolia only");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        GrowfiCampaignFactory factory = GrowfiCampaignFactory(vm.envAddress("FACTORY_ADDRESS"));
        MockUSDC usdc = MockUSDC(vm.envAddress("USDC_ADDRESS"));
        address repaymentImpl = vm.envAddress("REPAYMENT_IMPL");

        vm.startBroadcast(deployerPk);

        usdc.mint(deployer, 25_000e6);

        address campaign = factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: deployer,
                campaignTokenName: "Repayment Vineyard Demo",
                campaignTokenSymbol: "RPAY",
                yieldTokenName: "Repayment Vineyard Yield",
                yieldTokenSymbol: "rYIELD",
                minProductClaim: 1e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: PRICE_PER_CT_USD18,
                    minCap: 100e18,
                    maxCap: 250_000e18,
                    fundingDeadline: block.timestamp + 30 days,
                    seasonDuration: 7 days,
                    fundingFeeBps: 0,
                    sequencerUptimeFeed: address(0),
                    growMinter: address(0)
                }),
                collateral: CollateralModule.InitParams({
                    expectedAnnualHarvestUsd: 6_000e18,
                    expectedAnnualHarvest: 700e18,
                    firstHarvestYear: 2030,
                    coverageHarvests: 0
                })
            })
        );

        IGrowfiCampaignFull c = IGrowfiCampaignFull(payable(campaign));
        c.addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, FIXED_USDC6_PER_CT, address(0));

        usdc.approve(campaign, type(uint256).max);
        c.buy(address(usdc), SELF_BUY_USDC6);
        c.startSeason();

        GrowfiCampaign(payable(campaign)).attachModule(
            REPAY_TYPE, REPAY_KIND, repaymentImpl, "ipfs://growfi-repayment-demo"
        );
        RepaymentModule(payable(campaign)).initializeRepaymentByProducer(BONUS_USDC6_PER_CT);
        RepaymentModule(payable(campaign)).fundPool(REPAYMENT_POOL_USDC6);

        try factory.addGrowfiTreasuryTrackedCampaign(campaign) {} catch {}

        vm.stopBroadcast();

        console.log("");
        console.log("=== Sepolia repayment campaign complete ===");
        console.log("Campaign:          ", campaign);
        console.log("Campaign token:    ", c.campaignToken());
        console.log("Staking vault:     ", c.stakingVault());
        console.log("Harvest manager:   ", c.harvestManager());
        console.log("State:             ", uint8(c.state()), "(1=Active)");
        console.log("Current supply:    ", c.currentSupply());
        console.log("Current season:    ", c.currentSeasonId());
        console.log("Repayment pool:    ", RepaymentModule(payable(campaign)).poolBalance());
        console.log("Repayment payout/CT:", RepaymentModule(payable(campaign)).payoutPerCt());
        console.log("Deployer RPAY:     ", IERC20(c.campaignToken()).balanceOf(deployer));
    }
}
