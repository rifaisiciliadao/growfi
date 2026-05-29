// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {GrowfiCampaignToken} from "../src/GrowfiCampaignToken.sol";
import {GrowfiStakingPool} from "../src/GrowfiStakingPool.sol";
import {GrowfiToken} from "../src/GrowfiToken.sol";
import {GrowfiTreasury} from "../src/GrowfiTreasury.sol";
import {CampaignStorage} from "../src/host/CampaignStorage.sol";
import {IGrowfiCampaignFull} from "../src/interfaces/IGrowfiCampaignFull.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";
import {MockERC20} from "./helpers/MockERC20.sol";
import {MockOracle} from "./helpers/MockOracle.sol";
import {Deployer} from "./helpers/Deployer.sol";

import {EchoModule} from "./host/EchoModule.sol";
import {EchoModule2} from "./host/EchoModule2.sol";
import {TestModuleRegistry} from "./host/TestModuleRegistry.sol";

contract PartialSpendCampaign {
    address public campaignToken;
    uint256 public pricePerToken;
    uint8 public state = 1;
    uint256 public currentSupply;
    uint256 public maxCap = 1_000_000e18;
    uint256 public spendAmount;

    constructor(address campaignToken_, uint256 pricePerToken_, uint256 spendAmount_) {
        campaignToken = campaignToken_;
        pricePerToken = pricePerToken_;
        spendAmount = spendAmount_;
    }

    function buy(address paymentToken, uint256 paymentAmount) external {
        uint256 spend = spendAmount < paymentAmount ? spendAmount : paymentAmount;
        IERC20(paymentToken).transferFrom(msg.sender, address(this), spend);
        MockERC20(campaignToken).mint(msg.sender, 1e18);
        currentSupply += 1e18;
    }
}

contract AuditMitigationsTest is Test {
    address owner = address(this);
    address producer = makeAddr("producer");
    address feeRecipient = makeAddr("feeRecipient");
    address alice = makeAddr("alice");

    function _createCampaign(
        GrowfiCampaignFactory factory,
        string memory name,
        uint256 pricePerToken,
        uint256 minCap,
        uint256 maxCap,
        uint256 expectedAnnualHarvestUsd,
        uint256 coverageHarvests
    ) internal returns (IGrowfiCampaignFull campaign, GrowfiCampaignToken campaignToken) {
        vm.prank(producer);
        factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: producer,
                campaignTokenName: name,
                campaignTokenSymbol: "CT",
                yieldTokenName: "Yield",
                yieldTokenSymbol: "YLD",
                minProductClaim: 1e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: pricePerToken,
                    minCap: minCap,
                    maxCap: maxCap,
                    fundingDeadline: block.timestamp + 30 days,
                    seasonDuration: 365 days,
                    fundingFeeBps: 0,
                    sequencerUptimeFeed: address(0),
                    growMinter: address(0)
                }),
                collateral: CollateralModule.InitParams({
                    expectedAnnualHarvestUsd: expectedAnnualHarvestUsd,
                    expectedAnnualHarvest: 1_000e18,
                    firstHarvestYear: 2030,
                    coverageHarvests: coverageHarvests
                })
            })
        );

        (address c, address ct,,,,,) = factory.campaigns(factory.campaignsLength() - 1);
        campaign = IGrowfiCampaignFull(payable(c));
        campaignToken = GrowfiCampaignToken(ct);
    }

    function test_M01_factoryPolicyBlocksFakePaymentTokenAndMispricing() public {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 fake = new MockERC20("Fake USD", "FAKE", 6);
        GrowfiCampaignFactory factory = Deployer.deployProtocol(owner, feeRecipient, address(usdc), address(0));
        (IGrowfiCampaignFull campaign,) = _createCampaign(factory, "Policy Olive", 1e18, 100e18, 1_000e18, 0, 0);

        vm.prank(producer);
        vm.expectRevert(SaleClassicModule.PaymentTokenNotAllowed.selector);
        campaign.addAcceptedToken(address(fake), SaleClassicModule.PricingMode.Fixed, 1e6, address(0));

        vm.prank(producer);
        vm.expectRevert(SaleClassicModule.InvalidFixedRate.selector);
        campaign.addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, 1, address(0));

        vm.prank(producer);
        campaign.addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, 1e6, address(0));
    }

    function test_M01_factoryPolicyRequiresApprovedOracle() public {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockOracle approvedFeed = new MockOracle(3_000e8, 8);
        MockOracle rogueFeed = new MockOracle(1e8, 8);
        GrowfiCampaignFactory factory = Deployer.deployProtocol(owner, feeRecipient, address(usdc), address(0));
        factory.setCampaignPaymentTokenPolicy(address(weth), true, false, true, address(approvedFeed));
        (IGrowfiCampaignFull campaign,) = _createCampaign(factory, "Oracle Olive", 1e18, 100e18, 1_000e18, 0, 0);

        vm.prank(producer);
        vm.expectRevert(SaleClassicModule.InvalidOracleFeed.selector);
        campaign.addAcceptedToken(address(weth), SaleClassicModule.PricingMode.Oracle, 0, address(rogueFeed));

        vm.prank(producer);
        campaign.addAcceptedToken(address(weth), SaleClassicModule.PricingMode.Oracle, 0, address(approvedFeed));
    }

    function test_M02_activationReleasesOnlyFundingEscrowNotCollateral() public {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        GrowfiCampaignFactory factory = Deployer.deployProtocol(owner, feeRecipient, address(usdc), address(0));
        (IGrowfiCampaignFull campaign,) =
            _createCampaign(factory, "Collateral Olive", 1e18, 100e18, 1_000e18, 1_000e18, 1);

        vm.prank(producer);
        campaign.addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, 1e6, address(0));

        usdc.mint(producer, 1_000e6);
        vm.prank(producer);
        usdc.approve(address(campaign), type(uint256).max);
        vm.prank(producer);
        campaign.lockCollateral(1_000e6);

        usdc.mint(alice, 100e6);
        vm.prank(alice);
        usdc.approve(address(campaign), type(uint256).max);
        vm.prank(alice);
        campaign.buy(address(usdc), 100e6);

        assertEq(uint8(campaign.state()), uint8(CampaignStorage.State.Active));
        assertEq(usdc.balanceOf(address(campaign)), 1_000e6, "collateral swept during activation");
        assertEq(campaign.availableCollateral(), 1_000e6, "collateral accounting changed");
        assertEq(usdc.balanceOf(producer), 97e6, "producer should only receive sale escrow net of fee");
    }

    function test_M04_sellBackDustIsRejectedAndQueueDepthStaysAccurate() public {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        GrowfiCampaignFactory factory = Deployer.deployProtocol(owner, feeRecipient, address(usdc), address(0));
        (IGrowfiCampaignFull campaign, GrowfiCampaignToken campaignToken) =
            _createCampaign(factory, "Sellback Olive", 1e18, 100e18, 1_000e18, 0, 0);

        vm.prank(producer);
        campaign.addAcceptedToken(address(usdc), SaleClassicModule.PricingMode.Fixed, 1e6, address(0));
        usdc.mint(alice, 100e6);
        vm.prank(alice);
        usdc.approve(address(campaign), type(uint256).max);
        vm.prank(alice);
        campaign.buy(address(usdc), 100e6);

        vm.prank(alice);
        campaignToken.approve(address(campaign), type(uint256).max);
        vm.prank(alice);
        vm.expectRevert(SaleClassicModule.SellBackAmountTooSmall.selector);
        campaign.sellBack(1);

        vm.prank(alice);
        campaign.sellBack(1e15);
        assertEq(campaign.getSellBackQueueDepth(), 1e15);

        vm.prank(alice);
        campaign.cancelSellBack();
        assertEq(campaign.getSellBackQueueDepth(), 0);
    }
}

contract TreasuryAllowanceMitigationTest is Test {
    address constant FACTORY = address(0xF000);
    address constant DEPLOYER = address(0xD000);
    uint256 constant ONE_USDC = 1e6;

    GrowfiToken token;
    GrowfiTreasury treasury;
    MockERC20 usdc;
    MockOracle usdFeed;
    MockERC20 campaignToken;
    PartialSpendCampaign campaign;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        campaignToken = new MockERC20("Campaign", "CT", 18);
        usdFeed = new MockOracle(1e8, 8);

        GrowfiToken tokenImpl = new GrowfiToken();
        bytes memory tokenInit =
            abi.encodeCall(GrowfiToken.initialize, ("GrowFi", "GROW", FACTORY, DEPLOYER, 1_000_000e18, 1_000, 1e17));
        token = GrowfiToken(address(new TransparentUpgradeableProxy(address(tokenImpl), FACTORY, tokenInit)));

        GrowfiTreasury treasuryImpl = new GrowfiTreasury();
        bytes memory treasuryInit = abi.encodeCall(GrowfiTreasury.initialize, (FACTORY, address(token)));
        treasury =
            GrowfiTreasury(address(new TransparentUpgradeableProxy(address(treasuryImpl), FACTORY, treasuryInit)));

        campaign = new PartialSpendCampaign(address(campaignToken), 1e18, 1 * ONE_USDC);

        vm.startPrank(FACTORY);
        token.setTreasury(address(treasury));
        treasury.addAcceptedStablecoin(address(usdc), 1e12, address(usdFeed), 24 hours, 9_500, 10_500);
        treasury.addTrackedCampaign(address(campaign));
        vm.stopPrank();

        usdc.mint(address(treasury), 1_000 * ONE_USDC);
    }

    function test_M03_allocateToCampaignClearsAllowanceAfterPartialSpend() public {
        vm.prank(FACTORY);
        treasury.allocateToCampaign(address(campaign), address(usdc), 100 * ONE_USDC);

        assertEq(usdc.allowance(address(treasury), address(campaign)), 0);
        assertEq(campaignToken.balanceOf(address(treasury)), 1e18);
    }

    function test_M03_allocateAcrossTrackedClearsAllowanceAfterPartialSpend() public {
        vm.startPrank(FACTORY);
        treasury.setAutomationEnabled(true);
        treasury.allocateAcrossTracked(address(usdc), 100 * ONE_USDC);
        vm.stopPrank();

        assertEq(usdc.allowance(address(treasury), address(campaign)), 0);
        assertEq(campaignToken.balanceOf(address(treasury)), 1e18);
    }
}

contract StakingPoolMitigationTest is Test {
    address constant FACTORY = address(0xF000);
    address constant TREASURY = address(0xABCD);
    address constant ALICE = address(0xA11CE);
    uint256 constant DURATION = 30 days;

    GrowfiStakingPool pool;
    MockERC20 grow;
    MockERC20 usdc;

    function setUp() public {
        grow = new MockERC20("GrowFi", "GROW", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        GrowfiStakingPool impl = new GrowfiStakingPool();
        bytes memory init =
            abi.encodeCall(GrowfiStakingPool.initialize, (FACTORY, address(grow), address(usdc), TREASURY));
        pool = GrowfiStakingPool(address(new TransparentUpgradeableProxy(address(impl), FACTORY, init)));

        grow.mint(ALICE, 1_000_000e18);
    }

    function _stake(address user, uint256 amount) internal {
        vm.prank(user);
        grow.approve(address(pool), amount);
        vm.prank(user);
        pool.stake(amount);
    }

    function _notify(uint256 amount) internal {
        usdc.mint(address(pool), amount);
        vm.prank(TREASURY);
        pool.notifyReward(amount);
    }

    function test_M05_addingLargeStakeBlendsAgeInsteadOfInstantTwoX() public {
        _stake(ALICE, 1e18);
        skip(365 days);
        _stake(ALICE, 999e18);

        assertEq(pool.balanceOf(ALICE), 1_000e18);
        assertLt(pool.multiplierBps(ALICE), 10_100, "new capital inherited the full old streak");
        assertLt(pool.effectiveBalanceOf(ALICE), 1_010e18, "effective balance too high after weighted-age stake");
    }

    function test_M06_smallRewardsAreCarriedUntilTheyCanStream() public {
        _stake(ALICE, 100e18);

        _notify(1);
        assertEq(pool.rewardRate(), 0);
        assertEq(pool.undistributedRewards(), 1);

        _notify(DURATION - 1);
        assertEq(pool.rewardRate(), 1);
        assertEq(pool.undistributedRewards(), 0);

        skip(DURATION);
        assertEq(pool.earned(ALICE), DURATION);
    }
}

contract ModuleSelectorSnapshotMitigationTest is Test {
    bytes32 internal constant ECHO_KIND = keccak256("growfi.echo.v1");
    bytes32 internal constant ECHO2_KIND = keccak256("growfi.echo2.v1");
    bytes32 internal constant ECHO_TYPE = keccak256("growfi.type.echo");
    bytes32 internal constant ECHO2_TYPE = keccak256("growfi.type.echo2");

    address internal protocolOwner = makeAddr("protocolOwner");
    address internal producer = makeAddr("producer");

    TestModuleRegistry registry;
    GrowfiCampaign campaign;
    EchoModule echoImpl;
    EchoModule2 echo2Impl;

    function setUp() public {
        TestModuleRegistry registryImpl = new TestModuleRegistry();
        bytes memory initData = abi.encodeCall(TestModuleRegistry.initialize, (protocolOwner));
        registry = TestModuleRegistry(
            address(new TransparentUpgradeableProxy(address(registryImpl), protocolOwner, initData))
        );

        echoImpl = new EchoModule();
        echo2Impl = new EchoModule2();

        bytes4[] memory echoSelectors = new bytes4[](1);
        echoSelectors[0] = EchoModule.echo.selector;
        vm.startPrank(protocolOwner);
        registry.setModuleKindSelectors(ECHO_KIND, echoSelectors);
        registry.approveModuleImpl(ECHO_KIND, address(echoImpl), true);
        vm.stopPrank();

        GrowfiCampaign campaignImpl = new GrowfiCampaign();
        GrowfiCampaign.InitParams memory p = GrowfiCampaign.InitParams({
            producer: producer, factory: address(registry), usdc: address(0xCa5), protocolFeeRecipient: address(0xCa6)
        });
        bytes memory campInit = abi.encodeCall(GrowfiCampaign.initialize, (p));
        campaign = GrowfiCampaign(
            payable(address(new TransparentUpgradeableProxy(address(campaignImpl), protocolOwner, campInit)))
        );

        vm.startPrank(address(registry));
        campaign.setYieldToken(address(0xCa2));
        campaign.setHarvestManager(address(0xCa4));
        campaign.setStakingVault(address(0xCa3));
        campaign.setCampaignToken(address(0xCa1));
        campaign.attachModuleAsFactory(ECHO_TYPE, ECHO_KIND, address(echoImpl), "");
        campaign.closeBootstrap();
        vm.stopPrank();
    }

    function test_M08_detachUsesAttachedSelectorSnapshotAfterFactorySelectorMutation() public {
        bytes4[] memory changedSelectors = new bytes4[](1);
        changedSelectors[0] = EchoModule2.ping.selector;
        vm.prank(protocolOwner);
        registry.setModuleKindSelectors(ECHO_KIND, changedSelectors);

        vm.prank(producer);
        campaign.detachModule(ECHO_TYPE);
        assertEq(campaign.selectorToType(EchoModule.echo.selector), bytes32(0), "old selector stayed registered");

        bytes4[] memory echo2Selectors = new bytes4[](1);
        echo2Selectors[0] = EchoModule2.echo.selector;
        vm.startPrank(protocolOwner);
        registry.setModuleKindSelectors(ECHO2_KIND, echo2Selectors);
        registry.approveModuleImpl(ECHO2_KIND, address(echo2Impl), true);
        vm.stopPrank();

        vm.prank(producer);
        campaign.attachModule(ECHO2_TYPE, ECHO2_KIND, address(echo2Impl), "");
        assertEq(campaign.selectorToType(EchoModule2.echo.selector), ECHO2_TYPE);
    }

    function test_M08_factoryCanReplaceModuleForMigration() public {
        bytes4[] memory echo2Selectors = new bytes4[](1);
        echo2Selectors[0] = EchoModule2.ping.selector;
        vm.startPrank(protocolOwner);
        registry.setModuleKindSelectors(ECHO2_KIND, echo2Selectors);
        registry.approveModuleImpl(ECHO2_KIND, address(echo2Impl), true);
        vm.stopPrank();

        vm.prank(address(registry));
        campaign.replaceModuleAsFactory(ECHO_TYPE, ECHO2_KIND, address(echo2Impl), "");

        assertEq(campaign.selectorToType(EchoModule.echo.selector), bytes32(0));
        assertEq(campaign.selectorToType(EchoModule2.ping.selector), ECHO_TYPE);
    }
}
