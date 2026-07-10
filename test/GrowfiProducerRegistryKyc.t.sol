// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GrowfiProducerRegistry} from "../src/GrowfiProducerRegistry.sol";

/// @title ProducerRegistryKyc — adversarial coverage for producer trust flags.
/// @notice Pins the trust model: producers self-write profile, but legacy KYC
///         and social attestations are role-gated. A malicious producer cannot
///         self-attest trust status without a verifier authorization.
contract ProducerRegistryKycTest is Test {
    GrowfiProducerRegistry registry;

    address owner = makeAddr("owner");
    address kycAdmin = makeAddr("kycAdmin");
    address otherAdmin = makeAddr("otherAdmin");
    uint256 socialVerifierPk = 0xA11CE;
    uint256 attackerPk = 0xB0B;
    address socialVerifier;
    address producer = makeAddr("producer");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");

    function setUp() public {
        vm.warp(1_700_000_000);
        socialVerifier = vm.addr(socialVerifierPk);
        registry = new GrowfiProducerRegistry(owner);
    }

    // ========================================================================
    // OWNER + 2-step transfer
    // ========================================================================

    function test_initialOwnerSet() public view {
        assertEq(registry.owner(), owner);
    }

    function test_constructor_rejectsZeroOwner() public {
        vm.expectRevert(GrowfiProducerRegistry.ZeroAddress.selector);
        new GrowfiProducerRegistry(address(0));
    }

    function test_transferOwnership_2step() public {
        vm.prank(owner);
        registry.transferOwnership(bob);
        // Until acceptOwnership runs, owner is still `owner`.
        assertEq(registry.owner(), owner);
        assertEq(registry.pendingOwner(), bob);

        vm.prank(bob);
        registry.acceptOwnership();
        assertEq(registry.owner(), bob);
        assertEq(registry.pendingOwner(), address(0));
    }

    function test_attack_acceptOwnership_byNonPending() public {
        vm.prank(owner);
        registry.transferOwnership(bob);
        vm.prank(attacker);
        vm.expectRevert(GrowfiProducerRegistry.NotPendingOwner.selector);
        registry.acceptOwnership();
    }

    function test_attack_transferOwnership_byNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert(GrowfiProducerRegistry.NotOwner.selector);
        registry.transferOwnership(bob);
    }

    // ========================================================================
    // KYC admin grant / revoke
    // ========================================================================

    function test_grantKycAdmin_byOwner() public {
        vm.prank(owner);
        registry.grantKycAdmin(kycAdmin);
        assertTrue(registry.isKycAdmin(kycAdmin));
    }

    function test_attack_grantKycAdmin_byNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert(GrowfiProducerRegistry.NotOwner.selector);
        registry.grantKycAdmin(kycAdmin);
    }

    function test_attack_grantKycAdmin_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(GrowfiProducerRegistry.ZeroAddress.selector);
        registry.grantKycAdmin(address(0));
    }

    function test_attack_grantKycAdmin_alreadyAdmin_reverts() public {
        vm.prank(owner);
        registry.grantKycAdmin(kycAdmin);
        vm.prank(owner);
        vm.expectRevert(GrowfiProducerRegistry.NoChange.selector);
        registry.grantKycAdmin(kycAdmin);
    }

    function test_revokeKycAdmin_byOwner() public {
        vm.startPrank(owner);
        registry.grantKycAdmin(kycAdmin);
        registry.revokeKycAdmin(kycAdmin);
        vm.stopPrank();
        assertFalse(registry.isKycAdmin(kycAdmin));
    }

    function test_attack_revokeKycAdmin_byNonOwner() public {
        vm.prank(owner);
        registry.grantKycAdmin(kycAdmin);
        vm.prank(attacker);
        vm.expectRevert(GrowfiProducerRegistry.NotOwner.selector);
        registry.revokeKycAdmin(kycAdmin);
    }

    function test_attack_revokeKycAdmin_notAdmin_reverts() public {
        vm.prank(owner);
        vm.expectRevert(GrowfiProducerRegistry.NoChange.selector);
        registry.revokeKycAdmin(kycAdmin);
    }

    // ========================================================================
    // setKyc: only KYC admins, never the producer themselves
    // ========================================================================

    function test_setKyc_byAdmin_flipsFlag() public {
        vm.prank(owner);
        registry.grantKycAdmin(kycAdmin);

        vm.prank(kycAdmin);
        registry.setKyc(producer, true);
        assertTrue(registry.kyced(producer));
        assertEq(registry.kycSetAt(producer), block.timestamp);

        vm.prank(kycAdmin);
        registry.setKyc(producer, false);
        assertFalse(registry.kyced(producer));
    }

    /// Critical attack: producer self-attests KYC. MUST fail.
    function test_attack_producerCannotSelfKyc() public {
        vm.prank(producer);
        vm.expectRevert(GrowfiProducerRegistry.NotKycAdmin.selector);
        registry.setKyc(producer, true);
    }

    function test_attack_owner_cannotSetKyc_unlessAdmin() public {
        // Even the contract owner cannot setKyc unless they grant themselves
        // the role first. This is intentional — the role is its own gate.
        vm.prank(owner);
        vm.expectRevert(GrowfiProducerRegistry.NotKycAdmin.selector);
        registry.setKyc(producer, true);
    }

    function test_attack_revokedAdmin_cannotSetKyc() public {
        vm.startPrank(owner);
        registry.grantKycAdmin(kycAdmin);
        registry.revokeKycAdmin(kycAdmin);
        vm.stopPrank();

        vm.prank(kycAdmin);
        vm.expectRevert(GrowfiProducerRegistry.NotKycAdmin.selector);
        registry.setKyc(producer, true);
    }

    function test_attack_setKyc_zeroAddress() public {
        vm.prank(owner);
        registry.grantKycAdmin(kycAdmin);
        vm.prank(kycAdmin);
        vm.expectRevert(GrowfiProducerRegistry.ZeroAddress.selector);
        registry.setKyc(address(0), true);
    }

    function test_attack_setKyc_noChange_reverts() public {
        vm.prank(owner);
        registry.grantKycAdmin(kycAdmin);
        vm.prank(kycAdmin);
        vm.expectRevert(GrowfiProducerRegistry.NoChange.selector);
        registry.setKyc(producer, false); // already false by default
    }

    // ========================================================================
    // Profile self-service surface unchanged
    // ========================================================================

    function test_setProfile_byProducer() public {
        vm.prank(producer);
        registry.setProfile("https://example.com/me.json");
        assertEq(registry.profileURI(producer), "https://example.com/me.json");
        assertEq(registry.version(producer), 1);
    }

    function test_setProfile_emptyReverts() public {
        vm.prank(producer);
        vm.expectRevert(GrowfiProducerRegistry.EmptyURI.selector);
        registry.setProfile("");
    }

    /// Producer can't write someone else's row.
    function test_attack_profileForeignAddress() public {
        vm.prank(attacker);
        registry.setProfile("https://hostile.com/profile.json");
        // Their own row was written, NOT producer's.
        assertEq(bytes(registry.profileURI(producer)).length, 0);
        assertEq(registry.profileURI(attacker), "https://hostile.com/profile.json");
    }

    // ========================================================================
    // Multi-admin scenario: granting two admins — both can flip independently;
    // revoking one leaves the other functional.
    // ========================================================================

    function test_multipleAdmins_independent() public {
        vm.startPrank(owner);
        registry.grantKycAdmin(kycAdmin);
        registry.grantKycAdmin(otherAdmin);
        vm.stopPrank();

        vm.prank(kycAdmin);
        registry.setKyc(producer, true);
        assertTrue(registry.kyced(producer));

        vm.prank(otherAdmin);
        registry.setKyc(producer, false);
        assertFalse(registry.kyced(producer));

        // Revoke kycAdmin; otherAdmin still works.
        vm.prank(owner);
        registry.revokeKycAdmin(kycAdmin);

        vm.prank(otherAdmin);
        registry.setKyc(producer, true);
        assertTrue(registry.kyced(producer));

        vm.prank(kycAdmin);
        vm.expectRevert(GrowfiProducerRegistry.NotKycAdmin.selector);
        registry.setKyc(producer, false);
    }

    // ========================================================================
    // Social attestation: verifier-signed, producer-claimed
    // ========================================================================

    function test_grantSocialVerifier_byOwner() public {
        vm.prank(owner);
        registry.grantSocialVerifier(socialVerifier);
        assertTrue(registry.isSocialVerifier(socialVerifier));
    }

    function test_attack_grantSocialVerifier_byNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert(GrowfiProducerRegistry.NotOwner.selector);
        registry.grantSocialVerifier(socialVerifier);
    }

    function test_claimSocialAttestation_byProducerWithVerifierSignature() public {
        vm.prank(owner);
        registry.grantSocialVerifier(socialVerifier);

        GrowfiProducerRegistry.SocialAttestation memory attestation = _attestation(producer);
        bytes memory signature = _signSocialAttestation(socialVerifierPk, attestation);

        vm.prank(producer);
        registry.claimSocialAttestation(attestation, signature);

        assertTrue(registry.socialVerified(producer));
        assertEq(registry.socialVerifiedAt(producer), block.timestamp);
        assertEq(registry.socialExpiresAt(producer), attestation.expiresAt);
        assertEq(registry.socialProofHash(producer), attestation.proofHash);
        assertEq(registry.socialAttestationUID(producer), attestation.attestationUID);
        assertEq(registry.socialNonce(producer), 1);
        assertTrue(registry.hasActiveSocialAttestation(producer));
    }

    function test_setSocialAttestation_byVerifier() public {
        vm.prank(owner);
        registry.grantSocialVerifier(socialVerifier);

        GrowfiProducerRegistry.SocialAttestation memory attestation = _attestation(producer);

        vm.prank(socialVerifier);
        registry.setSocialAttestation(attestation);

        assertTrue(registry.socialVerified(producer));
        assertEq(registry.socialNonce(producer), 1);
    }

    function test_attack_claimSocialAttestation_rejectsNonVerifierSignature() public {
        vm.prank(owner);
        registry.grantSocialVerifier(socialVerifier);

        GrowfiProducerRegistry.SocialAttestation memory attestation = _attestation(producer);
        bytes memory signature = _signSocialAttestation(attackerPk, attestation);

        vm.prank(producer);
        vm.expectRevert(GrowfiProducerRegistry.InvalidSocialVerifierSignature.selector);
        registry.claimSocialAttestation(attestation, signature);
    }

    function test_attack_claimSocialAttestation_rejectsForeignProducer() public {
        vm.prank(owner);
        registry.grantSocialVerifier(socialVerifier);

        GrowfiProducerRegistry.SocialAttestation memory attestation = _attestation(producer);
        bytes memory signature = _signSocialAttestation(socialVerifierPk, attestation);

        vm.prank(attacker);
        vm.expectRevert(GrowfiProducerRegistry.InvalidAttestationProducer.selector);
        registry.claimSocialAttestation(attestation, signature);
    }

    function test_attack_claimSocialAttestation_rejectsReplay() public {
        vm.prank(owner);
        registry.grantSocialVerifier(socialVerifier);

        GrowfiProducerRegistry.SocialAttestation memory attestation = _attestation(producer);
        bytes memory signature = _signSocialAttestation(socialVerifierPk, attestation);

        vm.prank(producer);
        registry.claimSocialAttestation(attestation, signature);

        vm.prank(producer);
        vm.expectRevert(GrowfiProducerRegistry.InvalidAttestationNonce.selector);
        registry.claimSocialAttestation(attestation, signature);
    }

    function test_attack_claimSocialAttestation_rejectsExpiredAttestation() public {
        vm.prank(owner);
        registry.grantSocialVerifier(socialVerifier);

        GrowfiProducerRegistry.SocialAttestation memory attestation = _attestation(producer);
        attestation.issuedAt = uint64(block.timestamp - 2 days);
        attestation.expiresAt = uint64(block.timestamp - 1 days);
        bytes memory signature = _signSocialAttestation(socialVerifierPk, attestation);

        vm.prank(producer);
        vm.expectRevert(GrowfiProducerRegistry.ExpiredSocialAttestation.selector);
        registry.claimSocialAttestation(attestation, signature);
    }

    function test_revokeSocialAttestation_byProducer_invalidatesNonce() public {
        vm.prank(owner);
        registry.grantSocialVerifier(socialVerifier);

        GrowfiProducerRegistry.SocialAttestation memory attestation = _attestation(producer);
        bytes memory signature = _signSocialAttestation(socialVerifierPk, attestation);

        vm.prank(producer);
        registry.claimSocialAttestation(attestation, signature);

        vm.prank(producer);
        registry.revokeSocialAttestation(producer);

        assertFalse(registry.socialVerified(producer));
        assertEq(registry.socialExpiresAt(producer), 0);
        assertEq(registry.socialProofHash(producer), bytes32(0));
        assertEq(registry.socialNonce(producer), 2);
    }

    function test_attack_revokeSocialAttestation_byUntrustedAddress() public {
        vm.prank(owner);
        registry.grantSocialVerifier(socialVerifier);

        GrowfiProducerRegistry.SocialAttestation memory attestation = _attestation(producer);
        bytes memory signature = _signSocialAttestation(socialVerifierPk, attestation);

        vm.prank(producer);
        registry.claimSocialAttestation(attestation, signature);

        vm.prank(attacker);
        vm.expectRevert(GrowfiProducerRegistry.NotSocialVerifier.selector);
        registry.revokeSocialAttestation(producer);
    }

    function _attestation(address producer_) internal view returns (GrowfiProducerRegistry.SocialAttestation memory) {
        return GrowfiProducerRegistry.SocialAttestation({
            producer: producer_,
            platform: "x",
            handle: "grower",
            profileUrl: "https://x.com/grower",
            proofUrl: "https://x.com/grower/status/1",
            proofHash: keccak256("growfi-proof"),
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp + 90 days),
            nonce: registry.socialNonce(producer_),
            attestationUID: keccak256("optional-eas-uid")
        });
    }

    function _signSocialAttestation(uint256 signerPk, GrowfiProducerRegistry.SocialAttestation memory attestation)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = registry.socialAttestationDigest(attestation);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }
}
