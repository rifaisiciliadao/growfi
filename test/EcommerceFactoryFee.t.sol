// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {IGrowfiCampaignFull} from "../src/interfaces/IGrowfiCampaignFull.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";
import {EcommerceModule} from "../src/modules/EcommerceModule.sol";

import {Deployer} from "./helpers/Deployer.sol";
import {MockERC20} from "./helpers/MockERC20.sol";
import {EcommerceHelper} from "./modules/EcommerceHelper.sol";

contract EcommerceFactoryFeeTest is Test {
    bytes32 internal constant ECOMMERCE_KIND = keccak256("growfi.ecommerce.v1");
    bytes32 internal constant ECOMMERCE_TYPE = keccak256("growfi.type.ecommerce");
    bytes32 internal constant SKU = keccak256("olive-oil-500ml");
    bytes32 internal constant ORDER_HASH = keccak256("order:alice:factory-fee");

    address internal constant OWNER = address(0xF000);
    address internal constant PRODUCER = address(0xA1);
    address internal constant ALICE = address(0xA2);
    address internal constant FEE_RECIPIENT = address(0xFEE);

    GrowfiCampaignFactory internal factory;
    MockERC20 internal usdc;
    EcommerceModule internal ecommerceImpl;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        factory = Deployer.deployProtocol(OWNER, FEE_RECIPIENT, address(usdc), address(0));
        ecommerceImpl = new EcommerceModule();

        vm.startPrank(OWNER);
        factory.setMinSeasonDuration(1 hours);
        factory.setModuleKindSelectors(ECOMMERCE_KIND, EcommerceHelper.selectors());
        factory.approveModuleImpl(ECOMMERCE_KIND, address(ecommerceImpl), true);
        vm.stopPrank();
    }

    function test_factoryControlsEcommerceFeeForAttachedCampaigns() public {
        address campaign = _createAndActivateCampaign();

        vm.startPrank(PRODUCER);
        GrowfiCampaign(payable(campaign))
            .attachModule(ECOMMERCE_TYPE, ECOMMERCE_KIND, address(ecommerceImpl), "growfi://ecommerce/v1");
        EcommerceModule(payable(campaign)).initializeEcommerceByProducer(999, "growfi://catalog");
        EcommerceModule(payable(campaign)).setSku(SKU, 25e6, 10, true);
        vm.expectRevert(EcommerceModule.ProtocolFeeFixed.selector);
        EcommerceModule(payable(campaign)).setProtocolFeeBps(0);
        vm.stopPrank();

        assertEq(EcommerceModule(payable(campaign)).protocolFeeBps(), 300);

        vm.prank(OWNER);
        factory.setEcommerceProtocolFeeBps(450);

        assertEq(EcommerceModule(payable(campaign)).protocolFeeBps(), 450);

        (uint256 gross, uint256 fee, uint256 repayment, uint256 net) =
            EcommerceModule(payable(campaign)).quoteSku(SKU, 2);
        assertEq(gross, 50e6);
        assertEq(fee, 2_250_000);
        assertEq(repayment, 0);
        assertEq(net, 47_750_000);

        uint256 feeRecipientBefore = usdc.balanceOf(FEE_RECIPIENT);
        uint256 producerBefore = usdc.balanceOf(PRODUCER);

        usdc.mint(ALICE, 50e6);
        vm.startPrank(ALICE);
        usdc.approve(campaign, 50e6);
        EcommerceModule(payable(campaign)).buySku(SKU, 2, ORDER_HASH);
        vm.stopPrank();

        assertEq(usdc.balanceOf(FEE_RECIPIENT) - feeRecipientBefore, 2_250_000);
        assertEq(usdc.balanceOf(PRODUCER) - producerBefore, 47_750_000);
    }

    function test_factoryRejectsEcommerceFeeAboveCap() public {
        vm.prank(OWNER);
        vm.expectRevert(GrowfiCampaignFactory.InvalidEcommerceProtocolFee.selector);
        factory.setEcommerceProtocolFeeBps(1_001);
    }

    function _createAndActivateCampaign() internal returns (address campaign) {
        vm.prank(PRODUCER);
        campaign = factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: PRODUCER,
                campaignTokenName: "Factory Fee Olive",
                campaignTokenSymbol: "FFO",
                yieldTokenName: "Factory Fee Yield",
                yieldTokenSymbol: "yFFO",
                minProductClaim: 1e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: 1e18,
                    minCap: 50e18,
                    maxCap: 100e18,
                    fundingDeadline: block.timestamp + 30 days,
                    seasonDuration: 1 hours,
                    fundingFeeBps: 0,
                    sequencerUptimeFeed: address(0),
                    growMinter: address(0)
                }),
                collateral: CollateralModule.InitParams({
                    expectedAnnualHarvestUsd: 5_000e18,
                    expectedAnnualHarvest: 250e18,
                    firstHarvestYear: 2030,
                    coverageHarvests: 0
                })
            })
        );

        vm.prank(PRODUCER);
        IGrowfiCampaignFull(payable(campaign))
            .addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, 1e6, address(0));

        usdc.mint(ALICE, 50e6);
        vm.startPrank(ALICE);
        usdc.approve(campaign, 50e6);
        IGrowfiCampaignFull(payable(campaign)).buy(address(usdc), 50e6);
        vm.stopPrank();

        vm.prank(PRODUCER);
        IGrowfiCampaignFull(payable(campaign)).activateCampaign();
    }
}
