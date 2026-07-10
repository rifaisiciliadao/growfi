// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {GrowfiCampaignFactory} from "../../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../../src/GrowfiCampaign.sol";
import {GrowfiCampaignToken} from "../../src/GrowfiCampaignToken.sol";
import {GrowfiYieldToken} from "../../src/GrowfiYieldToken.sol";
import {GrowfiStakingVault} from "../../src/GrowfiStakingVault.sol";
import {GrowfiHarvestManager} from "../../src/GrowfiHarvestManager.sol";
import {CampaignStorage} from "../../src/host/CampaignStorage.sol";
import {SaleClassicModule} from "../../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../../src/modules/CollateralModule.sol";
import {DirectIssueModule} from "../../src/modules/DirectIssueModule.sol";

import {MockERC20} from "../helpers/MockERC20.sol";
import {Deployer} from "../helpers/Deployer.sol";
import {DirectIssueHelper} from "../modules/DirectIssueHelper.sol";

contract SecurityReview20260710Test is Test {
    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant TYPE_DIRECT_ISSUE = keccak256("growfi.type.direct.issue");

    uint256 internal constant PRICE = 0.144e18;
    uint256 internal constant MIN_CAP = 1_000e18;
    uint256 internal constant MAX_CAP = 5_000e18;

    address internal producer = makeAddr("producer");
    address internal alice = makeAddr("alice");
    address internal feeRecipient = makeAddr("feeRecipient");

    MockERC20 internal usdc;
    GrowfiCampaignFactory internal factory;
    DirectIssueModule internal directIssueImpl;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        factory = Deployer.deployProtocol(address(this), feeRecipient, address(usdc), address(0));
        directIssueImpl = new DirectIssueModule();

        factory.setModuleKindSelectors(factory.KIND_DIRECT_ISSUE_V1(), DirectIssueHelper.selectors());
        factory.approveModuleImpl(factory.KIND_DIRECT_ISSUE_V1(), address(directIssueImpl), true);

        usdc.mint(alice, 10_000e6);
    }

    function test_directIssueCanSatisfySoftCapAndReleaseUnderfundedEscrow() public {
        (GrowfiCampaign campaign,,,,) = _createCampaign("Direct issue soft-cap", MIN_CAP, MAX_CAP);

        vm.startPrank(producer);
        campaign.attachModule(TYPE_DIRECT_ISSUE, factory.KIND_DIRECT_ISSUE_V1(), address(directIssueImpl), "");
        vm.stopPrank();

        vm.startPrank(alice);
        usdc.approve(address(campaign), type(uint256).max);
        SaleClassicModule(payable(address(campaign))).buy(address(usdc), 144_000);
        vm.stopPrank();

        vm.prank(producer);
        DirectIssueModule(payable(address(campaign))).issueCampaignTokens(producer, MIN_CAP - 1e18);

        assertEq(SaleClassicModule(payable(address(campaign))).currentSupply(), MIN_CAP);
        assertEq(usdc.balanceOf(address(campaign)), 139_680);

        vm.prank(producer);
        SaleClassicModule(payable(address(campaign))).activateCampaign();

        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Active));
        assertEq(usdc.balanceOf(producer), 139_680);
        assertEq(usdc.balanceOf(address(campaign)), 0);
    }

    function test_inactivePositionsDoNotCreatePhantomYieldOrDiluteHarvestClaims() public {
        (
            GrowfiCampaign campaign,
            GrowfiCampaignToken campaignToken,
            GrowfiYieldToken yieldToken,
            GrowfiStakingVault vault,
            GrowfiHarvestManager harvestManager
        ) = _createCampaign("Phantom yield", MIN_CAP, MAX_CAP);

        vm.startPrank(alice);
        usdc.approve(address(campaign), type(uint256).max);
        SaleClassicModule(payable(address(campaign))).buy(address(usdc), 144e6);
        vm.stopPrank();

        vm.prank(producer);
        SaleClassicModule(payable(address(campaign))).activateCampaign();
        vm.prank(producer);
        campaign.startSeason();

        vm.startPrank(alice);
        campaignToken.approve(address(vault), type(uint256).max);
        uint256 positionId = vault.stake(MIN_CAP);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        vm.prank(producer);
        campaign.endSeason();
        uint256 seasonOneOwed = vault.seasonTotalYieldOwed(1);

        vm.prank(producer);
        campaign.startSeason();
        assertEq(vault.currentSeasonStaked(), 0);
        vm.warp(block.timestamp + 30 days);
        vm.prank(producer);
        campaign.endSeason();

        uint256 seasonTwoOwed = vault.seasonTotalYieldOwed(2);
        assertEq(seasonTwoOwed, 0);
        assertEq(yieldToken.totalSupply(), 0);
        (,,,, uint256 positionSeason,) = vault.positions(positionId);
        assertEq(positionSeason, 1);

        uint256 denominator = harvestManager.redeemableYieldSupply();
        assertEq(denominator, seasonOneOwed);

        vm.prank(producer);
        harvestManager.reportHarvest(2, 100e18, bytes32(0), 100e18, denominator);

        vm.prank(alice);
        vault.claimYield(positionId);
        uint256 realYield = yieldToken.balanceOf(alice);
        assertEq(realYield, seasonOneOwed);

        vm.prank(alice);
        harvestManager.redeemUSDC(2, realYield);
        (,,, uint256 usdcEntitlement,) = harvestManager.claims(2, alice);

        assertEq(usdcEntitlement, 98e18);
    }

    function test_anyoneCanActivateAfterSoftCapAndReleaseBuyerEscrow() public {
        (GrowfiCampaign campaign,,,,) = _createCampaign("Permissionless activation", MIN_CAP, MAX_CAP);

        vm.startPrank(alice);
        usdc.approve(address(campaign), type(uint256).max);
        SaleClassicModule(payable(address(campaign))).buy(address(usdc), 144e6);
        vm.stopPrank();

        vm.prank(alice);
        SaleClassicModule(payable(address(campaign))).activateCampaign();

        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Active));
        assertEq(usdc.balanceOf(address(campaign)), 0);
        assertEq(usdc.balanceOf(producer), 139.68e6);
    }

    function test_producerCanDisableSaleModuleAndBlockBuyback() public {
        (GrowfiCampaign campaign,,,,) = _createCampaign("Disabled refund", MIN_CAP, MAX_CAP);

        vm.startPrank(alice);
        usdc.approve(address(campaign), type(uint256).max);
        SaleClassicModule(payable(address(campaign))).buy(address(usdc), 14.4e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 91 days);
        vm.prank(producer);
        campaign.setModuleEnabled(TYPE_SALE, false);

        vm.expectRevert(GrowfiCampaign.ModuleDisabled.selector);
        SaleClassicModule(payable(address(campaign))).triggerBuyback();
        assertEq(usdc.balanceOf(address(campaign)), 13.968e6);
    }

    function test_raisingSaleMaxCapBreaksVaultMinimumYieldRate() public {
        (GrowfiCampaign campaign, GrowfiCampaignToken campaignToken,, GrowfiStakingVault vault,) =
            _createCampaign("Vault cap drift", 1e18, 1_000e18);

        vm.startPrank(alice);
        usdc.approve(address(campaign), type(uint256).max);
        SaleClassicModule(payable(address(campaign))).buy(address(usdc), 144_000);
        vm.stopPrank();

        vm.startPrank(producer);
        SaleClassicModule(payable(address(campaign))).activateCampaign();
        SaleClassicModule(payable(address(campaign))).setMaxCap(2_000e18);
        vm.stopPrank();

        vm.prank(alice);
        SaleClassicModule(payable(address(campaign))).buy(address(usdc), 158.256e6);

        vm.prank(producer);
        campaign.startSeason();
        vm.startPrank(alice);
        campaignToken.approve(address(vault), type(uint256).max);
        vault.stake(1_100e18);
        vm.stopPrank();

        assertEq(vault.maxSupply(), 1_000e18);
        assertEq(SaleClassicModule(payable(address(campaign))).maxCap(), 2_000e18);
        assertLt(vault.currentYieldRate(), vault.MIN_YIELD_RATE());
    }

    function _createCampaign(string memory name, uint256 minCap, uint256 maxCap)
        internal
        returns (
            GrowfiCampaign campaign,
            GrowfiCampaignToken campaignToken,
            GrowfiYieldToken yieldToken,
            GrowfiStakingVault vault,
            GrowfiHarvestManager harvestManager
        )
    {
        vm.prank(producer);
        address campaignAddress = factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: producer,
                campaignTokenName: name,
                campaignTokenSymbol: "SEC",
                yieldTokenName: string.concat("Yield ", name),
                yieldTokenSymbol: "ySEC",
                minProductClaim: 1e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: PRICE,
                    minCap: minCap,
                    maxCap: maxCap,
                    fundingDeadline: block.timestamp + 90 days,
                    seasonDuration: 365 days,
                    fundingFeeBps: 0,
                    sequencerUptimeFeed: address(0),
                    growMinter: address(0)
                }),
                collateral: CollateralModule.InitParams({
                    expectedAnnualHarvestUsd: 1e18,
                    expectedAnnualHarvest: 1e18,
                    firstHarvestYear: 2027,
                    coverageHarvests: 1
                })
            })
        );

        (address storedCampaign, address ct, address yt, address sv, address hm,,) =
            factory.campaigns(factory.campaignsLength() - 1);
        assertEq(storedCampaign, campaignAddress);

        campaign = GrowfiCampaign(payable(campaignAddress));
        campaignToken = GrowfiCampaignToken(ct);
        yieldToken = GrowfiYieldToken(yt);
        vault = GrowfiStakingVault(sv);
        harvestManager = GrowfiHarvestManager(hm);

        vm.prank(producer);
        SaleClassicModule(payable(campaignAddress))
            .addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, 144_000, address(0));
    }
}
