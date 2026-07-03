// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {GrowfiCampaignFactory} from "../../src/GrowfiCampaignFactory.sol";
import {CampaignStorage} from "../../src/host/CampaignStorage.sol";
import {ModuleRegistry} from "../../src/host/ModuleRegistry.sol";
import {IGrowfiCampaignFull} from "../../src/interfaces/IGrowfiCampaignFull.sol";
import {GrowfiCampaign} from "../../src/GrowfiCampaign.sol";
import {GrowfiCampaignToken} from "../../src/GrowfiCampaignToken.sol";
import {SaleClassicModule} from "../../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../../src/modules/CollateralModule.sol";
import {CampaignProceedsSplitModule} from "../../src/modules/CampaignProceedsSplitModule.sol";
import {DirectIssueModule} from "../../src/modules/DirectIssueModule.sol";

import {MockERC20} from "../helpers/MockERC20.sol";
import {Deployer} from "../helpers/Deployer.sol";
import {ProceedsSplitHelper} from "./ProceedsSplitHelper.sol";
import {DirectIssueHelper} from "./DirectIssueHelper.sol";

contract ProceedsSplitAndDirectIssueModuleTest is Test {
    bytes32 internal constant TYPE_PROCEEDS_SPLIT = keccak256("growfi.type.proceeds.split");
    bytes32 internal constant TYPE_DIRECT_ISSUE = keccak256("growfi.type.direct.issue");

    uint256 internal constant PRICE_PER_TOKEN = 0.144e18;
    uint256 internal constant MIN_CAP = 1_000e18;
    uint256 internal constant MAX_CAP = 5_000e18;
    uint256 internal constant SEASON_DURATION = 365 days;

    GrowfiCampaignFactory internal factory;
    MockERC20 internal usdc;
    IGrowfiCampaignFull internal campaign;
    GrowfiCampaignToken internal campaignToken;
    address internal campaignAddr;
    CampaignProceedsSplitModule internal proceedsImpl;
    DirectIssueModule internal directIssueImpl;

    address internal owner = address(this);
    address internal producer = makeAddr("producer");
    address internal promoter = makeAddr("promoter");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        factory = Deployer.deployProtocol(owner, feeRecipient, address(usdc), address(0));

        proceedsImpl = new CampaignProceedsSplitModule();
        directIssueImpl = new DirectIssueModule();

        vm.startPrank(owner);
        factory.setModuleKindSelectors(factory.KIND_PROCEEDS_SPLIT_V1(), ProceedsSplitHelper.selectors());
        factory.approveModuleImpl(factory.KIND_PROCEEDS_SPLIT_V1(), address(proceedsImpl), true);
        factory.setModuleKindSelectors(factory.KIND_DIRECT_ISSUE_V1(), DirectIssueHelper.selectors());
        factory.approveModuleImpl(factory.KIND_DIRECT_ISSUE_V1(), address(directIssueImpl), true);
        vm.stopPrank();

        _createCampaign();

        vm.startPrank(producer);
        GrowfiCampaign(payable(campaignAddr))
            .attachModule(TYPE_PROCEEDS_SPLIT, factory.KIND_PROCEEDS_SPLIT_V1(), address(proceedsImpl), "");
        GrowfiCampaign(payable(campaignAddr))
            .attachModule(TYPE_DIRECT_ISSUE, factory.KIND_DIRECT_ISSUE_V1(), address(directIssueImpl), "");
        campaign.addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, 144000, address(0));
        vm.stopPrank();

        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);

        vm.prank(alice);
        usdc.approve(campaignAddr, type(uint256).max);
        vm.prank(bob);
        usdc.approve(campaignAddr, type(uint256).max);
    }

    function test_proceedsSplitRoutesFundingEscrowOnActivation() public {
        vm.prank(producer);
        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(promoter, 2_500);

        vm.prank(alice);
        campaign.buy(address(usdc), 144e6);

        assertEq(usdc.balanceOf(feeRecipient), 4.32e6);
        assertEq(usdc.balanceOf(campaignAddr), 139.68e6);

        vm.prank(producer);
        campaign.activateCampaign();

        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Active));
        assertEq(usdc.balanceOf(campaignAddr), 0);
        assertEq(usdc.balanceOf(producer), 104.76e6);
        assertEq(usdc.balanceOf(promoter), 34.92e6);
    }

    function test_proceedsSplitRoutesActivePrimaryMintsOnly() public {
        vm.prank(alice);
        campaign.buy(address(usdc), 144e6);
        vm.prank(producer);
        campaign.activateCampaign();

        uint256 producerBefore = usdc.balanceOf(producer);
        uint256 promoterBefore = usdc.balanceOf(promoter);
        uint256 feeBefore = usdc.balanceOf(feeRecipient);

        vm.prank(producer);
        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(promoter, 4_000);
        vm.prank(bob);
        campaign.buy(address(usdc), 144e6);

        uint256 net = 144e6 - (144e6 * 300 / 10_000);
        assertEq(usdc.balanceOf(feeRecipient) - feeBefore, 4.32e6);
        assertEq(usdc.balanceOf(producer) - producerBefore, net * 6_000 / 10_000);
        assertEq(usdc.balanceOf(promoter) - promoterBefore, net * 4_000 / 10_000);
        assertEq(campaignToken.balanceOf(bob), 1_000e18);
    }

    function test_proceedsSplitCanRouteAllProducerProceedsToPromoter() public {
        vm.prank(alice);
        campaign.buy(address(usdc), 144e6);
        vm.prank(producer);
        campaign.activateCampaign();

        uint256 producerBefore = usdc.balanceOf(producer);
        uint256 promoterBefore = usdc.balanceOf(promoter);
        uint256 feeBefore = usdc.balanceOf(feeRecipient);

        vm.prank(producer);
        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(promoter, 10_000);

        (bool active,, address configuredPromoter, uint16 promoterBps, uint16 producerBps) =
            CampaignProceedsSplitModule(payable(campaignAddr)).proceedsSplit();
        assertTrue(active);
        assertEq(configuredPromoter, promoter);
        assertEq(promoterBps, 10_000);
        assertEq(producerBps, 0);

        vm.prank(bob);
        campaign.buy(address(usdc), 144e6);

        uint256 net = 144e6 - (144e6 * 300 / 10_000);
        assertEq(usdc.balanceOf(feeRecipient) - feeBefore, 4.32e6);
        assertEq(usdc.balanceOf(producer) - producerBefore, 0);
        assertEq(usdc.balanceOf(promoter) - promoterBefore, net);
    }

    function test_clearProceedsSplitRestoresProducerOnlyRouting() public {
        vm.startPrank(producer);
        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(promoter, 5_000);
        CampaignProceedsSplitModule(payable(campaignAddr)).clearProceedsSplit();
        vm.stopPrank();

        vm.prank(alice);
        campaign.buy(address(usdc), 144e6);
        vm.prank(producer);
        campaign.activateCampaign();

        assertEq(usdc.balanceOf(producer), 139.68e6);
        assertEq(usdc.balanceOf(promoter), 0);
    }

    function test_proceedsSplitOnlyProducer() public {
        vm.prank(alice);
        vm.expectRevert(CampaignProceedsSplitModule.OnlyProducer.selector);
        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(promoter, 2_500);
    }

    function test_proceedsSplitRejectsInvalidConfigAndNoChange() public {
        vm.startPrank(producer);

        vm.expectRevert(CampaignProceedsSplitModule.ZeroAddress.selector);
        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(address(0), 2_500);

        vm.expectRevert(CampaignProceedsSplitModule.InvalidBps.selector);
        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(promoter, 0);

        vm.expectRevert(CampaignProceedsSplitModule.InvalidBps.selector);
        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(promoter, 10_001);

        vm.expectRevert(CampaignProceedsSplitModule.NoChange.selector);
        CampaignProceedsSplitModule(payable(campaignAddr)).clearProceedsSplit();

        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(promoter, 2_500);

        vm.expectRevert(CampaignProceedsSplitModule.NoChange.selector);
        CampaignProceedsSplitModule(payable(campaignAddr)).setProceedsSplit(promoter, 2_500);

        vm.stopPrank();
    }

    function test_directIssueMintsAndUpdatesSaleSupplyWithoutPayment() public {
        vm.prank(producer);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokens(alice, 250e18);

        assertEq(campaignToken.balanceOf(alice), 250e18);
        assertEq(campaign.currentSupply(), 250e18);
        assertEq(usdc.balanceOf(campaignAddr), 0);
        assertEq(usdc.balanceOf(producer), 0);
        assertEq(usdc.balanceOf(feeRecipient), 0);
    }

    function test_directIssueBatchMintsAndCanReachActivationThreshold() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 400e18;
        amounts[1] = 600e18;

        vm.prank(producer);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokensBatch(recipients, amounts);

        assertEq(campaign.currentSupply(), MIN_CAP);
        assertEq(campaignToken.balanceOf(alice), 400e18);
        assertEq(campaignToken.balanceOf(bob), 600e18);

        vm.prank(producer);
        campaign.activateCampaign();

        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Active));
        assertEq(usdc.balanceOf(campaignAddr), 0);
    }

    function test_directIssueRejectsMalformedInputsAtomically() public {
        vm.startPrank(producer);

        vm.expectRevert(DirectIssueModule.ZeroAddress.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokens(address(0), 1e18);

        vm.expectRevert(DirectIssueModule.ZeroAmount.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokens(alice, 0);

        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory oneAmount = new uint256[](1);
        oneAmount[0] = 1e18;

        vm.expectRevert(DirectIssueModule.LengthMismatch.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokensBatch(recipients, oneAmount);

        address[] memory emptyRecipients = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);
        vm.expectRevert(DirectIssueModule.ZeroAmount.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokensBatch(emptyRecipients, emptyAmounts);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1e18;
        amounts[1] = 0;
        vm.expectRevert(DirectIssueModule.ZeroAmount.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokensBatch(recipients, amounts);

        assertEq(campaign.currentSupply(), 0);
        assertEq(campaignToken.balanceOf(alice), 0);
        assertEq(campaignToken.balanceOf(bob), 0);

        vm.stopPrank();
    }

    function test_directIssueDoesNotCreateBuybackRefundEntitlement() public {
        vm.prank(producer);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokens(alice, 250e18);

        assertEq(campaign.purchases(alice, address(usdc)), 0);
        assertEq(campaign.purchasedTokens(alice, address(usdc)), 0);

        vm.warp(block.timestamp + 91 days);
        campaign.triggerBuyback();

        vm.prank(alice);
        vm.expectRevert(SaleClassicModule.NothingToRefund.selector);
        campaign.buyback(address(usdc));

        assertEq(campaignToken.balanceOf(alice), 250e18);
        assertEq(campaign.currentSupply(), 250e18);
    }

    function test_directIssueRejectsNonProducerPausedAndOverCap() public {
        vm.prank(alice);
        vm.expectRevert(DirectIssueModule.OnlyProducer.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokens(alice, 1e18);

        vm.prank(producer);
        GrowfiCampaign(payable(campaignAddr)).setPaused(true);
        vm.prank(producer);
        vm.expectRevert(DirectIssueModule.InvalidState.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokens(alice, 1e18);

        vm.prank(producer);
        GrowfiCampaign(payable(campaignAddr)).setPaused(false);
        vm.prank(producer);
        vm.expectRevert(DirectIssueModule.MaxCapExceeded.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokens(alice, MAX_CAP + 1);
    }

    function test_directIssueRejectsBuybackAndEndedStates() public {
        vm.warp(block.timestamp + 91 days);
        campaign.triggerBuyback();

        vm.prank(producer);
        vm.expectRevert(DirectIssueModule.InvalidState.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokens(alice, 1e18);

        _createCampaign();
        bytes32 directIssueKind = factory.KIND_DIRECT_ISSUE_V1();
        vm.prank(producer);
        GrowfiCampaign(payable(campaignAddr))
            .attachModule(TYPE_DIRECT_ISSUE, directIssueKind, address(directIssueImpl), "");
        vm.prank(producer);
        GrowfiCampaign(payable(campaignAddr)).endCampaign();
        vm.prank(producer);
        vm.expectRevert(DirectIssueModule.InvalidState.selector);
        DirectIssueModule(payable(campaignAddr)).issueCampaignTokens(alice, 1e18);
    }

    function _createCampaign() internal {
        uint256 nonce = factory.campaignsLength();
        vm.prank(producer);
        factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: producer,
                campaignTokenName: string.concat("Campaign ", vm.toString(nonce)),
                campaignTokenSymbol: "CMP",
                yieldTokenName: string.concat("Yield ", vm.toString(nonce)),
                yieldTokenSymbol: "yCMP",
                minProductClaim: 5e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: PRICE_PER_TOKEN,
                    minCap: MIN_CAP,
                    maxCap: MAX_CAP,
                    fundingDeadline: block.timestamp + 90 days,
                    seasonDuration: SEASON_DURATION,
                    fundingFeeBps: 0,
                    sequencerUptimeFeed: address(0),
                    growMinter: address(0)
                }),
                collateral: CollateralModule.InitParams({
                    expectedAnnualHarvestUsd: 5_000e18,
                    expectedAnnualHarvest: 1_000e18,
                    firstHarvestYear: 2030,
                    coverageHarvests: 0
                })
            })
        );

        (address c, address ct,,,,,) = factory.campaigns(nonce);
        campaignAddr = c;
        campaign = IGrowfiCampaignFull(payable(c));
        campaignToken = GrowfiCampaignToken(ct);
    }
}
