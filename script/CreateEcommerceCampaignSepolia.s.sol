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
import {EcommerceModule} from "../src/modules/EcommerceModule.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

import {RepaymentHelper} from "../test/modules/RepaymentHelper.sol";
import {EcommerceHelper} from "../test/modules/EcommerceHelper.sol";

/// @title CreateEcommerceCampaignSepolia
/// @notice Creates a Sepolia demo campaign with Repayment + Ecommerce attached.
///         The ecommerce module sells one SKU and allocates 10% of each order
///         directly into the grower-funded repayment pool.
contract CreateEcommerceCampaignSepolia is Script {
    bytes32 internal constant REPAY_KIND = keccak256("growfi.repayment.v1");
    bytes32 internal constant REPAY_TYPE = keccak256("growfi.type.repayment");
    bytes32 internal constant ECOMMERCE_KIND = keccak256("growfi.ecommerce.v1");
    bytes32 internal constant ECOMMERCE_TYPE = keccak256("growfi.type.ecommerce");
    bytes32 internal constant SKU_OLIVE_OIL_500ML = keccak256(bytes("olive-oil-500ml"));

    uint256 internal constant PRICE_PER_CT_USD18 = 0.1e18;
    uint256 internal constant FIXED_USDC6_PER_CT = 100_000;
    uint256 internal constant SELF_BUY_USDC6 = 120e6;
    uint256 internal constant REPAYMENT_POOL_USDC6 = 1_000e6;
    uint256 internal constant PRODUCT_PRICE_USDC6 = 18e6;
    uint256 internal constant PRODUCT_INVENTORY = 100;
    uint16 internal constant ECOMMERCE_PROTOCOL_FEE_BPS = 0;
    uint16 internal constant ECOMMERCE_REPAYMENT_BPS = 1_000;

    function run() public {
        require((block.chainid == 11_155_111 || block.chainid == 84_532), "Sepolia only");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        GrowfiCampaignFactory factory = GrowfiCampaignFactory(vm.envAddress("FACTORY_ADDRESS"));
        MockUSDC usdc = MockUSDC(vm.envAddress("USDC_ADDRESS"));
        address repaymentImpl = vm.envOr("REPAYMENT_IMPL", address(0));
        address ecommerceImpl = vm.envOr("ECOMMERCE_IMPL", address(0));

        vm.startBroadcast(deployerPk);

        if (repaymentImpl == address(0)) {
            repaymentImpl = address(new RepaymentModule());
        }
        if (ecommerceImpl == address(0)) {
            ecommerceImpl = address(new EcommerceModule());
        }

        factory.setModuleKindSelectors(REPAY_KIND, RepaymentHelper.selectors());
        factory.approveModuleImpl(REPAY_KIND, repaymentImpl, true);
        factory.setModuleKindSelectors(ECOMMERCE_KIND, EcommerceHelper.selectors());
        factory.approveModuleImpl(ECOMMERCE_KIND, ecommerceImpl, true);

        usdc.mint(deployer, 50_000e6);

        address campaign = factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: deployer,
                campaignTokenName: "Ecommerce Olive Shop Demo",
                campaignTokenSymbol: "ESHOP",
                yieldTokenName: "Ecommerce Olive Yield",
                yieldTokenSymbol: "eYIELD",
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
                    expectedAnnualHarvestUsd: 8_000e18,
                    expectedAnnualHarvest: 1_200e18,
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

        GrowfiCampaign(payable(campaign)).attachModule(REPAY_TYPE, REPAY_KIND, repaymentImpl, "growfi://repayment/v1");
        RepaymentModule(payable(campaign)).initializeRepaymentByProducer(0);
        RepaymentModule(payable(campaign)).fundPool(REPAYMENT_POOL_USDC6);

        GrowfiCampaign(payable(campaign))
            .attachModule(ECOMMERCE_TYPE, ECOMMERCE_KIND, ecommerceImpl, "growfi://ecommerce/v1");
        EcommerceModule(payable(campaign))
            .initializeEcommerceByProducer(ECOMMERCE_PROTOCOL_FEE_BPS, "growfi://pending-ecommerce-catalog");
        EcommerceModule(payable(campaign)).setRepaymentAllocationBps(ECOMMERCE_REPAYMENT_BPS);
        EcommerceModule(payable(campaign)).setSku(SKU_OLIVE_OIL_500ML, PRODUCT_PRICE_USDC6, PRODUCT_INVENTORY, true);

        try factory.addGrowfiTreasuryTrackedCampaign(campaign) {} catch {}

        vm.stopBroadcast();

        console.log("");
        console.log("=== Sepolia ecommerce campaign complete ===");
        console.log("Campaign:                 ", campaign);
        console.log("Campaign token:           ", c.campaignToken());
        console.log("Staking vault:            ", c.stakingVault());
        console.log("Harvest manager:          ", c.harvestManager());
        console.log("Repayment impl:           ", repaymentImpl);
        console.log("Ecommerce impl:           ", ecommerceImpl);
        console.log("SKU olive-oil-500ml:      ");
        console.logBytes32(SKU_OLIVE_OIL_500ML);
        console.log("State:                    ", uint8(c.state()), "(1=Active)");
        console.log("Current supply:           ", c.currentSupply());
        console.log("Current season:           ", c.currentSeasonId());
        console.log("Repayment pool:           ", RepaymentModule(payable(campaign)).poolBalance());
        console.log("Ecommerce price:          ", PRODUCT_PRICE_USDC6);
        console.log("Ecommerce repayment bps:  ", ECOMMERCE_REPAYMENT_BPS);
        console.log("Deployer ESHOP:           ", IERC20(c.campaignToken()).balanceOf(deployer));
        console.log("");
        console.log("Frontend env:");
        console.log("  NEXT_PUBLIC_ECOMMERCE_IMPL=", ecommerceImpl);
    }
}
