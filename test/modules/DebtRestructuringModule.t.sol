// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {GrowfiCampaignFactory} from "../../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../../src/GrowfiCampaign.sol";
import {GrowfiCampaignToken} from "../../src/GrowfiCampaignToken.sol";
import {GrowfiYieldToken} from "../../src/GrowfiYieldToken.sol";
import {GrowfiStakingVault} from "../../src/GrowfiStakingVault.sol";
import {GrowfiHarvestManager} from "../../src/GrowfiHarvestManager.sol";
import {IGrowfiCampaignFull} from "../../src/interfaces/IGrowfiCampaignFull.sol";
import {SaleClassicModule} from "../../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../../src/modules/CollateralModule.sol";
import {DebtRestructuringModule} from "../../src/modules/DebtRestructuringModule.sol";

import {Deployer} from "../helpers/Deployer.sol";
import {MockERC20} from "../helpers/MockERC20.sol";
import {DebtRestructuringHelper} from "./DebtRestructuringHelper.sol";

contract DebtRestructuringModuleTest is Test {
    bytes32 internal constant DEBT_KIND = keccak256("growfi.debt.restructuring.v1");
    bytes32 internal constant DEBT_TYPE = keccak256("growfi.type.debt.restructuring");

    GrowfiCampaignFactory internal factory;
    DebtRestructuringModule internal debtImpl;
    MockERC20 internal usdc;

    address internal protocolOwner = makeAddr("protocolOwner");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal producer = makeAddr("producer");
    address internal alice = makeAddr("alice");

    address internal campaignAddr;
    IGrowfiCampaignFull internal campaign;
    GrowfiCampaignToken internal campaignToken;
    GrowfiYieldToken internal yieldToken;
    GrowfiStakingVault internal stakingVault;
    GrowfiHarvestManager internal harvestManager;

    uint256 internal constant PRICE_PER_TOKEN_USD18 = 0.144e18;
    uint256 internal constant USDC_FIXED_RATE = 144_000;
    uint256 internal constant MIN_CAP = 1_000e18;
    uint256 internal constant MAX_CAP = 50_000e18;

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        factory = Deployer.deployProtocol(protocolOwner, feeRecipient, address(usdc), address(0));

        vm.prank(protocolOwner);
        factory.setMinSeasonDuration(1 hours);

        debtImpl = new DebtRestructuringModule();
        vm.startPrank(protocolOwner);
        factory.setModuleKindSelectors(DEBT_KIND, DebtRestructuringHelper.selectors());
        factory.approveModuleImpl(DEBT_KIND, address(debtImpl), true);
        vm.stopPrank();
    }

    function _createCampaign(uint256 coverageHarvests) internal {
        vm.prank(producer);
        campaignAddr = factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: producer,
                campaignTokenName: coverageHarvests == 0 ? "Debt Olive" : "Covered Debt Olive",
                campaignTokenSymbol: "DOLIVE",
                yieldTokenName: "Debt Olive Yield",
                yieldTokenSymbol: "dYIELD",
                minProductClaim: 1e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: PRICE_PER_TOKEN_USD18,
                    minCap: MIN_CAP,
                    maxCap: MAX_CAP,
                    fundingDeadline: block.timestamp + 30 days,
                    seasonDuration: 7 days,
                    fundingFeeBps: 0,
                    sequencerUptimeFeed: address(0),
                    growMinter: address(0)
                }),
                collateral: CollateralModule.InitParams({
                    expectedAnnualHarvestUsd: 5_000e18,
                    expectedAnnualHarvest: 250e18,
                    firstHarvestYear: 2030,
                    coverageHarvests: coverageHarvests
                })
            })
        );

        campaign = IGrowfiCampaignFull(payable(campaignAddr));
        campaignToken = GrowfiCampaignToken(campaign.campaignToken());
        yieldToken = GrowfiYieldToken(campaign.yieldToken());
        stakingVault = GrowfiStakingVault(campaign.stakingVault());
        harvestManager = GrowfiHarvestManager(campaign.harvestManager());

        vm.prank(producer);
        campaign.addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, USDC_FIXED_RATE, address(0));

        vm.prank(producer);
        GrowfiCampaign(payable(campaignAddr)).attachModule(DEBT_TYPE, DEBT_KIND, address(debtImpl), "ipfs://debt");

        vm.prank(producer);
        DebtRestructuringModule(payable(campaignAddr)).initializeDebtRestructuringByProducer();
    }

    function _activateStartStakeAndReport() internal {
        usdc.mint(alice, 10_000e6);
        vm.startPrank(alice);
        usdc.approve(campaignAddr, type(uint256).max);
        campaignToken.approve(address(stakingVault), type(uint256).max);
        campaign.buy(address(usdc), 1_440e6);
        vm.stopPrank();

        // minCap reached (10_000 CT >= 1_000 minCap) — producer activates explicitly
        vm.prank(producer);
        campaign.activateCampaign();

        vm.prank(producer);
        campaign.startSeason();

        vm.prank(alice);
        stakingVault.stake(10_000e18);

        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        stakingVault.claimYield(0);

        vm.prank(producer);
        campaign.endSeason();

        uint256 expectedTotalYieldSupply = harvestManager.redeemableYieldSupply();
        vm.prank(producer);
        harvestManager.reportHarvest(1, 1_440e18, bytes32(0), 0, expectedTotalYieldSupply);

        uint256 aliceYield = yieldToken.balanceOf(alice);
        vm.prank(alice);
        harvestManager.redeemUSDC(1, aliceYield);
    }

    function _depositHalfBeforeClaimEnd() internal {
        uint256 firstDeposit = harvestManager.remainingDepositGross(1) / 2;
        usdc.mint(producer, firstDeposit);
        vm.startPrank(producer);
        usdc.approve(campaignAddr, firstDeposit);
        campaign.depositUSDC(1, firstDeposit);
        vm.stopPrank();
    }

    function _claimAvailableAndWarpPastDeadline() internal {
        (,,,,, uint256 claimEnd, uint256 usdcDeadline,,,,,) = harvestManager.seasonHarvests(1);
        vm.warp(claimEnd + 1);

        vm.prank(alice);
        harvestManager.claimUSDC(1);

        vm.warp(usdcDeadline + 1);
    }

    function test_claimRestructuredCampaignTokens_mintsCtForUnpaidShortfall() public {
        _createCampaign(0);
        _activateStartStakeAndReport();
        _depositHalfBeforeClaimEnd();
        _claimAvailableAndWarpPastDeadline();

        (,,, uint256 usdcAmount, uint256 usdcClaimedBefore) = harvestManager.claims(1, alice);
        uint256 expectedShortfall = usdcAmount - usdcClaimedBefore;
        uint256 expectedCt = expectedShortfall * 1e18 / PRICE_PER_TOKEN_USD18;
        uint256 currentSupplyBefore = campaign.currentSupply();
        uint256 totalSupplyBefore = campaignToken.totalSupply();

        (uint256 quotedShortfall, uint256 quotedCt) =
            DebtRestructuringModule(payable(campaignAddr)).quoteRestructuredCampaignTokens(1, alice);
        assertEq(quotedShortfall, expectedShortfall);
        assertEq(quotedCt, expectedCt);

        vm.prank(alice);
        uint256 minted = DebtRestructuringModule(payable(campaignAddr)).claimRestructuredCampaignTokens(1);

        assertEq(minted, expectedCt);
        assertEq(campaignToken.balanceOf(alice), expectedCt);
        assertEq(campaignToken.totalSupply(), totalSupplyBefore + expectedCt);
        assertEq(campaign.currentSupply(), currentSupplyBefore + expectedCt);
        assertTrue(DebtRestructuringModule(payable(campaignAddr)).debtRestructuringStarted(1));
        assertEq(DebtRestructuringModule(payable(campaignAddr)).restructuredUsdcShortfall(1, alice), expectedShortfall);
        assertEq(DebtRestructuringModule(payable(campaignAddr)).restructuredCampaignTokensClaimed(1, alice), expectedCt);

        (,,, uint256 usdcAmountAfter, uint256 usdcClaimedAfter) = harvestManager.claims(1, alice);
        assertEq(usdcAmountAfter, usdcAmount);
        assertEq(usdcClaimedAfter, usdcAmount);

        vm.prank(alice);
        vm.expectRevert(GrowfiHarvestManager.NoShortfall.selector);
        DebtRestructuringModule(payable(campaignAddr)).claimRestructuredCampaignTokens(1);
    }

    function test_claimRestructuredCampaignTokens_revertsUntilAvailableUsdcClaimed() public {
        _createCampaign(0);
        _activateStartStakeAndReport();
        _depositHalfBeforeClaimEnd();

        (,,,,, uint256 claimEnd, uint256 usdcDeadline,,,,,) = harvestManager.seasonHarvests(1);
        vm.warp(claimEnd + 1);
        vm.warp(usdcDeadline + 1);

        vm.prank(alice);
        vm.expectRevert(DebtRestructuringModule.ClaimUSDCFirst.selector);
        DebtRestructuringModule(payable(campaignAddr)).claimRestructuredCampaignTokens(1);
    }

    function test_claimRestructuredCampaignTokens_requiresCollateralExhaustedForCoveredSeason() public {
        _createCampaign(1);
        _activateStartStakeAndReport();

        usdc.mint(producer, 1e6);
        vm.startPrank(producer);
        usdc.approve(campaignAddr, 1e6);
        campaign.lockCollateral(1e6);
        vm.stopPrank();

        (,,,,, uint256 claimEnd, uint256 usdcDeadline,,,,,) = harvestManager.seasonHarvests(1);
        vm.warp(usdcDeadline + 1);

        vm.prank(alice);
        vm.expectRevert(DebtRestructuringModule.CollateralAvailable.selector);
        DebtRestructuringModule(payable(campaignAddr)).claimRestructuredCampaignTokens(1);

        campaign.settleSeasonShortfall(1);

        vm.warp(claimEnd + 1);
        vm.prank(alice);
        harvestManager.claimUSDC(1);
        vm.warp(usdcDeadline + 2);

        vm.prank(alice);
        uint256 minted = DebtRestructuringModule(payable(campaignAddr)).claimRestructuredCampaignTokens(1);
        assertGt(minted, 0);

        vm.prank(producer);
        GrowfiCampaign(payable(campaignAddr)).setModuleEnabled(DEBT_TYPE, false);

        usdc.mint(producer, 1e6);
        vm.startPrank(producer);
        usdc.approve(campaignAddr, 1e6);
        campaign.lockCollateral(1e6);
        vm.stopPrank();

        vm.expectRevert(CollateralModule.DebtRestructuringStarted.selector);
        campaign.settleSeasonShortfall(1);
    }
}
