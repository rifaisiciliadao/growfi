// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {GrowfiToken} from "../../src/GrowfiToken.sol";
import {GrowfiTreasury} from "../../src/GrowfiTreasury.sol";
import {GrowfiMinter} from "../../src/GrowfiMinter.sol";
import {GrowfiFeeSplitter} from "../../src/GrowfiFeeSplitter.sol";
import {MockERC20} from "../helpers/MockERC20.sol";
import {MockOracle} from "../helpers/MockOracle.sol";
import {GrowfiHandler} from "./GrowfiHandler.sol";

/// @notice Property-based invariants on the GROW system. Five core properties:
///   INV-1: total GROW supply never exceeds genesis + sum of all mints
///   INV-2: feeSplitter doesn't hold residual stablecoin between flushes
///          (more precisely: holdings in splitter == sum(donated) - sum(flushed))
///   INV-3: treasury USDC balance == sum of inflows - sum of redeems-out
///          (loose check: balance ≥ 0 by ERC20 invariant; tight check via ghost vars)
///   INV-4: floor price matches stablecoin backing / circulating supply
///   INV-5: circulating supply (totalSupply - treasury holdings) is consistent with
///          burned amounts
contract GrowfiInvariantsTest is Test {
    GrowfiToken token;
    GrowfiTreasury treasury;
    GrowfiMinter minter;
    GrowfiFeeSplitter splitter;
    MockERC20 usdc;
    MockERC20 usdt;
    MockOracle usdFeed;
    GrowfiHandler handler;

    address constant FACTORY = address(0xF000);
    address constant OPS = address(0x0123);
    address constant DEPLOYER = address(0xD000);
    uint256 constant GENESIS = 1_000_000e18;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usdt = new MockERC20("Tether USD", "USDT", 6);
        usdFeed = new MockOracle(int256(1e8), 8);

        // Token
        GrowfiToken tImpl = new GrowfiToken();
        bytes memory tInit =
            abi.encodeCall(GrowfiToken.initialize, ("GrowFi", "GROW", FACTORY, DEPLOYER, GENESIS, 1_000, 1e17));
        token = GrowfiToken(address(new TransparentUpgradeableProxy(address(tImpl), FACTORY, tInit)));

        // Treasury
        GrowfiTreasury trImpl = new GrowfiTreasury();
        bytes memory trInit = abi.encodeCall(GrowfiTreasury.initialize, (FACTORY, address(token)));
        treasury = GrowfiTreasury(address(new TransparentUpgradeableProxy(address(trImpl), FACTORY, trInit)));

        // Minter (not exercised in these invariants but wired for completeness)
        GrowfiMinter mImpl = new GrowfiMinter();
        GrowfiMinter.BondingCurveParams memory params = GrowfiMinter.BondingCurveParams({
            tier1RateBps: 10_000, tier2RateBps: 7_000, tier3RateBps: 4_000, tier2to3ThresholdBps: 5_000
        });
        bytes memory mInit = abi.encodeCall(GrowfiMinter.initialize, (FACTORY, address(token), params));
        minter = GrowfiMinter(address(new TransparentUpgradeableProxy(address(mImpl), FACTORY, mInit)));

        // FeeSplitter
        GrowfiFeeSplitter fsImpl = new GrowfiFeeSplitter();
        bytes memory fsInit = abi.encodeCall(GrowfiFeeSplitter.initialize, (FACTORY, address(treasury), OPS, 3_000));
        splitter = GrowfiFeeSplitter(address(new TransparentUpgradeableProxy(address(fsImpl), FACTORY, fsInit)));

        // Wire (factory acts as admin)
        vm.startPrank(FACTORY);
        token.setMinter(address(minter));
        token.setTreasury(address(treasury));
        treasury.addAcceptedStablecoin(address(usdc), 1e12, address(usdFeed), 24 hours, 9_500, 10_500);
        treasury.addAcceptedStablecoin(address(usdt), 1e12, address(usdFeed), 24 hours, 9_500, 10_500);
        vm.stopPrank();

        // Distribute some genesis to actors so they can interact.
        address[5] memory actors;
        actors[0] = address(0xA1);
        actors[1] = address(0xA2);
        actors[2] = address(0xA3);
        actors[3] = address(0xA4);
        actors[4] = address(0xA5);

        vm.startPrank(DEPLOYER);
        for (uint256 i; i < 5; ++i) {
            token.transfer(actors[i], 100_000e18); // 10K each
        }
        vm.stopPrank();

        handler = new GrowfiHandler(token, treasury, splitter, usdc, usdt, OPS, actors);
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.directBuy.selector;
        selectors[1] = handler.donateToTreasury.selector;
        selectors[2] = handler.redeem.selector;
        selectors[3] = handler.flushSplitter.selector;
        selectors[4] = handler.transferGrow.selector;
        selectors[5] = handler.donateToSplitter.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @notice INV-1: GROW total supply never exceeds genesis + bounded mints from direct buy.
    /// The minter path isn't exercised here (no campaigns), so all mints come from direct buy.
    function invariant_supply_consistent_with_directBuyMints() public view {
        uint256 supply = token.totalSupply();
        // Deployer started with GENESIS, deployer + handlers transferred around. Burns reduce supply.
        // We only mint via direct buy in this fuzz. So:
        //   supply == GENESIS + ghost_totalGrowMintedViaDirectBuy - burnedFromRedeems
        // Burned amount is tracked indirectly through redeem ghost. Loose bound:
        assertGe(GENESIS + handler.ghost_totalGrowMintedViaDirectBuy(), supply, "supply > inflows");
    }

    /// @notice INV-2: The splitter never holds more stablecoin than was donated to it.
    function invariant_splitter_does_not_drain_to_self() public view {
        assertLe(
            usdc.balanceOf(address(splitter)), handler.ghost_totalUsdcDonatedToSplitter(), "splitter USDC > donated"
        );
        assertLe(
            usdt.balanceOf(address(splitter)), handler.ghost_totalUsdtDonatedToSplitter(), "splitter USDT > donated"
        );
    }

    /// @notice INV-3: Treasury's USDC balance is bounded above by the cumulative inflows.
    ///         (Direct buys + donations push USDC in. Redeems take some out, but the ghost
    ///         var doesn't track redeem outflows precisely. Loose check.)
    function invariant_treasury_usdc_bounded_by_inflows() public view {
        uint256 bal = usdc.balanceOf(address(treasury));
        uint256 inflows = handler.ghost_totalUsdcInflowToTreasury();
        // Treasury balance can only be ≤ inflows (it can't pull USDC from elsewhere).
        assertLe(bal, inflows, "treasury USDC > recorded inflows");
    }

    /// @notice INV-4: Floor price equals live stablecoin backing divided by circulating GROW.
    function invariant_floorPrice_nonNegative_andCallable() public view {
        uint256 floor = treasury.intrinsicFloorPrice();
        uint256 totalValue = (usdc.balanceOf(address(treasury)) + usdt.balanceOf(address(treasury))) * 1e12;
        uint256 totalSupply = token.totalSupply();
        uint256 treasuryGrow = token.balanceOf(address(treasury));

        uint256 expectedFloor;
        if (totalValue > 0 && totalSupply > treasuryGrow) {
            expectedFloor = (totalValue * 1e18) / (totalSupply - treasuryGrow);
        }

        assertEq(floor, expectedFloor, "floor != stable backing / circulating supply");
    }

    /// @notice INV-5: Circulating supply (totalSupply - treasury holdings) is non-negative.
    ///         Treasury can never hold more GROW than totalSupply.
    function invariant_circulating_supply_nonNegative() public view {
        uint256 supply = token.totalSupply();
        uint256 treasuryHolds = token.balanceOf(address(treasury));
        assertLe(treasuryHolds, supply, "treasury holds more GROW than totalSupply");
    }

    /// @notice Also a sanity check: splitter never holds GROW (no path to receive it).
    function invariant_splitter_holds_no_grow() public view {
        assertEq(token.balanceOf(address(splitter)), 0);
    }

    function invariant_callSummary() public view {
        // Optional debugging view: uncomment to inspect call distribution.
        // console.log("directBuy:", handler.ghost_directBuyCalls());
        // console.log("redeem:", handler.ghost_redeemCalls());
        // console.log("flush:", handler.ghost_flushCalls());
        // console.log("donate:", handler.ghost_donateCalls());
    }
}
