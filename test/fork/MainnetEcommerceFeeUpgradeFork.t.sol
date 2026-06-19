// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import {GrowfiCampaignFactory} from "../../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../../src/GrowfiCampaign.sol";
import {EcommerceModule} from "../../src/modules/EcommerceModule.sol";

import {EcommerceHelper} from "../modules/EcommerceHelper.sol";

contract MainnetEcommerceFeeUpgradeForkTest is Test {
    address internal constant FACTORY = 0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2;
    address internal constant OLD_ECOMMERCE_IMPL = 0x881883a9fd1c296D198EE9937603E8Eec1AE5E70;

    bytes32 internal constant TYPE_ECOMMERCE = keccak256("growfi.type.ecommerce");
    bytes32 internal constant KIND_ECOMMERCE = keccak256("growfi.ecommerce.v1");
    bytes32 internal constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    bool internal runFork;
    GrowfiCampaignFactory internal factory;

    function setUp() public {
        runFork = vm.envOr("RUN_MAINNET_FORK_TESTS", false);
        if (!runFork) return;

        vm.createSelectFork(vm.envString("RPC_URL"));
        factory = GrowfiCampaignFactory(FACTORY);
    }

    modifier forkOnly() {
        if (!runFork) return;
        _;
    }

    function test_mainnetFork_protocolUpgradeLeavesCampaignUntilProducerMigrates() public forkOnly {
        uint256 campaignCountBefore = factory.getCampaignCount();
        assertEq(campaignCountBefore, 1);

        (address campaignBefore,,,,, address producerBefore,) = factory.campaigns(0);
        GrowfiCampaign campaign = GrowfiCampaign(payable(campaignBefore));
        address ownerBefore = factory.owner();
        address usdcBefore = factory.usdc();
        address proxyAdmin = _proxyAdmin(FACTORY);
        (, bytes32 ecommerceKindBefore, string memory ecommerceMetadataBefore,, bool ecommerceEnabledBefore) =
            campaign.moduleSlot(TYPE_ECOMMERCE);

        assertEq(ProxyAdmin(proxyAdmin).owner(), ownerBefore);
        _assertEcommerceSlot(campaign, OLD_ECOMMERCE_IMPL, ecommerceMetadataBefore);
        assertEq(ecommerceKindBefore, KIND_ECOMMERCE);
        assertTrue(ecommerceEnabledBefore);
        assertEq(EcommerceModule(payable(campaignBefore)).protocolFeeBps(), 0);
        vm.expectRevert();
        factory.ecommerceProtocolFeeBps();

        GrowfiCampaignFactory factoryImpl = new GrowfiCampaignFactory();
        EcommerceModule ecommerceImpl = new EcommerceModule();

        vm.prank(ownerBefore);
        ProxyAdmin(proxyAdmin).upgradeAndCall(ITransparentUpgradeableProxy(FACTORY), address(factoryImpl), bytes(""));

        assertEq(factory.owner(), ownerBefore);
        assertEq(factory.getCampaignCount(), campaignCountBefore);
        assertEq(factory.usdc(), usdcBefore);
        assertEq(factory.ecommerceProtocolFeeBps(), 300);

        vm.prank(ownerBefore);
        factory.setEcommerceProtocolFeeBps(300);
        assertEq(factory.ecommerceProtocolFeeBps(), 300);

        vm.startPrank(ownerBefore);
        factory.setModuleKindSelectors(KIND_ECOMMERCE, EcommerceHelper.selectors());
        factory.approveModuleImpl(KIND_ECOMMERCE, address(ecommerceImpl), true);
        factory.approveModuleImpl(KIND_ECOMMERCE, OLD_ECOMMERCE_IMPL, false);
        vm.stopPrank();

        assertTrue(factory.isModuleImplApproved(KIND_ECOMMERCE, address(ecommerceImpl)));
        assertFalse(factory.isModuleImplApproved(KIND_ECOMMERCE, OLD_ECOMMERCE_IMPL));
        assertGt(factory.moduleKindSelectors(KIND_ECOMMERCE).length, 0);

        (address campaignAfter,,,,,,) = factory.campaigns(0);
        assertEq(campaignAfter, campaignBefore);
        assertEq(campaign.factory(), FACTORY);
        assertEq(campaign.usdc(), usdcBefore);
        _assertEcommerceSlot(campaign, OLD_ECOMMERCE_IMPL, ecommerceMetadataBefore);
        assertEq(EcommerceModule(payable(campaignBefore)).protocolFeeBps(), 0);

        vm.startPrank(producerBefore);
        campaign.detachModule(TYPE_ECOMMERCE);
        campaign.attachModule(TYPE_ECOMMERCE, KIND_ECOMMERCE, address(ecommerceImpl), ecommerceMetadataBefore);
        vm.stopPrank();

        (
            address ecommerceAfter,
            bytes32 ecommerceKindAfter,
            string memory ecommerceMetadataAfter,,
            bool ecommerceEnabledAfter
        ) = campaign.moduleSlot(TYPE_ECOMMERCE);
        assertEq(ecommerceAfter, address(ecommerceImpl));
        assertEq(ecommerceKindAfter, KIND_ECOMMERCE);
        assertEq(ecommerceMetadataAfter, ecommerceMetadataBefore);
        assertTrue(ecommerceEnabledAfter);
        assertEq(EcommerceModule(payable(campaignBefore)).protocolFeeBps(), 300);

        vm.prank(producerBefore);
        vm.expectRevert(EcommerceModule.ProtocolFeeFixed.selector);
        EcommerceModule(payable(campaignBefore)).setProtocolFeeBps(0);
    }

    function _assertEcommerceSlot(GrowfiCampaign campaign, address expectedImpl, string memory expectedMetadata)
        internal
        view
    {
        (address impl, bytes32 kind, string memory metadata,, bool enabled) = campaign.moduleSlot(TYPE_ECOMMERCE);
        assertEq(impl, expectedImpl);
        assertEq(kind, KIND_ECOMMERCE);
        assertEq(metadata, expectedMetadata);
        assertTrue(enabled);
    }

    function _proxyAdmin(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967_ADMIN_SLOT))));
    }
}
