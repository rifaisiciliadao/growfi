// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {CampaignStorage} from "../src/host/CampaignStorage.sol";
import {IGrowfiCampaignFull} from "../src/interfaces/IGrowfiCampaignFull.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";

import {MockERC20} from "./helpers/MockERC20.sol";
import {Deployer} from "./helpers/Deployer.sol";

/// @title  SecurityFixes — regression suite for the 2026-06 audit hardening.
/// @notice Locks the new invariants introduced when auto-activation was
///         removed and the producer self-dealing / escrow-brick vectors were
///         closed:
///           - buy() no longer auto-activates; producer must call
///             activateCampaign() explicitly once minCap is reached.
///           - endCampaign() can never strand buyer escrow.
///           - setMinCap() can only be raised, never lowered.
///           - the factory emergency pause cannot be cleared by the producer.
contract SecurityFixesTest is Test {
    GrowfiCampaignFactory factory;
    MockERC20 usdc;

    IGrowfiCampaignFull campaign;

    address owner = address(this); // factory owner in this harness
    address producer = makeAddr("producer");
    address feeRecipient = makeAddr("feeRecipient");
    address alice = makeAddr("alice");
    address attacker = makeAddr("attacker");

    uint256 constant PRICE = 0.144e18;
    uint256 constant MIN_CAP = 500e18;
    uint256 constant MAX_CAP = 1_000e18;
    uint256 constant USDC_FIXED_RATE = 144_000; // 0.144 USDC (6-dec) per CT
    uint256 initialDeadline;

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        factory = Deployer.deployProtocol(owner, feeRecipient, address(usdc), address(0));
        initialDeadline = block.timestamp + 30 days;
        _createCampaign(MIN_CAP, MAX_CAP);

        usdc.mint(alice, 1_000_000e6);
        vm.prank(alice);
        usdc.approve(address(campaign), type(uint256).max);
        usdc.mint(producer, 1_000_000e6);
        vm.prank(producer);
        usdc.approve(address(campaign), type(uint256).max);
    }

    function _createCampaign(uint256 minCap, uint256 maxCap) internal {
        vm.prank(producer);
        factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: producer,
                campaignTokenName: string(abi.encodePacked("Olive", vm.toString(minCap))),
                campaignTokenSymbol: "OLIVE",
                yieldTokenName: "oY",
                yieldTokenSymbol: "oY",
                minProductClaim: 1e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: PRICE,
                    minCap: minCap,
                    maxCap: maxCap,
                    fundingDeadline: block.timestamp + 30 days,
                    seasonDuration: 365 days,
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
        uint256 idx = factory.getCampaignCount() - 1;
        (address c,,,,,,) = factory.campaigns(idx);
        campaign = IGrowfiCampaignFull(payable(c));

        vm.prank(producer);
        campaign.addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, USDC_FIXED_RATE, address(0));
    }

    function _spendFor(uint256 tokens) internal pure returns (uint256) {
        return (tokens * USDC_FIXED_RATE) / 1e18;
    }

    function _buy(address who, uint256 tokens) internal {
        vm.prank(who);
        campaign.buy(address(usdc), _spendFor(tokens));
    }

    // ------------------------------------------------------------------
    // Auto-activation removal
    // ------------------------------------------------------------------

    function test_buyToSoftcap_staysInFunding() public {
        _buy(alice, MIN_CAP);
        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Funding), "still Funding after softcap buy");
    }

    function test_producerActivates_afterSoftcap() public {
        _buy(alice, MIN_CAP);
        vm.prank(producer);
        campaign.activateCampaign();
        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Active), "Active after explicit activation");
    }

    function test_activateBelowSoftcap_reverts() public {
        _buy(alice, MIN_CAP - 1e18);
        vm.prank(producer);
        vm.expectRevert(SaleClassicModule.MinCapNotReached.selector);
        campaign.activateCampaign();
    }

    function test_activateByNonProducer_reverts() public {
        _buy(alice, MIN_CAP);
        vm.prank(attacker);
        vm.expectRevert(SaleClassicModule.OnlyProducer.selector);
        campaign.activateCampaign();
    }

    // ------------------------------------------------------------------
    // endCampaign cannot strand buyer escrow (H2)
    // ------------------------------------------------------------------

    function test_endCampaign_fromFundingWithBuyers_reverts() public {
        _buy(alice, 100e18); // below minCap → still Funding, escrow outstanding
        vm.prank(producer);
        vm.expectRevert(GrowfiCampaign.InvalidState.selector);
        campaign.endCampaign();
    }

    function test_endCampaign_fromEmptyFunding_succeeds() public {
        vm.prank(producer);
        campaign.endCampaign();
        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Ended), "empty Funding can end");
    }

    function test_endCampaign_fromActive_succeeds() public {
        _buy(alice, MIN_CAP);
        vm.prank(producer);
        campaign.activateCampaign();
        vm.prank(producer);
        campaign.endCampaign();
        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Ended), "Active can end");
    }

    function test_endCampaign_fromBuyback_reverts() public {
        _buy(alice, 100e18); // below minCap
        vm.warp(initialDeadline + 1);
        campaign.triggerBuyback();
        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Buyback), "in Buyback");

        vm.prank(producer);
        vm.expectRevert(GrowfiCampaign.InvalidState.selector);
        campaign.endCampaign();
    }

    function test_buyerCanReclaimEscrow_afterBuyback() public {
        _buy(alice, 100e18);
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.warp(initialDeadline + 1);
        campaign.triggerBuyback();
        vm.prank(alice);
        campaign.buyback(address(usdc));
        // Buyback refunds the NET payment; the 3% funding fee skimmed at buy()
        // time is non-refundable by design (FUNDING_FEE_BPS snapshotted by the
        // factory, regardless of the InitParams value).
        uint256 gross = _spendFor(100e18);
        uint256 net = gross - (gross * 300) / 10_000;
        assertEq(usdc.balanceOf(alice), aliceBefore + net, "net escrow refunded (fee non-refundable)");
    }

    // ------------------------------------------------------------------
    // setMinCap is monotonic (M3)
    // ------------------------------------------------------------------

    function test_setMinCap_raise_ok() public {
        vm.prank(producer);
        campaign.setMinCap(MIN_CAP + 100e18);
        assertEq(campaign.minCap(), MIN_CAP + 100e18);
    }

    function test_setMinCap_lower_reverts() public {
        vm.prank(producer);
        vm.expectRevert(SaleClassicModule.MinCapNotIncreased.selector);
        campaign.setMinCap(MIN_CAP - 100e18);
    }

    // ------------------------------------------------------------------
    // Factory emergency pause cannot be cleared by the producer (M5)
    // ------------------------------------------------------------------

    function test_factoryPause_notClearableByProducer() public {
        uint256 idx = factory.getCampaignCount() - 1;

        // Factory owner emergency-pauses the campaign.
        factory.pauseCampaign(idx);
        assertTrue(campaign.paused(), "paused after factory pause");

        // Producer tries to clear it — has no effect on the factory flag.
        vm.prank(producer);
        campaign.setPaused(false);
        assertTrue(campaign.paused(), "still paused: producer cannot clear factory pause");

        // Buying is blocked while paused.
        vm.prank(alice);
        vm.expectRevert(SaleClassicModule.InvalidState.selector);
        campaign.buy(address(usdc), _spendFor(10e18));

        // Only the factory can lift its own pause.
        factory.unpauseCampaign(idx);
        assertFalse(campaign.paused(), "factory cleared its pause");
        _buy(alice, 10e18); // now succeeds
    }

    function test_producerPause_independentOfFactory() public {
        vm.prank(producer);
        campaign.setPaused(true);
        assertTrue(campaign.paused(), "producer paused");
        vm.prank(producer);
        campaign.setPaused(false);
        assertFalse(campaign.paused(), "producer can clear its own pause");
    }
}
