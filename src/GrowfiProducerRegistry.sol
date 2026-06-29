// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title GrowfiProducerRegistry
/// @notice Onchain pointer from a producer address to a JSON profile
///         (name, bio, avatar/cover URLs, website, social, contact).
///         Every producer owns their row; anyone can read.
///
///         Single global registry, no admin, no upgrades for the public
///         profile surface. The producer writes for themselves via
///         msg.sender, full stop. The subgraph indexes `ProfileUpdated`
///         into the `Producer` entity and the frontend links
///         `GrowfiCampaign.producer` to it.
///
///         Separately, the registry carries a role-gated social attestation
///         per producer. A verifier checks an off-chain social proof, signs an
///         EIP-712 authorization, and the producer claims it on-chain.
///         `attestationUID` can point at an EAS attestation when the verifier
///         also issues one, but GrowFi does not hardcode an external EAS
///         registry address into this minimal surface.
contract GrowfiProducerRegistry is EIP712 {
    using ECDSA for bytes32;

    // --- Profile (self-served) ---

    /// @notice Current profile URI per producer (latest overwrite).
    mapping(address => string) public profileURI;

    /// @notice Monotonically increasing revision per producer — lets
    ///         callers invalidate caches without polling the URI.
    mapping(address => uint256) public version;

    event ProfileUpdated(address indexed producer, uint256 indexed version, string uri);

    error EmptyURI();

    // --- Owner + role-gated attestations ---

    /// @notice Contract owner. Single-slot, ownable-style. Set at deploy.
    ///         Owner can transfer ownership and grant/revoke verifier roles.
    address public owner;

    /// @notice Pending owner for the 2-step transfer pattern.
    address public pendingOwner;

    /// @notice True if `addr` may flip the legacy KYC bit on any producer.
    mapping(address => bool) public isKycAdmin;

    /// @notice Latest legacy KYC verdict per producer. Defaults to false.
    mapping(address => bool) public kyced;

    /// @notice Block timestamp of the last legacy KYC flip (0 if never set).
    mapping(address => uint256) public kycSetAt;

    /// @notice True if `addr` may issue social attestations.
    mapping(address => bool) public isSocialVerifier;

    /// @notice Latest social verification state. Check `socialExpiresAt` for freshness.
    mapping(address => bool) public socialVerified;

    /// @notice Block timestamp when the latest social attestation was accepted.
    mapping(address => uint256) public socialVerifiedAt;

    /// @notice Expiry timestamp signed by the verifier.
    mapping(address => uint256) public socialExpiresAt;

    /// @notice Per-producer nonce for EIP-712 social attestation claims.
    mapping(address => uint256) public socialNonce;

    /// @notice Optional EAS attestation UID, or bytes32(0) when not issued through EAS.
    mapping(address => bytes32) public socialAttestationUID;

    /// @notice Hash of the verified social proof content and request metadata.
    mapping(address => bytes32) public socialProofHash;

    struct SocialAttestation {
        address producer;
        string platform;
        string handle;
        string profileUrl;
        string proofUrl;
        bytes32 proofHash;
        uint64 issuedAt;
        uint64 expiresAt;
        uint256 nonce;
        bytes32 attestationUID;
    }

    bytes32 public constant SOCIAL_ATTESTATION_TYPEHASH = keccak256(
        "SocialAttestation(address producer,string platform,string handle,string profileUrl,string proofUrl,bytes32 proofHash,uint64 issuedAt,uint64 expiresAt,uint256 nonce,bytes32 attestationUID)"
    );

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event KycAdminGranted(address indexed admin, address indexed by);
    event KycAdminRevoked(address indexed admin, address indexed by);
    event KycSet(address indexed producer, bool indexed kyced, address indexed by);
    event SocialVerifierGranted(address indexed verifier, address indexed by);
    event SocialVerifierRevoked(address indexed verifier, address indexed by);
    event SocialAttestationSet(
        address indexed producer,
        string platform,
        string handle,
        string profileUrl,
        string proofUrl,
        bytes32 indexed proofHash,
        bytes32 indexed attestationUID,
        uint64 issuedAt,
        uint64 expiresAt,
        address verifier
    );
    event SocialAttestationRevoked(address indexed producer, address indexed by);

    error NotOwner();
    error NotPendingOwner();
    error NotKycAdmin();
    error NotSocialVerifier();
    error ZeroAddress();
    error NoChange();
    error EmptySocialProof();
    error InvalidAttestationProducer();
    error InvalidAttestationNonce();
    error InvalidSocialVerifierSignature();
    error InvalidSocialAttestationExpiry();
    error ExpiredSocialAttestation();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyKycAdmin() {
        if (!isKycAdmin[msg.sender]) revert NotKycAdmin();
        _;
    }

    modifier onlySocialVerifier() {
        if (!isSocialVerifier[msg.sender]) revert NotSocialVerifier();
        _;
    }

    /// @param owner_ Initial owner; receives the right to grant the first
    ///        verifier/admin roles and to transfer ownership later.
    constructor(address owner_) EIP712("GrowfiProducerRegistry", "1") {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    /// @notice Publish or update a profile. The caller is always the
    ///         producer; there's no way to write to someone else's row.
    /// @param uri Fully-qualified URL to the profile JSON (e.g. on DO
    ///        Spaces, IPFS, or any other host). The shape is a frontend
    ///        concern, not enforced on-chain.
    function setProfile(string calldata uri) external {
        if (bytes(uri).length == 0) revert EmptyURI();

        uint256 newVersion = version[msg.sender] + 1;
        version[msg.sender] = newVersion;
        profileURI[msg.sender] = uri;

        emit ProfileUpdated(msg.sender, newVersion, uri);
    }

    // --- Ownership (2-step) ---

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address previous = owner;
        owner = pendingOwner;
        delete pendingOwner;
        emit OwnershipTransferred(previous, owner);
    }

    // --- KYC admin set ---

    /// @notice Legacy role kept for already-deployed integrations.
    function grantKycAdmin(address admin) external onlyOwner {
        if (admin == address(0)) revert ZeroAddress();
        if (isKycAdmin[admin]) revert NoChange();
        isKycAdmin[admin] = true;
        emit KycAdminGranted(admin, msg.sender);
    }

    function revokeKycAdmin(address admin) external onlyOwner {
        if (!isKycAdmin[admin]) revert NoChange();
        isKycAdmin[admin] = false;
        emit KycAdminRevoked(admin, msg.sender);
    }

    // --- Legacy KYC verdict ---

    /// @notice Flip the legacy KYC bit on a producer. Idempotent guard against
    ///         no-op writes so subgraphs don't have to dedupe.
    function setKyc(address producer, bool kyced_) external onlyKycAdmin {
        if (producer == address(0)) revert ZeroAddress();
        if (kyced[producer] == kyced_) revert NoChange();
        kyced[producer] = kyced_;
        kycSetAt[producer] = block.timestamp;
        emit KycSet(producer, kyced_, msg.sender);
    }

    // --- Social attestation verifier set ---

    function grantSocialVerifier(address verifier) external onlyOwner {
        if (verifier == address(0)) revert ZeroAddress();
        if (isSocialVerifier[verifier]) revert NoChange();
        isSocialVerifier[verifier] = true;
        emit SocialVerifierGranted(verifier, msg.sender);
    }

    function revokeSocialVerifier(address verifier) external onlyOwner {
        if (!isSocialVerifier[verifier]) revert NoChange();
        isSocialVerifier[verifier] = false;
        emit SocialVerifierRevoked(verifier, msg.sender);
    }

    // --- Social attestation ---

    function socialAttestationDigest(SocialAttestation calldata attestation) external view returns (bytes32) {
        return _hashSocialAttestation(attestation);
    }

    function hasActiveSocialAttestation(address producer) external view returns (bool) {
        return socialVerified[producer] && socialExpiresAt[producer] > block.timestamp;
    }

    /// @notice Claim a social verification with an EIP-712 signature from a trusted verifier.
    function claimSocialAttestation(SocialAttestation calldata attestation, bytes calldata signature) external {
        if (attestation.producer != msg.sender) revert InvalidAttestationProducer();
        _validateSocialAttestation(attestation);

        address signer = _hashSocialAttestation(attestation).recover(signature);
        if (!isSocialVerifier[signer]) revert InvalidSocialVerifierSignature();

        _setSocialAttestation(attestation, signer);
    }

    /// @notice Direct write path for verifier-operated relayers or admin tooling.
    function setSocialAttestation(SocialAttestation calldata attestation) external onlySocialVerifier {
        _validateSocialAttestation(attestation);
        _setSocialAttestation(attestation, msg.sender);
    }

    function revokeSocialAttestation(address producer) external {
        if (producer == address(0)) revert ZeroAddress();
        if (msg.sender != producer && msg.sender != owner && !isSocialVerifier[msg.sender]) {
            revert NotSocialVerifier();
        }
        if (!socialVerified[producer]) revert NoChange();

        socialVerified[producer] = false;
        socialExpiresAt[producer] = 0;
        socialAttestationUID[producer] = bytes32(0);
        socialProofHash[producer] = bytes32(0);
        socialNonce[producer] += 1;

        emit SocialAttestationRevoked(producer, msg.sender);
    }

    function _validateSocialAttestation(SocialAttestation calldata attestation) internal view {
        if (attestation.producer == address(0)) revert ZeroAddress();
        if (attestation.nonce != socialNonce[attestation.producer]) revert InvalidAttestationNonce();
        if (bytes(attestation.platform).length == 0 || bytes(attestation.proofUrl).length == 0) {
            revert EmptySocialProof();
        }
        if (attestation.proofHash == bytes32(0)) revert EmptySocialProof();
        if (attestation.expiresAt <= attestation.issuedAt) revert InvalidSocialAttestationExpiry();
        if (attestation.expiresAt <= block.timestamp) revert ExpiredSocialAttestation();
    }

    function _setSocialAttestation(SocialAttestation calldata attestation, address verifier) internal {
        socialVerified[attestation.producer] = true;
        socialVerifiedAt[attestation.producer] = block.timestamp;
        socialExpiresAt[attestation.producer] = attestation.expiresAt;
        socialAttestationUID[attestation.producer] = attestation.attestationUID;
        socialProofHash[attestation.producer] = attestation.proofHash;
        socialNonce[attestation.producer] = attestation.nonce + 1;

        emit SocialAttestationSet(
            attestation.producer,
            attestation.platform,
            attestation.handle,
            attestation.profileUrl,
            attestation.proofUrl,
            attestation.proofHash,
            attestation.attestationUID,
            attestation.issuedAt,
            attestation.expiresAt,
            verifier
        );
    }

    function _hashSocialAttestation(SocialAttestation calldata attestation) internal view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SOCIAL_ATTESTATION_TYPEHASH,
                    attestation.producer,
                    keccak256(bytes(attestation.platform)),
                    keccak256(bytes(attestation.handle)),
                    keccak256(bytes(attestation.profileUrl)),
                    keccak256(bytes(attestation.proofUrl)),
                    attestation.proofHash,
                    attestation.issuedAt,
                    attestation.expiresAt,
                    attestation.nonce,
                    attestation.attestationUID
                )
            )
        );
    }
}
