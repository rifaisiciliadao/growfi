// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import {GrowfiCampaign} from "../../src/GrowfiCampaign.sol";
import {EcommerceModule} from "../../src/modules/EcommerceModule.sol";
import {RepaymentModule} from "../../src/modules/RepaymentModule.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {TestModuleRegistry} from "../host/TestModuleRegistry.sol";
import {EcommerceHelper} from "./EcommerceHelper.sol";
import {RepaymentHelper} from "./RepaymentHelper.sol";

contract EcommerceModuleTest is Test {
    bytes32 internal constant ECOMMERCE_KIND = keccak256("growfi.ecommerce.v1");
    bytes32 internal constant ECOMMERCE_TYPE = keccak256("growfi.type.ecommerce");
    bytes32 internal constant REPAYMENT_KIND = keccak256("growfi.repayment.v1");
    bytes32 internal constant REPAYMENT_TYPE = keccak256("growfi.type.repayment");
    bytes32 internal constant CAMPAIGN_STORAGE_SLOT =
        0x97c54a0bf039447711bcab434c5a40b95f0e18b67d18363706a9ce32d1b0cc6f;
    bytes32 internal constant PROTOCOL_FEE_RECIPIENT_AND_STATE_SLOT = bytes32(uint256(CAMPAIGN_STORAGE_SLOT) + 7);

    bytes32 internal constant SKU = keccak256("olive-oil-500ml");
    bytes32 internal constant ORDER_HASH = keccak256("order:alice:olive-oil-500ml:3");

    address internal protocolOwner = makeAddr("protocolOwner");
    address internal producer = makeAddr("producer");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    TestModuleRegistry internal registry;
    GrowfiCampaign internal campaign;
    EcommerceModule internal ecommerceImpl;
    RepaymentModule internal repaymentImpl;
    MockUSDC internal usdc;

    function setUp() public {
        usdc = new MockUSDC();

        TestModuleRegistry registryImpl = new TestModuleRegistry();
        bytes memory initData = abi.encodeCall(TestModuleRegistry.initialize, (protocolOwner));
        TransparentUpgradeableProxy registryProxy =
            new TransparentUpgradeableProxy(address(registryImpl), protocolOwner, initData);
        registry = TestModuleRegistry(address(registryProxy));

        ecommerceImpl = new EcommerceModule();
        repaymentImpl = new RepaymentModule();
        vm.startPrank(protocolOwner);
        registry.setModuleKindSelectors(ECOMMERCE_KIND, EcommerceHelper.selectors());
        registry.approveModuleImpl(ECOMMERCE_KIND, address(ecommerceImpl), true);
        registry.setModuleKindSelectors(REPAYMENT_KIND, RepaymentHelper.selectors());
        registry.approveModuleImpl(REPAYMENT_KIND, address(repaymentImpl), true);
        vm.stopPrank();

        GrowfiCampaign campaignImpl = new GrowfiCampaign();
        GrowfiCampaign.InitParams memory cp = GrowfiCampaign.InitParams({
            producer: producer, factory: address(registry), usdc: address(usdc), protocolFeeRecipient: feeRecipient
        });
        bytes memory campaignInit = abi.encodeCall(GrowfiCampaign.initialize, (cp));
        TransparentUpgradeableProxy campaignProxy =
            new TransparentUpgradeableProxy(address(campaignImpl), protocolOwner, campaignInit);
        campaign = GrowfiCampaign(payable(address(campaignProxy)));

        vm.prank(address(registry));
        campaign.attachModuleAsFactory(ECOMMERCE_TYPE, ECOMMERCE_KIND, address(ecommerceImpl), "ipfs://ecommerce.json");

        vm.prank(address(registry));
        campaign.closeBootstrap();

        vm.prank(producer);
        _e().initializeEcommerceByProducer(250, "https://cdn.growfi.dev/ecommerce/catalog.json");

        _setActive();

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
    }

    function _e() internal view returns (EcommerceModule) {
        return EcommerceModule(payable(address(campaign)));
    }

    function _setActive() internal {
        _setCampaignState(1);
    }

    function _setFunding() internal {
        _setCampaignState(0);
    }

    function _setCampaignState(uint8 state_) internal {
        uint256 packed = uint256(uint160(feeRecipient)) | (uint256(state_) << 160);
        vm.store(address(campaign), PROTOCOL_FEE_RECIPIENT_AND_STATE_SLOT, bytes32(packed));
    }

    function _setSku(uint256 price, uint256 inventory, bool active) internal {
        vm.prank(producer);
        _e().setSku(SKU, price, inventory, active);
    }

    function _attachRepayment() internal {
        vm.prank(producer);
        campaign.attachModule(REPAYMENT_TYPE, REPAYMENT_KIND, address(repaymentImpl), "ipfs://repayment.json");

        vm.prank(producer);
        _r().initializeRepaymentByProducer(0);
    }

    function _r() internal view returns (RepaymentModule) {
        return RepaymentModule(payable(address(campaign)));
    }

    function test_initializes() public view {
        assertEq(_e().protocolFeeBps(), 300);
        assertEq(_e().repaymentAllocationBps(), 0);
        assertEq(_e().catalogURI(), "https://cdn.growfi.dev/ecommerce/catalog.json");
        assertEq(_e().nextOrderId(), 1);
    }

    function test_initialize_onlyProducer() public {
        vm.prank(alice);
        vm.expectRevert(EcommerceModule.OnlyProducer.selector);
        _e().initializeEcommerceByProducer(0, "");
    }

    function test_setCatalogURI_works() public {
        vm.prank(producer);
        _e().setCatalogURI("https://cdn.example/catalog-v2.json");
        assertEq(_e().catalogURI(), "https://cdn.example/catalog-v2.json");
    }

    function test_setProtocolFee_revertsBecauseFeeIsProtocolFixed() public {
        vm.prank(producer);
        vm.expectRevert(EcommerceModule.ProtocolFeeFixed.selector);
        _e().setProtocolFeeBps(0);
    }

    function test_protocolOwnerCanUpdateGlobalEcommerceFee() public {
        vm.prank(protocolOwner);
        registry.setEcommerceProtocolFeeBps(450);

        assertEq(_e().protocolFeeBps(), 450);

        _setSku(25e6, 10, true);
        (uint256 gross, uint256 fee,, uint256 net) = _e().quoteSku(SKU, 2);
        assertEq(gross, 50e6);
        assertEq(fee, 2_250_000);
        assertEq(net, 47_750_000);
    }

    function test_protocolOwnerCannotSetGlobalEcommerceFeeAboveCap() public {
        vm.prank(protocolOwner);
        vm.expectRevert(TestModuleRegistry.InvalidEcommerceProtocolFee.selector);
        registry.setEcommerceProtocolFeeBps(1_001);
    }

    function test_setRepaymentAllocation_works() public {
        vm.prank(producer);
        _e().setRepaymentAllocationBps(3_000);
        assertEq(_e().repaymentAllocationBps(), 3_000);
    }

    function test_setRepaymentAllocation_rejectsTotalAbove100Percent() public {
        vm.prank(producer);
        vm.expectRevert(EcommerceModule.InvalidRepaymentAllocation.selector);
        _e().setRepaymentAllocationBps(9_701);
    }

    function test_setSku_works() public {
        _setSku(25e6, 10, true);

        EcommerceModule.Sku memory item = _e().sku(SKU);
        assertEq(item.priceUsdc, 25e6);
        assertEq(item.inventory, 10);
        assertEq(item.sold, 0);
        assertTrue(item.active);
        assertTrue(item.exists);
        assertEq(_e().skuCount(), 1);
        assertEq(_e().skuAt(0), SKU);
    }

    function test_setSku_onlyProducer() public {
        vm.prank(alice);
        vm.expectRevert(EcommerceModule.OnlyProducer.selector);
        _e().setSku(SKU, 25e6, 10, true);
    }

    function test_setSku_zeroPrice_reverts() public {
        vm.prank(producer);
        vm.expectRevert(EcommerceModule.ZeroAmount.selector);
        _e().setSku(SKU, 0, 10, true);
    }

    function test_buySku_recordsOrderAndSplitsPayment() public {
        _setSku(25e6, 10, true);

        vm.startPrank(alice);
        usdc.approve(address(campaign), 75e6);
        _e().buySku(SKU, 3, ORDER_HASH);
        vm.stopPrank();

        uint256 gross = 75e6;
        uint256 fee = 2_250_000;
        uint256 net = gross - fee;

        assertEq(usdc.balanceOf(alice), 1_000e6 - gross);
        assertEq(usdc.balanceOf(feeRecipient), fee);
        assertEq(usdc.balanceOf(producer), net);
        assertEq(usdc.balanceOf(address(campaign)), 0);

        EcommerceModule.Sku memory item = _e().sku(SKU);
        assertEq(item.inventory, 7);
        assertEq(item.sold, 3);
        assertEq(_e().grossSales(), gross);
        assertEq(_e().protocolFees(), fee);
        assertEq(_e().repaymentAllocated(), 0);
        assertEq(_e().nextOrderId(), 2);
        assertEq(_e().orderIdByHash(ORDER_HASH), 1);
        assertEq(_e().buyerOrderCount(alice), 1);
        assertEq(_e().buyerOrderAt(alice, 0), 1);

        EcommerceModule.Order memory order = _e().order(1);
        assertEq(order.id, 1);
        assertEq(order.buyer, alice);
        assertEq(order.skuId, SKU);
        assertEq(order.quantity, 3);
        assertEq(order.grossPaid, gross);
        assertEq(order.protocolFee, fee);
        assertEq(order.repaymentAllocated, 0);
        assertEq(order.producerNet, net);
        assertEq(order.orderHash, ORDER_HASH);
    }

    function test_buySku_repaymentAllocationRequiresActiveRepaymentModule() public {
        _setSku(25e6, 10, true);

        vm.prank(producer);
        _e().setRepaymentAllocationBps(5_000);

        vm.startPrank(alice);
        usdc.approve(address(campaign), 25e6);
        vm.expectRevert(EcommerceModule.RepaymentModuleInactive.selector);
        _e().buySku(SKU, 1, ORDER_HASH);
        vm.stopPrank();
    }

    function test_buySku_routesRepaymentAllocationToPool() public {
        _attachRepayment();
        _setSku(25e6, 10, true);

        vm.prank(producer);
        _e().setRepaymentAllocationBps(5_000);

        vm.startPrank(alice);
        usdc.approve(address(campaign), 50e6);
        _e().buySku(SKU, 2, ORDER_HASH);
        vm.stopPrank();

        uint256 gross = 50e6;
        uint256 fee = 1_500_000;
        uint256 repayment = 25e6;
        uint256 net = 23_500_000;

        assertEq(usdc.balanceOf(alice), 1_000e6 - gross);
        assertEq(usdc.balanceOf(feeRecipient), fee);
        assertEq(usdc.balanceOf(producer), net);
        assertEq(usdc.balanceOf(address(campaign)), repayment);
        assertEq(_r().poolBalance(), repayment);
        assertEq(_e().repaymentAllocated(), repayment);

        EcommerceModule.Order memory order = _e().order(1);
        assertEq(order.grossPaid, gross);
        assertEq(order.protocolFee, fee);
        assertEq(order.repaymentAllocated, repayment);
        assertEq(order.producerNet, net);
    }

    function test_buySku_duplicateOrderHash_reverts() public {
        _setSku(25e6, 10, true);

        vm.startPrank(alice);
        usdc.approve(address(campaign), 150e6);
        _e().buySku(SKU, 3, ORDER_HASH);
        vm.expectRevert(EcommerceModule.OrderHashUsed.selector);
        _e().buySku(SKU, 1, ORDER_HASH);
        vm.stopPrank();
    }

    function test_buySku_insufficientInventory_reverts() public {
        _setSku(25e6, 2, true);

        vm.startPrank(alice);
        usdc.approve(address(campaign), 75e6);
        vm.expectRevert(EcommerceModule.InsufficientInventory.selector);
        _e().buySku(SKU, 3, ORDER_HASH);
        vm.stopPrank();
    }

    function test_buySku_inactive_reverts() public {
        _setSku(25e6, 10, false);

        vm.startPrank(alice);
        usdc.approve(address(campaign), 25e6);
        vm.expectRevert(EcommerceModule.SkuInactive.selector);
        _e().buySku(SKU, 1, ORDER_HASH);
        vm.stopPrank();
    }

    function test_buySku_requiresActiveCampaign() public {
        _setSku(25e6, 10, true);
        _setFunding();

        vm.startPrank(alice);
        usdc.approve(address(campaign), 25e6);
        vm.expectRevert(EcommerceModule.InvalidState.selector);
        _e().buySku(SKU, 1, ORDER_HASH);
        vm.stopPrank();
    }

    function test_buySku_rejectsPausedCampaign() public {
        _setSku(25e6, 10, true);

        vm.prank(producer);
        campaign.setPaused(true);

        vm.startPrank(alice);
        usdc.approve(address(campaign), 25e6);
        vm.expectRevert(EcommerceModule.InvalidState.selector);
        _e().buySku(SKU, 1, ORDER_HASH);
        vm.stopPrank();
    }

    function test_quoteSku() public {
        _setSku(25e6, 10, true);
        (uint256 gross, uint256 fee, uint256 repayment, uint256 net) = _e().quoteSku(SKU, 3);
        assertEq(gross, 75e6);
        assertEq(fee, 2_250_000);
        assertEq(repayment, 0);
        assertEq(net, 72_750_000);
    }
}
