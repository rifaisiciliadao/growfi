// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {GrowfiProducerRegistry} from "../src/GrowfiProducerRegistry.sol";
import {GrowfiProducerRegistryV2} from "../src/GrowfiProducerRegistryV2.sol";

contract GrowfiProducerRegistryV2Test is Test {
    address internal constant OWNER = address(0xA11CE);
    address internal constant PRODUCER = address(0xB0B);
    address internal constant MIGRATOR = address(0xCAFE);

    GrowfiProducerRegistry internal legacy;
    GrowfiProducerRegistryV2 internal registry;

    function setUp() public {
        legacy = new GrowfiProducerRegistry(OWNER);
        vm.prank(PRODUCER);
        legacy.setProfile("https://example.com/profile-v1.json");
        vm.prank(PRODUCER);
        legacy.setProfile("https://example.com/profile-v2.json");

        vm.prank(OWNER);
        legacy.grantKycAdmin(OWNER);
        vm.warp(1_234_567);
        vm.prank(OWNER);
        legacy.setKyc(PRODUCER, true);

        registry = new GrowfiProducerRegistryV2(OWNER, address(legacy));
    }

    function test_migrateLegacyProducer_preservesProfileVersionAndKyc() public {
        vm.prank(MIGRATOR);
        registry.migrateLegacyProducer(PRODUCER);

        assertTrue(registry.legacyProducerMigrated(PRODUCER));
        assertEq(registry.profileURI(PRODUCER), "https://example.com/profile-v2.json");
        assertEq(registry.version(PRODUCER), 2);
        assertTrue(registry.kyced(PRODUCER));
        assertEq(registry.kycSetAt(PRODUCER), 1_234_567);

        vm.prank(PRODUCER);
        registry.setProfile("https://example.com/profile-v3.json");
        assertEq(registry.version(PRODUCER), 3);
    }

    function test_migrateLegacyProducer_cannotOverwriteOrImportMissingProducer() public {
        registry.migrateLegacyProducer(PRODUCER);

        vm.expectRevert(GrowfiProducerRegistry.NoChange.selector);
        registry.migrateLegacyProducer(PRODUCER);

        vm.expectRevert(GrowfiProducerRegistry.NoChange.selector);
        registry.migrateLegacyProducer(address(0xDEAD));
    }

    function test_constructor_rejectsWrongOwnerOrNonContract() public {
        vm.expectRevert(GrowfiProducerRegistryV2.InvalidLegacyRegistry.selector);
        new GrowfiProducerRegistryV2(address(0xBAD), address(legacy));

        vm.expectRevert(GrowfiProducerRegistryV2.InvalidLegacyRegistry.selector);
        new GrowfiProducerRegistryV2(OWNER, address(0xDEAD));
    }
}
